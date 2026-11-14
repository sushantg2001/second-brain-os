import type { App, EventRef } from "obsidian";

import type { Task, TaskIndex, TaskSnapshot } from "../../features/tasks";
import { Store, type IsoDate } from "../../shared/kernel";

import type { DataviewApi } from "./api";
import { tasksFromLists } from "./task-mapper";

type DataviewEvent = "dataview:metadata-change" | "dataview:index-ready" | "dataview:api-ready";

/** The events Dataview triggers on the metadata cache. Obsidian's typings do not know them. */
interface DataviewEvents {
	on(name: DataviewEvent, callback: (...args: unknown[]) => void): EventRef;
	offref(ref: EventRef): void;
}

/** The undocumented `app.plugins` manager. Only the part read here is typed. */
interface PluginManager {
	readonly plugins: Readonly<Record<string, unknown>>;
}

export interface DataviewTaskIndexOptions {
	/**
	 * How long to wait after a note changes before telling listeners, so a burst of changes (a
	 * sync, a git pull) is one update. Zero updates at once.
	 */
	readonly debounceMs?: number | undefined;
}

const DEBOUNCE_MS = 50;

/**
 * Every task in the vault, read from Dataview's index. Dataview parses the notes and keeps the
 * index current; this reads a note's tasks when they are asked for and drops them when Dataview
 * says the note changed.
 */
export class DataviewTaskIndex implements TaskIndex {
	readonly #store = new Store<TaskSnapshot>({ version: 0 });
	readonly #byPath = new Map<string, readonly Task[]>();
	#taskPaths: { version: number; paths: readonly string[] } | null = null;
	#scheduled: { version: number; byDate: Map<IsoDate, Task[]> } | null = null;
	#indexed = false;
	#timer: number | null = null;
	#resolveReady: () => void = () => {};
	readonly ready: Promise<void> = new Promise((resolve) => {
		this.#resolveReady = resolve;
	});

	constructor(
		private readonly app: App,
		private readonly options: DataviewTaskIndexOptions = {},
	) {}

	get snapshot(): Store<TaskSnapshot> {
		return this.#store;
	}

	#api(): DataviewApi | null {
		const manager = (this.app as App & { plugins?: PluginManager }).plugins;
		const dataview = manager?.plugins.dataview as { api?: DataviewApi } | undefined;
		return dataview?.api ?? null;
	}

	tasksIn(path: string): readonly Task[] {
		const known = this.#byPath.get(path);
		if (known) {
			return known;
		}
		const api = this.#api();
		if (!api?.index.initialized) {
			return [];
		}
		const page = api.page(path);
		const tasks = page ? tasksFromLists(path, page.file.lists) : [];
		this.#byPath.set(path, tasks);
		return tasks;
	}

	/** Paths of the notes that have a task, so notes without one are never read. */
	#pathsWithTasks(): readonly string[] {
		const version = this.#store.get().version;
		if (this.#taskPaths?.version !== version) {
			const pages = this.#api()?.index.pages ?? new Map<string, { lists: [] }>();
			const paths = [...pages]
				.filter(([, page]) => page.lists.some((item) => item.task))
				.map(([path]) => path);
			this.#taskPaths = { version, paths };
		}
		return this.#taskPaths.paths;
	}

	*all(): Iterable<Task> {
		if (this.#api()?.index.initialized) {
			for (const path of this.#pathsWithTasks()) {
				yield* this.tasksIn(path);
			}
		}
	}

	scheduledOn(date: IsoDate): readonly Task[] {
		const version = this.#store.get().version;
		if (this.#scheduled?.version !== version) {
			const byDate = new Map<IsoDate, Task[]>();
			for (const task of this.all()) {
				const scheduled = task.fields.scheduled;
				if (scheduled) {
					byDate.set(scheduled, [...(byDate.get(scheduled) ?? []), task]);
				}
			}
			this.#scheduled = { version, byDate };
		}
		return this.#scheduled.byDate.get(date) ?? [];
	}

	attach(): () => void {
		const events = this.app.metadataCache as unknown as DataviewEvents;
		const refs = [
			events.on("dataview:metadata-change", (...args) => {
				const [, file, oldPath] = args as [string, { path: string }, string | undefined];
				this.#byPath.delete(file.path);
				if (oldPath) {
					this.#byPath.delete(oldPath);
				}
				this.#changed();
			}),
			events.on("dataview:index-ready", () => this.#built()),
			events.on("dataview:api-ready", () => this.#checkBuilt()),
		];
		this.#checkBuilt();
		return () => {
			for (const ref of refs) {
				events.offref(ref);
			}
			this.#cancel();
		};
	}

	#checkBuilt(): void {
		if (this.#api()?.index.initialized) {
			this.#built();
		}
	}

	/** Dataview has indexed the whole vault, so whatever was read before is out of date. */
	#built(): void {
		this.#byPath.clear();
		this.#indexed = true;
		this.#publish();
		this.#resolveReady();
	}

	/** Until the vault is indexed Dataview reports every note once, so only the end counts. */
	#changed(): void {
		if (!this.#indexed) {
			return;
		}
		const wait = this.options.debounceMs ?? DEBOUNCE_MS;
		if (wait <= 0) {
			this.#publish();
			return;
		}
		this.#timer ??= window.setTimeout(() => this.#publish(), wait);
	}

	#publish(): void {
		this.#cancel();
		this.#store.set({ version: this.#store.get().version + 1 });
	}

	#cancel(): void {
		if (this.#timer !== null) {
			window.clearTimeout(this.#timer);
			this.#timer = null;
		}
	}
}

import {
	Store,
	type IsoDate,
	type NoteChange,
	type NoteStore,
	type ReadableStore,
} from "../../../shared/kernel";
import { parseTasks, type Task } from "../domain/parse-note";

export interface TaskSnapshot {
	readonly byPath: ReadonlyMap<string, readonly Task[]>;
	/** Increments on every change, for cheap memoisation. */
	readonly version: number;
}

/** Quick filter so notes without tasks are parsed only once, cheaply. */
const MIGHT_HAVE_TASKS = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+\[.\]/m;

/** Every task in the vault, kept current from note changes. */
export class TaskIndex {
	readonly #store = new Store<TaskSnapshot>({ byPath: new Map(), version: 0 });
	#scheduled: { snapshot: TaskSnapshot; byDate: Map<IsoDate, Task[]> } | null = null;
	#resolveReady: () => void = () => {};
	/** Resolves after the first full build. */
	readonly ready: Promise<void> = new Promise((resolve) => {
		this.#resolveReady = resolve;
	});

	constructor(private readonly notes: NoteStore) {}

	get snapshot(): ReadableStore<TaskSnapshot> {
		return this.#store;
	}

	tasksIn(path: string): readonly Task[] {
		return this.#store.get().byPath.get(path) ?? [];
	}

	*all(): Iterable<Task> {
		for (const tasks of this.#store.get().byPath.values()) {
			yield* tasks;
		}
	}

	/** Tasks with a scheduled date of `date`. Indexed once per change, so lookups are cheap. */
	scheduledOn(date: IsoDate): readonly Task[] {
		const snapshot = this.#store.get();
		if (this.#scheduled?.snapshot !== snapshot) {
			const byDate = new Map<IsoDate, Task[]>();
			for (const task of this.all()) {
				const scheduled = task.fields.scheduled;
				if (scheduled) {
					byDate.set(scheduled, [...(byDate.get(scheduled) ?? []), task]);
				}
			}
			this.#scheduled = { snapshot, byDate };
		}
		return this.#scheduled.byDate.get(date) ?? [];
	}

	async rebuild(): Promise<void> {
		const byPath = new Map<string, readonly Task[]>();
		for (const note of this.notes.list()) {
			const tasks = await this.parse(note.path);
			if (tasks.length > 0) {
				byPath.set(note.path, tasks);
			}
		}
		this.#commit(byPath);
		this.#resolveReady();
	}

	/** Re-reads one note. */
	async update(path: string): Promise<void> {
		const tasks = this.notes.exists(path) ? await this.parse(path) : [];
		const byPath = new Map(this.#store.get().byPath);
		if (tasks.length > 0) {
			byPath.set(path, tasks);
		} else if (!byPath.delete(path)) {
			return;
		}
		this.#commit(byPath);
	}

	async apply(change: NoteChange): Promise<void> {
		if (change.type === "rename") {
			const byPath = new Map(this.#store.get().byPath);
			byPath.delete(change.oldPath);
			this.#commit(byPath);
		}
		await this.update(change.path);
	}

	/** Keeps the index current. Returns the unsubscribe function. */
	attach(): () => void {
		return this.notes.onChange((change) => void this.apply(change));
	}

	private async parse(path: string): Promise<Task[]> {
		const content = await this.notes.read(path).catch(() => "");
		return MIGHT_HAVE_TASKS.test(content) ? parseTasks(path, content) : [];
	}

	#commit(byPath: Map<string, readonly Task[]>): void {
		this.#store.set({ byPath, version: this.#store.get().version + 1 });
	}
}

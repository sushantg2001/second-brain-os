import type { App } from "obsidian";

import type { TaskSource } from "../../features/tasks";

/** The part of Datacore's public API used here: https://blacksmithgu.github.io/datacore/ */
interface DatacoreApi {
	/** Runs a Datacore query; `@task` lists every task in the vault. */
	readonly query: (query: string) => readonly { readonly $file?: string }[];
	readonly core?: { readonly initialized?: boolean };
}

export interface DatacoreOptions {
	/** How long to wait for Datacore to finish indexing before giving up, in milliseconds. */
	readonly timeoutMs?: number;
	/** How often to check whether it has, in milliseconds. */
	readonly pollMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_POLL_MS = 100;

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * Asks Datacore which notes hold tasks, so the task index reads those and not every note in the
 * vault. Datacore keeps that index current and already knows the notes it was told to skip.
 *
 * It says nothing when Datacore is missing, still indexing after the timeout, or fails, and the
 * caller reads every note instead. Datacore stores one value per inline field and only a task's
 * first line, so it cannot stand in for reading clock lines and time blocks from the note.
 */
export class DatacoreTaskSource implements TaskSource {
	readonly #timeoutMs: number;
	readonly #pollMs: number;

	constructor(
		private readonly app: App,
		options: DatacoreOptions = {},
	) {
		this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
		this.#pollMs = options.pollMs ?? DEFAULT_POLL_MS;
	}

	async paths(): Promise<ReadonlySet<string> | null> {
		const api = this.#api();
		if (!api || !(await this.#indexed(api))) {
			return null;
		}
		try {
			const paths = new Set<string>();
			for (const task of api.query("@task")) {
				if (task.$file) {
					paths.add(task.$file);
				}
			}
			return paths;
		} catch {
			return null;
		}
	}

	#api(): DatacoreApi | null {
		const plugins = (this.app as App & { plugins?: { plugins?: Record<string, unknown> } })
			.plugins?.plugins;
		const api = (plugins?.["datacore"] as { api?: DatacoreApi } | undefined)?.api;
		return api && typeof api.query === "function" ? api : null;
	}

	async #indexed(api: DatacoreApi): Promise<boolean> {
		for (let waited = 0; waited <= this.#timeoutMs; waited += this.#pollMs) {
			if (api.core?.initialized) {
				return true;
			}
			await sleep(this.#pollMs);
		}
		return false;
	}
}

import type { IsoDate, ReadableStore } from "../../../shared/kernel";
import type { Task } from "../domain/task";

/** Toggles a task the way the Tasks plugin does, including recurrence. */
export interface TaskToggler {
	/** Returns the replacement lines (more than one for recurring tasks), or null if unavailable. */
	toggle(raw: string, path: string): string | null;
}

export interface TaskSnapshot {
	/** Increments whenever the index changes, for cheap memoisation. */
	readonly version: number;
}

/**
 * Every task in the vault. The tasks come from Dataview's index, which reads the notes; this
 * plugin has no parser of its own.
 */
export interface TaskIndex {
	readonly snapshot: ReadableStore<TaskSnapshot>;
	/** Resolves once the index has been built the first time. */
	readonly ready: Promise<void>;
	tasksIn(path: string): readonly Task[];
	all(): Iterable<Task>;
	/** Tasks with a scheduled date of `date`. */
	scheduledOn(date: IsoDate): readonly Task[];
	/** Starts following the index. Returns the function that stops it. */
	attach(): () => void;
}

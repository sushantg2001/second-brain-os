/** Toggles a task the way the Tasks plugin does, including recurrence. */
export interface TaskToggler {
	/** Returns the replacement lines (more than one for recurring tasks), or null if unavailable. */
	toggle(raw: string, path: string): string | null;
}

/** Says which notes hold tasks, from an index the vault already keeps. */
export interface TaskSource {
	/**
	 * The paths of the notes that hold tasks, or null when the source cannot say, in which case
	 * every note is read.
	 */
	paths(): Promise<ReadonlySet<string> | null>;
}

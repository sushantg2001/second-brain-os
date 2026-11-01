/** Toggles a task the way the Tasks plugin does, including recurrence. */
export interface TaskToggler {
	/** Returns the replacement lines (more than one for recurring tasks), or null if unavailable. */
	toggle(raw: string, path: string): string | null;
}

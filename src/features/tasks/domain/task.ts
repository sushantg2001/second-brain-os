import type { IsoDate } from "../../../shared/kernel";

import type { TaskState } from "./status";
import type { TimeBlock } from "./time-block";

/** What a task carries besides its text, as the task index reports it. */
export interface TaskFields {
	readonly scheduled: IsoDate | null;
	readonly due: IsoDate | null;
	readonly start: IsoDate | null;
	readonly done: IsoDate | null;
	/** Link targets as written, without a heading, block or alias. */
	readonly links: readonly string[];
}

/**
 * A task as the task index reports it. Lines are 0-based line numbers in the note.
 *
 * The note's text is not kept: a task is read from the index and found again in the note by its
 * position and `text` when it is edited.
 */
export interface Task {
	readonly path: string;
	readonly line: number;
	/** Lines the task itself takes, its first line and any lines continuing it. Not nested items. */
	readonly lineCount: number;
	/** Last line of the task, counting everything nested under it. */
	readonly lastLine: number;
	/** The first line of the task's text, after the checkbox. */
	readonly text: string;
	/** The character between the brackets of the checkbox. */
	readonly status: string;
	readonly state: TaskState;
	readonly fields: TaskFields;
	readonly block: TimeBlock | null;
	/**
	 * The `clock` fields of the task itself, as written (`START--END`): on lines continuing the
	 * task, or on plain list items nested directly under it. Clocks of tasks nested under this
	 * one belong to those tasks.
	 */
	readonly clocks: readonly string[];
	/** Line of the closest task this one is nested under, or null. */
	readonly parentLine: number | null;
	/** The closest heading above the task, or null. */
	readonly heading: string | null;
}

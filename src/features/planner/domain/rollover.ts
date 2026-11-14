import { isClosed, parseListLine, type Task } from "../../tasks";

import { withoutBlock } from "./block-edits";

export interface CarriedTask {
	readonly task: Task;
	/** The task line and its nested lines, as they are in the old note. */
	readonly lines: readonly string[];
	/** The lines to write in the new note: the task without its old time block. */
	readonly carried: readonly string[];
}

/**
 * Open tasks that are not nested inside another task, with their nested lines. The tasks come
 * from the index, which can be a moment behind the note, so one that is no longer on its line is
 * left out rather than carried with the wrong lines.
 */
export function tasksToCarry(content: string, tasks: readonly Task[]): CarriedTask[] {
	const lines = content.split(/\r?\n/);
	return tasks
		.filter(
			(task) => task.parentLine === null && !isClosed(task.state) && task.text.trim() !== "",
		)
		.flatMap((task) => {
			const block = lines.slice(task.line, task.lastLine + 1);
			const [first = "", ...rest] = block;
			const item = parseListLine(first);
			if (!item || item.status !== task.status || item.text.trim() !== task.text.trim()) {
				return [];
			}
			return [{ task, lines: block, carried: [withoutBlock(first) ?? first, ...rest] }];
		});
}

/**
 * Removes carried tasks from the old note. Each block must still be where it was read, so a note
 * edited in the meantime is left alone. Returns null in that case.
 */
export function removeCarried(content: string, carried: readonly CarriedTask[]): string | null {
	const eol = content.includes("\r\n") ? "\r\n" : "\n";
	const lines = content.split(/\r?\n/);
	for (const item of [...carried].sort((a, b) => b.task.line - a.task.line)) {
		const current = lines.slice(item.task.line, item.task.line + item.lines.length);
		if (current.join("\n") !== item.lines.join("\n")) {
			return null;
		}
		lines.splice(item.task.line, item.lines.length);
	}
	return lines.join(eol);
}

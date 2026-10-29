import { isClosed, taskEndLine, type Task } from "../../tasks";
import { withoutBlock } from "./block-edits";

export interface CarriedTask {
	readonly task: Task;
	/** The task line and its nested lines, as they are in the old note. */
	readonly lines: readonly string[];
	/** The lines to write in the new note: the task without its old time block. */
	readonly carried: readonly string[];
}

/** Open tasks that are not nested inside another task, with their nested lines. */
export function tasksToCarry(content: string, tasks: readonly Task[]): CarriedTask[] {
	const lines = content.split(/\r?\n/);
	const nested = new Set(tasks.flatMap((task) => task.children.map((child) => child.line)));
	// A task's yaml block (Day Planner clocks) moves with it.
	return tasks
		.filter(
			(task) => !nested.has(task.line) && !isClosed(task.state) && task.text.trim() !== "",
		)
		.map((task) => {
			const last = taskEndLine(task);
			const block = lines.slice(task.line, last + 1);
			const [first = task.raw, ...rest] = block;
			return { task, lines: block, carried: [withoutBlock(first) ?? first, ...rest] };
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

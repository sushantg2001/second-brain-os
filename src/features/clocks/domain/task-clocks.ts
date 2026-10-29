import { indentWidth, parseListLine, type ListItem, type Task } from "../../tasks";
import { formatClockEntry, parseClockEntry, type ClockEntry, type Moment } from "./clock-entry";

export interface ClockLine extends ClockEntry {
	readonly line: number;
	readonly raw: string;
}

/** Clock entries written as list items under a task. */
export function clocksOf(task: Task): ClockLine[] {
	return task.children.flatMap((child: ListItem) => {
		const entry = parseClockEntry(child.text);
		return entry ? [{ ...entry, line: child.line, raw: child.raw }] : [];
	});
}

/** Indentation for a new child line: one level deeper than the task, matching the note's style. */
export function childIndent(task: Task, content: string): string {
	const taskIndent = parseListLine(task.raw)?.indent ?? "";
	const firstChild = task.children[0];
	if (firstChild) {
		const childIndentText = parseListLine(firstChild.raw)?.indent ?? "";
		if (indentWidth(childIndentText) > indentWidth(taskIndent)) {
			return childIndentText;
		}
	}
	const usesTabs = /^\t/m.test(content) || !/^ {2,}\S/m.test(content);
	return taskIndent + (usesTabs ? "\t" : "    ");
}

export function openClockLine(indent: string, start: Moment): string {
	return `${indent}- ${formatClockEntry({ start, end: null })}`;
}

/** Closes a running clock line at `end`, keeping its indentation and any text around it. */
export function closeClockLine(raw: string, end: Moment): string | null {
	const entry = parseClockEntry(raw);
	if (!entry || entry.end !== null) {
		return null;
	}
	return raw.replace(/\[clock::[^\]]*\]/i, formatClockEntry({ start: entry.start, end }));
}

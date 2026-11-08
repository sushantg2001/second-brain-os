import { parseListLine, type ListItem, type Task } from "../../tasks";
import { formatClockEntry, parseClockEntry, type ClockEntry, type Moment } from "./clock-entry";

export interface ClockLine extends ClockEntry {
	readonly line: number;
	readonly raw: string;
}

function clocksIn(items: readonly ListItem[]): ClockLine[] {
	return items.flatMap((item: ListItem) => {
		const entry = parseClockEntry(item.text);
		return entry ? [{ ...entry, line: item.line, raw: item.raw }] : [];
	});
}

/**
 * Clock entries written on the task itself: indented lines under it with no bullet, or the older
 * `- [clock::…]` list items. Entries on tasks nested under it belong to those tasks.
 */
export function clocksOf(task: Task): ClockLine[] {
	return clocksIn(task.own);
}

/** The task's own clock entries and those of the tasks nested under it. */
export function clocksWithin(task: Task): ClockLine[] {
	return clocksIn(task.children);
}

/** Indentation for a new clock line: one tab deeper than the task. */
export function clockIndent(task: Task): string {
	return `${parseListLine(task.raw)?.indent ?? ""}\t`;
}

/** Where a new clock line goes: below the task and the continuation lines already under it. */
export function clockInsertLine(task: Task): number {
	let last = task.line;
	for (const item of task.own) {
		if (item.line === last + 1 && parseListLine(item.raw) === null) {
			last = item.line;
		}
	}
	return last + 1;
}

export function openClockLine(indent: string, start: Moment): string {
	return `${indent}${formatClockEntry({ start, end: null })}`;
}

/**
 * Closes a running clock line at `end`, keeping its indentation, its bullet if it has one, and any
 * text around it. The end is written to the same precision as the start.
 */
export function closeClockLine(raw: string, end: Moment): string | null {
	const entry = parseClockEntry(raw);
	if (!entry || entry.end !== null) {
		return null;
	}
	const { date, minutes, seconds } = end;
	const closing: Moment =
		entry.start.seconds === undefined
			? { date, minutes }
			: { date, minutes, seconds: seconds ?? 0 };
	return raw.replace(
		/\[clock::[^\]]*\]/i,
		formatClockEntry({ start: entry.start, end: closing }),
	);
}

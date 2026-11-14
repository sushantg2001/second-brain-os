import { err, ok, type Result } from "../../../shared/kernel";
import { StaleLineError, type Task } from "../../tasks";

import {
	formatClockEntry,
	formatClockValue,
	parseClockValue,
	type ClockEntry,
	type Moment,
} from "./clock-entry";

export interface ClockLine extends ClockEntry {
	/** The value as written, `START--END`. It is how the clock is found again in the note. */
	readonly value: string;
}

/**
 * Clock entries written on the task itself: `[clock::…]` on indented lines under it with no
 * bullet, or on the older `- [clock::…]` list items. Entries on tasks nested under it belong to
 * those tasks. Dataview finds the fields, so a task already carries its entries.
 */
export function clocksOf(task: Pick<Task, "clocks">): ClockLine[] {
	return task.clocks.flatMap((value) => {
		const entry = parseClockValue(value);
		return entry ? [{ ...entry, value }] : [];
	});
}

export function openClockLine(indent: string, start: Moment): string {
	return `${indent}${formatClockEntry({ start, end: null })}`;
}

/** The value of a running clock closed at `end`, written to the same precision as the start. */
export function closedClockValue(value: string, end: Moment): string | null {
	const entry = parseClockValue(value);
	if (!entry || entry.end !== null) {
		return null;
	}
	const { date, minutes, seconds } = end;
	const closing: Moment =
		entry.start.seconds === undefined
			? { date, minutes }
			: { date, minutes, seconds: seconds ?? 0 };
	return formatClockValue({ start: entry.start, end: closing });
}

/** Where a clock is looked for in a note: the lines of its task, with the task's nested items. */
export interface ClockSpot {
	readonly line: number;
	readonly lastLine: number;
	readonly value: string;
}

function fieldPattern(value: string): RegExp {
	const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`\\[clock::\\s*${escaped}\\s*\\]`, "i");
}

/**
 * Finds the line holding a clock. Start times carry the second they were written, so the field is
 * normally the only one like it in the note and is found wherever the task has moved to; if
 * there are several, the one in the task's lines is taken, and if that is not one either, none.
 */
export function findClockLine(
	lines: readonly string[],
	spot: ClockSpot,
): Result<number, StaleLineError> {
	const pattern = fieldPattern(spot.value);
	const matches = lines.flatMap((line, index) => (pattern.test(line) ? [index] : []));
	const inTask = matches.filter((index) => index >= spot.line && index <= spot.lastLine);
	const found = matches.length === 1 ? matches : inTask;
	return found.length === 1 ? ok(found[0] ?? 0) : err(new StaleLineError());
}

/** Closes a running clock at `end` in the note, leaving the rest of its line as it was. */
export function closeClockIn(content: string, spot: ClockSpot, end: Moment): Result<string, Error> {
	const closed = closedClockValue(spot.value, end);
	if (closed === null) {
		return err(new Error("That clock is not running."));
	}
	const eol = content.includes("\r\n") ? "\r\n" : "\n";
	const lines = content.split(/\r?\n/);
	const at = findClockLine(lines, spot);
	if (!at.ok) {
		return at;
	}
	lines[at.value] = (lines[at.value] ?? "").replace(
		fieldPattern(spot.value),
		() => `[clock::${closed}]`,
	);
	return ok(lines.join(eol));
}

/** What closing a clock changes: the field before and after. */
export function previewClosedClock(
	value: string,
	end: Moment,
): { before: string; after: string } | null {
	const closed = closedClockValue(value, end);
	return closed === null ? null : { before: `[clock::${value}]`, after: `[clock::${closed}]` };
}

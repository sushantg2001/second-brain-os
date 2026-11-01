import { clampMinutes, MINUTES_PER_DAY, snapMinutes, type Minutes } from "../../../shared/kernel";
import { formatListLine, formatTimeBlock, parseListLine, stripTimeBlock } from "../../tasks";

/** Sets or replaces the time block on a task line. Null for lines that are not tasks. */
export function withBlock(raw: string, start: Minutes, end: Minutes | null): string | null {
	const line = parseListLine(raw);
	if (!line || line.status === null) {
		return null;
	}
	return formatListLine({
		...line,
		text: formatTimeBlock(start, end, stripTimeBlock(line.text)),
	});
}

/** Removes the time block from a task line. */
export function withoutBlock(raw: string): string | null {
	const line = parseListLine(raw);
	if (!line || line.status === null) {
		return null;
	}
	return formatListLine({ ...line, text: stripTimeBlock(line.text) });
}

export function newBlockLine(title: string, start: Minutes, end: Minutes): string {
	return formatListLine({
		indent: "",
		marker: "-",
		status: " ",
		text: formatTimeBlock(start, end, title.trim()),
	});
}

/**
 * Snaps a proposed range to the step, keeps it inside the day and at least one step long.
 * Moving keeps the length; the end is pulled back first, then the start.
 */
export function normalizeRange(
	start: Minutes,
	end: Minutes,
	step: Minutes,
): { start: Minutes; end: Minutes } {
	const length = Math.max(step, snapMinutes(end - start, step));
	const snappedStart = clampMinutes(snapMinutes(start, step), 0, MINUTES_PER_DAY - step);
	const snappedEnd = Math.min(MINUTES_PER_DAY, snappedStart + length);
	return { start: snappedStart, end: snappedEnd };
}

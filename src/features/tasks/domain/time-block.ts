import { formatTime, parseTime, type Minutes } from "../../../shared/kernel";

/** A Day Planner time block at the start of a task: "09:00 - 10:30 Write the spec". */
export interface TimeBlock {
	readonly start: Minutes;
	/** Null when only a start time is written. */
	readonly end: Minutes | null;
	/** The text after the times. */
	readonly rest: string;
	/** True when an end time is written but is not after the start. */
	readonly malformed: boolean;
}

const TIME = "(\\d{1,2}:\\d{2}(?:\\s?[ap]m)?)";
const BLOCK = new RegExp(`^${TIME}(?:\\s*[-–—]\\s*${TIME})?(?:\\s+(.*))?$`, "i");

export function parseTimeBlock(text: string): TimeBlock | null {
	const match = BLOCK.exec(text.trim());
	if (!match) {
		return null;
	}
	const start = parseTime(match[1] ?? "");
	if (start === null || start >= 24 * 60) {
		return null;
	}
	const rest = (match[3] ?? "").trim();
	if (match[2] === undefined) {
		return { start, end: null, rest, malformed: false };
	}
	const end = parseTime(match[2]);
	if (end === null || end <= start) {
		return { start, end: null, rest, malformed: true };
	}
	return { start, end, rest, malformed: false };
}

export function formatTimeBlock(start: Minutes, end: Minutes | null, rest: string): string {
	const times = end === null ? formatTime(start) : `${formatTime(start)} - ${formatTime(end)}`;
	return rest ? `${times} ${rest}` : times;
}

/** Removes a leading time block, leaving the rest of the text. */
export function stripTimeBlock(text: string): string {
	return parseTimeBlock(text)?.rest ?? text;
}

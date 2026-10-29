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

/** Hours and minutes separated by ":" or ".", as Day Planner accepts. */
const CLOCK = /^(\d{1,2}[:.]\d{2})(?:(\s?)([ap]m)(?![\p{L}\p{N}]))?/iu;
const RANGE = /^\s*[-–—]\s*/;

interface ReadTime {
	readonly minutes: Minutes;
	readonly length: number;
	readonly meridiem: boolean;
}

/**
 * Reads a time at the start of `text`. On a start time, "am"/"pm" counts only when attached
 * ("9:00pm") or followed by a dash or the end ("9:00 pm - 10:00 pm"). An end time takes one only
 * after a 12-hour start. So "09:00 - 10:00 PM review" keeps "PM review" as text.
 */
function readTime(text: string, meridiem: "start" | "end" | "none"): ReadTime | null {
	const match = CLOCK.exec(text);
	if (!match) {
		return null;
	}
	const clock = (match[1] ?? "").replace(".", ":");
	const suffix = match[3];
	if (meridiem !== "none" && suffix) {
		const rest = text.slice(match[0].length);
		const attached = match[2] === "";
		// An end time after a 12-hour start follows the start's style.
		if (meridiem === "end" || attached || rest.trim() === "" || RANGE.test(rest)) {
			const minutes = parseTime(`${clock}${suffix}`);
			if (minutes !== null) {
				return { minutes, length: match[0].length, meridiem: true };
			}
		}
	}
	const minutes = parseTime(clock);
	return minutes === null ? null : { minutes, length: clock.length, meridiem: false };
}

export function parseTimeBlock(text: string): TimeBlock | null {
	const trimmed = text.trim();
	const start = readTime(trimmed, "start");
	if (!start || start.minutes >= 24 * 60) {
		return null;
	}
	let after = trimmed.slice(start.length);
	let end: ReadTime | null = null;
	const range = RANGE.exec(after);
	if (range) {
		end = readTime(after.slice(range[0].length), start.meridiem ? "end" : "none");
		if (!end) {
			return null;
		}
		after = after.slice(range[0].length + end.length);
	}
	if (after !== "" && !/^\s/.test(after)) {
		return null;
	}
	const rest = after.trim();
	if (!end) {
		return { start: start.minutes, end: null, rest, malformed: false };
	}
	if (end.minutes <= start.minutes) {
		return { start: start.minutes, end: null, rest, malformed: true };
	}
	return { start: start.minutes, end: end.minutes, rest, malformed: false };
}

export function formatTimeBlock(start: Minutes, end: Minutes | null, rest: string): string {
	const times = end === null ? formatTime(start) : `${formatTime(start)} - ${formatTime(end)}`;
	return rest ? `${times} ${rest}` : times;
}

/** Removes a leading time block, leaving the rest of the text. */
export function stripTimeBlock(text: string): string {
	return parseTimeBlock(text)?.rest ?? text;
}

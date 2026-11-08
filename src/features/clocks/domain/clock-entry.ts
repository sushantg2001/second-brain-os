import {
	addDays,
	compareDates,
	daysBetween,
	formatTime,
	fromParts,
	isIsoDate,
	MINUTES_PER_DAY,
	parseTime,
	type Clock,
	type IsoDate,
	type Minutes,
	type NowSnapshot,
} from "../../../shared/kernel";

const SECONDS_PER_DAY = MINUTES_PER_DAY * 60;

/**
 * A local date and minute, written as 2026-10-29T09:30 or, to the second, 2026-10-29T09:30:15.
 * `seconds` is set only when the stamp was written with seconds, so a stamp keeps its precision
 * when it is read and written back.
 */
export type Moment = NowSnapshot & { readonly seconds?: number };

export interface ClockEntry {
	readonly start: Moment;
	/** Null while the clock is running. */
	readonly end: Moment | null;
}

const STAMP = "(\\d{4}-\\d{2}-\\d{2})T(\\d{2}:\\d{2})(?::(\\d{2}))?";
const ENTRY = new RegExp(`\\[clock::\\s*${STAMP}\\s*--\\s*(?:${STAMP})?\\s*\\]`, "i");

function moment(
	date: string | undefined,
	time: string | undefined,
	seconds: string | undefined,
): Moment | null {
	const minutes = parseTime(time ?? "");
	if (!date || !isIsoDate(date) || minutes === null || minutes >= MINUTES_PER_DAY) {
		return null;
	}
	if (seconds === undefined) {
		return { date, minutes };
	}
	return Number(seconds) < 60 ? { date, minutes, seconds: Number(seconds) } : null;
}

/** Seconds since midnight, to the second. */
function secondsOfDay(value: Moment): number {
	return value.minutes * 60 + (value.seconds ?? 0);
}

/** The current local date, minute and second, read once so they always agree. */
export function momentNow(clock: Clock): Moment {
	const at = new Date(clock.now());
	return {
		date: fromParts(at.getFullYear(), at.getMonth() + 1, at.getDate()),
		minutes: at.getHours() * 60 + at.getMinutes(),
		seconds: at.getSeconds(),
	};
}

export function parseClockEntry(text: string): ClockEntry | null {
	const match = ENTRY.exec(text);
	if (!match) {
		return null;
	}
	const start = moment(match[1], match[2], match[3]);
	if (!start) {
		return null;
	}
	if (match[4] === undefined) {
		return { start, end: null };
	}
	const end = moment(match[4], match[5], match[6]);
	return end && minutesBetween(start, end) >= 0 ? { start, end } : null;
}

export function formatMoment(value: Moment): string {
	const seconds = value.seconds === undefined ? "" : `:${String(value.seconds).padStart(2, "0")}`;
	return `${value.date}T${formatTime(value.minutes)}${seconds}`;
}

export function formatClockEntry(entry: ClockEntry): string {
	return `[clock::${formatMoment(entry.start)}--${entry.end ? formatMoment(entry.end) : ""}]`;
}

/** Minutes from one moment to another. Fractional when either one has seconds. */
export function minutesBetween(from: Moment, to: Moment): Minutes {
	const seconds =
		daysBetween(from.date, to.date) * SECONDS_PER_DAY + secondsOfDay(to) - secondsOfDay(from);
	return seconds / 60;
}

/** Length of an entry; a running entry counts up to `now`. */
export function entryMinutes(entry: ClockEntry, now: Moment): Minutes {
	return Math.max(0, minutesBetween(entry.start, entry.end ?? now));
}

/** Minutes of an entry that fall on `date`. */
export function minutesOnDate(entry: ClockEntry, date: IsoDate, now: Moment): Minutes {
	const end = entry.end ?? now;
	if (compareDates(date, entry.start.date) < 0 || compareDates(date, end.date) > 0) {
		return 0;
	}
	const from = entry.start.date === date ? secondsOfDay(entry.start) : 0;
	const to = end.date === date ? secondsOfDay(end) : SECONDS_PER_DAY;
	return Math.max(0, to - from) / 60;
}

/** The parts of an entry on one day, as minute ranges for drawing on a timeline. */
export function rangeOnDate(
	entry: ClockEntry,
	date: IsoDate,
	now: Moment,
): { start: Minutes; end: Minutes } | null {
	const minutes = minutesOnDate(entry, date, now);
	if (minutes === 0) {
		return null;
	}
	const start = entry.start.date === date ? secondsOfDay(entry.start) / 60 : 0;
	return { start, end: start + minutes };
}

/** Every date an entry touches. */
export function datesOf(entry: ClockEntry, now: Moment): IsoDate[] {
	const end = (entry.end ?? now).date;
	const dates: IsoDate[] = [];
	for (let date = entry.start.date; compareDates(date, end) <= 0; date = addDays(date, 1)) {
		dates.push(date);
	}
	return dates;
}

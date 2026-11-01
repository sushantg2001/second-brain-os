import {
	addDays,
	compareDates,
	daysBetween,
	formatTime,
	isIsoDate,
	MINUTES_PER_DAY,
	parseTime,
	type IsoDate,
	type Minutes,
	type NowSnapshot,
} from "../../../shared/kernel";

/** A local date and minute, written as 2026-10-29T09:30. */
export type Moment = NowSnapshot;

export interface ClockEntry {
	readonly start: Moment;
	/** Null while the clock is running. */
	readonly end: Moment | null;
}

const STAMP = "(\\d{4}-\\d{2}-\\d{2})T(\\d{2}:\\d{2})";
const ENTRY = new RegExp(`\\[clock::\\s*${STAMP}\\s*--\\s*(?:${STAMP})?\\s*\\]`, "i");

function moment(date: string | undefined, time: string | undefined): Moment | null {
	const minutes = parseTime(time ?? "");
	return date && isIsoDate(date) && minutes !== null && minutes < MINUTES_PER_DAY
		? { date, minutes }
		: null;
}

export function parseClockEntry(text: string): ClockEntry | null {
	const match = ENTRY.exec(text);
	if (!match) {
		return null;
	}
	const start = moment(match[1], match[2]);
	if (!start) {
		return null;
	}
	if (match[3] === undefined) {
		return { start, end: null };
	}
	const end = moment(match[3], match[4]);
	return end && minutesBetween(start, end) >= 0 ? { start, end } : null;
}

export function formatMoment(value: Moment): string {
	return `${value.date}T${formatTime(value.minutes)}`;
}

export function formatClockEntry(entry: ClockEntry): string {
	return `[clock::${formatMoment(entry.start)}--${entry.end ? formatMoment(entry.end) : ""}]`;
}

export function minutesBetween(from: Moment, to: Moment): Minutes {
	return daysBetween(from.date, to.date) * MINUTES_PER_DAY + to.minutes - from.minutes;
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
	const from = entry.start.date === date ? entry.start.minutes : 0;
	const to = end.date === date ? end.minutes : MINUTES_PER_DAY;
	return Math.max(0, to - from);
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
	const start = entry.start.date === date ? entry.start.minutes : 0;
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

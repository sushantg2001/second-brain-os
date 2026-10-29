import {
	addDays,
	addMonths,
	dayOfWeek,
	fromParts,
	toParts,
	type IsoDate,
} from "../../../shared/kernel";
import type { Granularity } from "./granularity";

/** First day of the period that contains `date`. `weekStart` is 0 (Sunday) to 6. */
export function periodStart(date: IsoDate, granularity: Granularity, weekStart: number): IsoDate {
	const { year, month } = toParts(date);
	switch (granularity) {
		case "day":
			return date;
		case "week":
			return addDays(date, -((dayOfWeek(date) - weekStart + 7) % 7));
		case "month":
			return fromParts(year, month, 1);
		case "quarter":
			return fromParts(year, month - ((month - 1) % 3), 1);
		case "year":
			return fromParts(year, 1, 1);
	}
}

/** Moves a date by whole periods. Months clamp, so Jan 31 + 1 month is the last day of Feb. */
export function shiftPeriod(date: IsoDate, granularity: Granularity, count: number): IsoDate {
	switch (granularity) {
		case "day":
			return addDays(date, count);
		case "week":
			return addDays(date, count * 7);
		case "month":
			return addMonths(date, count);
		case "quarter":
			return addMonths(date, count * 3);
		case "year":
			return addMonths(date, count * 12);
	}
}

/** Last day of the period that contains `date`. */
export function periodEnd(date: IsoDate, granularity: Granularity, weekStart: number): IsoDate {
	return addDays(shiftPeriod(periodStart(date, granularity, weekStart), granularity, 1), -1);
}

export function samePeriod(
	a: IsoDate,
	b: IsoDate,
	granularity: Granularity,
	weekStart: number,
): boolean {
	return periodStart(a, granularity, weekStart) === periodStart(b, granularity, weekStart);
}

/** Weeks of a month view: each row has 7 dates, starting on `weekStart`, covering the month. */
export function monthGrid(year: number, month: number, weekStart: number): IsoDate[][] {
	const first = fromParts(year, month, 1);
	const last = addDays(addMonths(first, 1), -1);
	let cursor = periodStart(first, "week", weekStart);
	const weeks: IsoDate[][] = [];
	while (cursor <= last) {
		weeks.push(Array.from({ length: 7 }, (_, index) => addDays(cursor, index)));
		cursor = addDays(cursor, 7);
	}
	return weeks;
}

/** The closest date before or after `current` in `dates`, or null. */
export function adjacentDate(
	dates: Iterable<IsoDate>,
	current: IsoDate,
	direction: "next" | "prev",
): IsoDate | null {
	let best: IsoDate | null = null;
	for (const date of dates) {
		if (
			direction === "next"
				? date > current && (best === null || date < best)
				: date < current && (best === null || date > best)
		) {
			best = date;
		}
	}
	return best;
}

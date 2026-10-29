/**
 * Calendar dates as ISO strings (YYYY-MM-DD) with no time zone. Pure maths on top of
 * Date.UTC, so results never shift with the user's offset or daylight saving.
 */
export type IsoDate = string;

export interface DateParts {
	readonly year: number;
	/** 1 to 12 */
	readonly month: number;
	readonly day: number;
}

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function pad(value: number, width = 2): string {
	return String(value).padStart(width, "0");
}

function fromUtc(ms: number): IsoDate {
	const date = new Date(ms);
	return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function toUtc(iso: IsoDate): number {
	const { year, month, day } = toParts(iso);
	return Date.UTC(year, month - 1, day);
}

export function isIsoDate(value: string): boolean {
	const match = ISO_PATTERN.exec(value);
	if (!match) {
		return false;
	}
	const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
	return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function toParts(iso: IsoDate): DateParts {
	const match = ISO_PATTERN.exec(iso);
	if (!match) {
		throw new RangeError(`Not an ISO date: ${iso}`);
	}
	const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
	return { year, month, day };
}

/** Builds a date, rolling overflow forward (month 13 is January of the next year). */
export function fromParts(year: number, month: number, day: number): IsoDate {
	const date = new Date(Date.UTC(2000, month - 1, day));
	date.setUTCFullYear(year + (date.getUTCFullYear() - 2000));
	return fromUtc(date.getTime());
}

export function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addDays(iso: IsoDate, days: number): IsoDate {
	return fromUtc(toUtc(iso) + days * DAY_MS);
}

/** Adds months, clamping the day to the end of a shorter month (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(iso: IsoDate, months: number): IsoDate {
	const { year, month, day } = toParts(iso);
	const index = year * 12 + (month - 1) + months;
	const targetYear = Math.floor(index / 12);
	const targetMonth = (index % 12) + 1;
	return `${pad(targetYear, 4)}-${pad(targetMonth)}-${pad(Math.min(day, daysInMonth(targetYear, targetMonth)))}`;
}

/** 0 is Sunday, 6 is Saturday. */
export function dayOfWeek(iso: IsoDate): number {
	return new Date(toUtc(iso)).getUTCDay();
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
	return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export function compareDates(a: IsoDate, b: IsoDate): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

/** Inclusive list of dates from `from` to `to`. Empty when `to` is before `from`. */
export function dateRange(from: IsoDate, to: IsoDate): IsoDate[] {
	const count = daysBetween(from, to);
	return Array.from({ length: Math.max(0, count + 1) }, (_, index) => addDays(from, index));
}

import { describe, expect, it } from "bun:test";
import fc from "fast-check";

import {
	adjacentDate,
	GRANULARITIES,
	monthGrid,
	periodEnd,
	periodStart,
	resolveWeekStart,
	samePeriod,
	shiftPeriod,
} from "../../../src/features/periodic";
import { addDays, dayOfWeek, daysBetween, toParts } from "../../../src/shared/kernel";

const isoDate = fc
	.date({
		min: new Date(Date.UTC(1950, 0, 1)),
		max: new Date(Date.UTC(2150, 11, 31)),
		noInvalidDate: true,
	})
	.map((date) => date.toISOString().slice(0, 10));
const granularity = fc.constantFrom(...GRANULARITIES);
const weekStart = fc.integer({ min: 0, max: 6 });

describe("periods", () => {
	it("finds the start of each period", () => {
		expect(periodStart("2026-10-29", "day", 1)).toBe("2026-10-29");
		expect(periodStart("2026-10-29", "week", 1)).toBe("2026-10-26");
		expect(periodStart("2026-10-29", "week", 0)).toBe("2026-10-25");
		expect(periodStart("2026-10-29", "month", 1)).toBe("2026-10-01");
		expect(periodStart("2026-10-29", "quarter", 1)).toBe("2026-10-01");
		expect(periodStart("2026-08-15", "quarter", 1)).toBe("2026-07-01");
		expect(periodStart("2026-10-29", "year", 1)).toBe("2026-01-01");
	});

	it("finds the end of each period", () => {
		expect(periodEnd("2024-02-10", "month", 1)).toBe("2024-02-29");
		expect(periodEnd("2026-11-02", "quarter", 1)).toBe("2026-12-31");
		expect(periodEnd("2026-10-29", "week", 1)).toBe("2026-11-01");
	});

	it("compares periods", () => {
		expect(samePeriod("2026-10-26", "2026-11-01", "week", 1)).toBe(true);
		expect(samePeriod("2026-10-25", "2026-10-26", "week", 1)).toBe(false);
	});

	it("resolves week start settings", () => {
		expect(resolveWeekStart("locale", 3)).toBe(3);
		expect(resolveWeekStart("sunday", 3)).toBe(0);
		expect(resolveWeekStart("saturday", 3)).toBe(6);
	});

	it("puts every date inside its own period", () => {
		fc.assert(
			fc.property(isoDate, granularity, weekStart, (date, unit, start) => {
				const first = periodStart(date, unit, start);
				const last = periodEnd(date, unit, start);
				expect(first <= date && date <= last).toBe(true);
				expect(periodStart(first, unit, start)).toBe(first);
				expect(periodStart(last, unit, start)).toBe(first);
				expect(periodStart(addDays(last, 1), unit, start)).toBe(addDays(last, 1));
			}),
		);
	});

	it("starts weeks on the chosen weekday", () => {
		fc.assert(
			fc.property(isoDate, weekStart, (date, start) => {
				expect(dayOfWeek(periodStart(date, "week", start))).toBe(start);
			}),
		);
	});

	it("shifts period starts forwards and back", () => {
		fc.assert(
			fc.property(
				isoDate,
				granularity,
				weekStart,
				fc.integer({ min: -50, max: 50 }),
				(date, unit, start, count) => {
					const first = periodStart(date, unit, start);
					const moved = shiftPeriod(first, unit, count);
					expect(periodStart(moved, unit, start)).toBe(moved);
					expect(shiftPeriod(moved, unit, -count)).toBe(first);
				},
			),
		);
	});
});

describe("monthGrid", () => {
	it("covers the month in whole weeks", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 1950, max: 2150 }),
				fc.integer({ min: 1, max: 12 }),
				weekStart,
				(year, month, start) => {
					const weeks = monthGrid(year, month, start);
					expect(weeks.length).toBeGreaterThanOrEqual(4);
					expect(weeks.length).toBeLessThanOrEqual(6);
					const days = weeks.flat();
					expect(dayOfWeek(days[0] ?? "")).toBe(start);
					expect(daysBetween(days[0] ?? "", days.at(-1) ?? "")).toBe(days.length - 1);
					const inMonth = days.filter((day) => toParts(day).month === month);
					expect(inMonth[0]).toBe(`${year}-${String(month).padStart(2, "0")}-01`);
					expect(new Set(inMonth).size).toBe(inMonth.length);
				},
			),
		);
	});

	it("matches a known month", () => {
		// February 2026 starts on a Sunday, so a Monday-first grid needs five rows.
		const weeks = monthGrid(2026, 2, 1);
		expect(weeks).toHaveLength(5);
		expect(weeks[0]?.[0]).toBe("2026-01-26");
		expect(weeks.at(-1)?.at(-1)).toBe("2026-03-01");
		// February 2021 starts on a Monday and has 28 days: exactly four rows.
		expect(monthGrid(2021, 2, 1)).toHaveLength(4);
	});
});

describe("adjacentDate", () => {
	const dates = ["2026-01-05", "2026-01-01", "2026-01-10"];

	it("finds the closest date in each direction", () => {
		expect(adjacentDate(dates, "2026-01-05", "next")).toBe("2026-01-10");
		expect(adjacentDate(dates, "2026-01-05", "prev")).toBe("2026-01-01");
		expect(adjacentDate(dates, "2026-01-03", "next")).toBe("2026-01-05");
	});

	it("returns null at the ends", () => {
		expect(adjacentDate(dates, "2026-01-10", "next")).toBeNull();
		expect(adjacentDate(dates, "2026-01-01", "prev")).toBeNull();
		expect(adjacentDate([], "2026-01-01", "prev")).toBeNull();
	});
});

import { describe, expect, it } from "bun:test";
import fc from "fast-check";

import {
	addDays,
	addMonths,
	compareDates,
	dateRange,
	dayOfWeek,
	daysBetween,
	daysInMonth,
	fromParts,
	isIsoDate,
	toParts,
} from "../../../src/shared/kernel";

const isoDate = fc
	.date({
		min: new Date(Date.UTC(1900, 0, 1)),
		max: new Date(Date.UTC(2200, 11, 31)),
		noInvalidDate: true,
	})
	.map((date) => date.toISOString().slice(0, 10));

describe("ISO dates", () => {
	it("validates real calendar dates only", () => {
		expect(isIsoDate("2024-02-29")).toBe(true);
		expect(isIsoDate("2023-02-29")).toBe(false);
		expect(isIsoDate("2024-13-01")).toBe(false);
		expect(isIsoDate("2024-1-01")).toBe(false);
		expect(() => toParts("nope")).toThrow(RangeError);
	});

	it("rolls overflow forward when building from parts", () => {
		expect(fromParts(2024, 13, 1)).toBe("2025-01-01");
		expect(fromParts(2024, 3, 0)).toBe("2024-02-29");
		expect(fromParts(99, 1, 1)).toBe("0099-01-01");
	});

	it("counts days in months", () => {
		expect(daysInMonth(2024, 2)).toBe(29);
		expect(daysInMonth(1900, 2)).toBe(28);
		expect(daysInMonth(2024, 12)).toBe(31);
	});

	it("adds days across month and year boundaries", () => {
		expect(addDays("2024-12-31", 1)).toBe("2025-01-01");
		expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
	});

	it("adds months and clamps the day", () => {
		expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
		expect(addMonths("2024-03-31", -1)).toBe("2024-02-29");
		expect(addMonths("2024-11-15", 3)).toBe("2025-02-15");
		expect(addMonths("2024-01-15", -13)).toBe("2022-12-15");
	});

	it("knows the weekday", () => {
		expect(dayOfWeek("2026-10-29")).toBe(4);
		expect(dayOfWeek("2000-01-02")).toBe(0);
	});

	it("compares and ranges", () => {
		expect(compareDates("2024-01-01", "2024-01-02")).toBe(-1);
		expect(compareDates("2024-01-02", "2024-01-01")).toBe(1);
		expect(compareDates("2024-01-01", "2024-01-01")).toBe(0);
		expect(dateRange("2024-02-28", "2024-03-01")).toEqual([
			"2024-02-28",
			"2024-02-29",
			"2024-03-01",
		]);
		expect(dateRange("2024-03-01", "2024-02-28")).toEqual([]);
	});

	it("keeps addDays and daysBetween consistent", () => {
		fc.assert(
			fc.property(isoDate, fc.integer({ min: -5000, max: 5000 }), (date, days) => {
				const moved = addDays(date, days);
				expect(isIsoDate(moved)).toBe(true);
				expect(daysBetween(date, moved)).toBe(days);
				expect(addDays(moved, -days)).toBe(date);
			}),
		);
	});

	it("advances the weekday by the number of days added", () => {
		fc.assert(
			fc.property(isoDate, fc.integer({ min: -400, max: 400 }), (date, days) => {
				expect(dayOfWeek(addDays(date, days))).toBe(
					(((dayOfWeek(date) + days) % 7) + 7) % 7,
				);
			}),
		);
	});

	it("always lands on a valid date when adding months", () => {
		fc.assert(
			fc.property(isoDate, fc.integer({ min: -240, max: 240 }), (date, months) => {
				const moved = addMonths(date, months);
				expect(isIsoDate(moved)).toBe(true);
				const from = toParts(date);
				const to = toParts(moved);
				expect(to.year * 12 + to.month - (from.year * 12 + from.month)).toBe(months);
			}),
		);
	});
});

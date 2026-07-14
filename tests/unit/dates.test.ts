import { describe, expect, it } from "vitest";
import { moment } from "obsidian";

import {
	findAdjacentDate,
	getMonthGrid,
	getWeekdayNames,
	resolveWeekStart,
} from "../../src/utils/dates";

describe("resolveWeekStart", () => {
	it("maps weekday names to indices", () => {
		expect(resolveWeekStart("sunday")).toBe(0);
		expect(resolveWeekStart("monday")).toBe(1);
		expect(resolveWeekStart("saturday")).toBe(6);
	});

	it("uses the locale first day of week for locale", () => {
		expect(resolveWeekStart("locale")).toBe(
			moment.localeData().firstDayOfWeek(),
		);
	});
});

describe("getWeekdayNames", () => {
	it("starts with the configured weekday", () => {
		expect(getWeekdayNames("monday")[0]).toBe("Mon");
		expect(getWeekdayNames("sunday")[0]).toBe("Sun");
	});

	it("returns seven names", () => {
		expect(getWeekdayNames("wednesday")).toHaveLength(7);
	});
});

describe("getMonthGrid", () => {
	it("returns rows of seven days", () => {
		const grid = getMonthGrid(moment("2024-01-15"), "monday");
		for (const week of grid) {
			expect(week).toHaveLength(7);
		}
	});

	it("starts on the first of the month when it matches the week start", () => {
		const grid = getMonthGrid(moment("2024-01-15"), "monday");
		expect(grid[0]?.[0]?.format("YYYY-MM-DD")).toBe("2024-01-01");
		expect(grid).toHaveLength(5);
	});

	it("pads the first week with days from the previous month", () => {
		const grid = getMonthGrid(moment("2024-01-15"), "sunday");
		expect(grid[0]?.[0]?.format("YYYY-MM-DD")).toBe("2023-12-31");
	});

	it("covers the entire month", () => {
		const grid = getMonthGrid(moment("2024-02-10"), "sunday");
		const lastWeek = grid[grid.length - 1];
		const lastDay = lastWeek?.[lastWeek.length - 1];
		expect(lastDay?.isSameOrAfter(moment("2024-02-29"), "day")).toBe(true);
	});
});

describe("findAdjacentDate", () => {
	const dates = [
		moment("2024-01-01"),
		moment("2024-03-01"),
		moment("2024-02-01"),
	];

	it("finds the next date after the current one", () => {
		const next = findAdjacentDate(dates, moment("2024-01-15"), "next");
		expect(next?.format("YYYY-MM-DD")).toBe("2024-02-01");
	});

	it("finds the previous date before the current one", () => {
		const prev = findAdjacentDate(dates, moment("2024-02-15"), "prev");
		expect(prev?.format("YYYY-MM-DD")).toBe("2024-02-01");
	});

	it("returns null when nothing exists in that direction", () => {
		expect(findAdjacentDate(dates, moment("2024-04-01"), "next")).toBeNull();
		expect(findAdjacentDate(dates, moment("2023-12-01"), "prev")).toBeNull();
	});

	it("excludes the current date itself", () => {
		const next = findAdjacentDate(dates, moment("2024-03-01"), "next");
		expect(next).toBeNull();
	});
});

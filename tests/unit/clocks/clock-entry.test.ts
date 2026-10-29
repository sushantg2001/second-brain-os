import { describe, expect, it } from "bun:test";
import fc from "fast-check";

import {
	childIndent,
	closeClockLine,
	clocksOf,
	datesOf,
	entryMinutes,
	formatClockEntry,
	minutesBetween,
	minutesOnDate,
	openClockLine,
	parseClockEntry,
	rangeOnDate,
} from "../../../src/features/clocks";
import { parseTasks } from "../../../src/features/tasks";
import { addDays } from "../../../src/shared/kernel";

const now = { date: "2026-10-29", minutes: 12 * 60 };

describe("clock entries", () => {
	it("parses closed and running entries", () => {
		expect(parseClockEntry("[clock::2026-10-29T09:00--2026-10-29T10:15]")).toEqual({
			start: { date: "2026-10-29", minutes: 540 },
			end: { date: "2026-10-29", minutes: 615 },
		});
		expect(parseClockEntry("note [clock:: 2026-10-29T09:00 -- ] more")).toEqual({
			start: { date: "2026-10-29", minutes: 540 },
			end: null,
		});
	});

	it("rejects malformed entries", () => {
		expect(parseClockEntry("[clock::2026-10-29T10:00--2026-10-29T09:00]")).toBeNull();
		expect(parseClockEntry("[clock::2026-02-30T10:00--]")).toBeNull();
		expect(parseClockEntry("[clock::2026-10-29T24:00--]")).toBeNull();
		expect(parseClockEntry("[clock::2026-10-29T09:00--2026-13-01T09:00]")).toBeNull();
		expect(parseClockEntry("no clock")).toBeNull();
	});

	it("round-trips formatting", () => {
		const moment = fc.record({
			date: fc
				.date({
					min: new Date(Date.UTC(2000, 0, 1)),
					max: new Date(Date.UTC(2100, 0, 1)),
					noInvalidDate: true,
				})
				.map((date) => date.toISOString().slice(0, 10)),
			minutes: fc.integer({ min: 0, max: 1439 }),
		});
		fc.assert(
			fc.property(
				moment,
				fc.integer({ min: 0, max: 5000 }),
				fc.boolean(),
				(start, length, running) => {
					const endMinutes = start.minutes + length;
					const end = running
						? null
						: {
								date: addDays(start.date, Math.floor(endMinutes / 1440)),
								minutes: endMinutes % 1440,
							};
					const entry = { start, end };
					expect(parseClockEntry(formatClockEntry(entry))).toEqual(entry);
					if (end) {
						expect(minutesBetween(start, end)).toBe(length);
					}
				},
			),
		);
	});

	it("measures entries, counting a running one up to now", () => {
		expect(entryMinutes({ start: { date: "2026-10-29", minutes: 540 }, end: null }, now)).toBe(
			180,
		);
		expect(entryMinutes({ start: { date: "2026-10-30", minutes: 540 }, end: null }, now)).toBe(
			0,
		);
	});

	it("splits an entry across midnight", () => {
		const entry = {
			start: { date: "2026-10-28", minutes: 23 * 60 },
			end: { date: "2026-10-29", minutes: 60 },
		};
		expect(minutesOnDate(entry, "2026-10-28", now)).toBe(60);
		expect(minutesOnDate(entry, "2026-10-29", now)).toBe(60);
		expect(minutesOnDate(entry, "2026-10-30", now)).toBe(0);
		expect(rangeOnDate(entry, "2026-10-28", now)).toEqual({ start: 1380, end: 1440 });
		expect(rangeOnDate(entry, "2026-10-29", now)).toEqual({ start: 0, end: 60 });
		expect(rangeOnDate(entry, "2026-10-27", now)).toBeNull();
		expect(datesOf(entry, now)).toEqual(["2026-10-28", "2026-10-29"]);
	});

	it("sums per-day minutes to the whole entry", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 0, max: 1439 }),
				fc.integer({ min: 0, max: 4000 }),
				(start, length) => {
					const end = start + length;
					const entry = {
						start: { date: "2026-10-01", minutes: start },
						end: {
							date: addDays("2026-10-01", Math.floor(end / 1440)),
							minutes: end % 1440,
						},
					};
					const total = datesOf(entry, now).reduce(
						(sum, date) => sum + minutesOnDate(entry, date, now),
						0,
					);
					expect(total).toBe(length);
				},
			),
		);
	});
});

function at<T>(items: readonly T[], index: number): T {
	const item = items[index];
	if (item === undefined) {
		throw new Error(`No item ${index}`);
	}
	return item;
}

describe("clock lines under tasks", () => {
	const tasks = parseTasks(
		"a.md",
		[
			"- [ ] Write",
			"\t- [clock::2026-10-29T09:00--2026-10-29T09:30]",
			"\t- [clock::2026-10-29T11:00--]",
			"\t- not a clock",
			"- [ ] Other",
			"  - [ ] spaced child",
		].join("\n"),
	);

	it("finds entries among children", () => {
		expect(clocksOf(at(tasks, 0)).map((clock) => [clock.line, clock.end === null])).toEqual([
			[1, false],
			[2, true],
		]);
	});

	it("indents new children like existing ones, or by the note's style", () => {
		expect(childIndent(at(tasks, 0), "")).toBe("\t");
		expect(childIndent(at(tasks, 1), "")).toBe("  ");
		const lone = at(parseTasks("b.md", "  - [ ] Nested\n"), 0);
		expect(childIndent(lone, "  - [ ] Nested\n    - x")).toBe("      ");
		expect(childIndent(lone, "\t- x")).toBe("  \t");
	});

	it("writes and closes clock lines", () => {
		const open = openClockLine("\t", { date: "2026-10-29", minutes: 600 });
		expect(open).toBe("\t- [clock::2026-10-29T10:00--]");
		expect(closeClockLine(open, { date: "2026-10-29", minutes: 645 })).toBe(
			"\t- [clock::2026-10-29T10:00--2026-10-29T10:45]",
		);
		expect(closeClockLine("\t- [clock::2026-10-29T10:00--2026-10-29T10:45]", now)).toBeNull();
	});
});

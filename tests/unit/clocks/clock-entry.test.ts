import { describe, expect, it } from "bun:test";
import fc from "fast-check";

import {
	clockIndent,
	clockInsertLine,
	closeClockLine,
	clocksOf,
	clocksWithin,
	datesOf,
	entryMinutes,
	formatClockEntry,
	minutesBetween,
	minutesOnDate,
	momentNow,
	openClockLine,
	parseClockEntry,
	rangeOnDate,
} from "../../../src/features/clocks";
import { parseTasks } from "../../../src/features/tasks";
import { addDays } from "../../../src/shared/kernel";
import { FixedClock } from "../../fakes/fixed-clock";

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

describe("clock stamps with seconds", () => {
	it("parses seconds and keeps them", () => {
		const entry = parseClockEntry("[clock::2026-10-29T00:30:20--2026-10-29T09:55:29]");
		expect(entry).toEqual({
			start: { date: "2026-10-29", minutes: 30, seconds: 20 },
			end: { date: "2026-10-29", minutes: 595, seconds: 29 },
		});
		expect(entry && entryMinutes(entry, now)).toBeCloseTo(565.15, 5);
	});

	it("leaves minute-only stamps without a seconds field", () => {
		const entry = parseClockEntry("[clock::2026-10-29T09:00--2026-10-29T09:30]");
		expect(entry).toEqual({
			start: { date: "2026-10-29", minutes: 540 },
			end: { date: "2026-10-29", minutes: 570 },
		});
		expect(entry?.start).not.toHaveProperty("seconds");
	});

	it("reads a running clock and mixed precision", () => {
		expect(parseClockEntry("[clock::2026-10-29T09:05:12--]")).toEqual({
			start: { date: "2026-10-29", minutes: 545, seconds: 12 },
			end: null,
		});
		const mixed = parseClockEntry("[clock::2026-10-29T09:00--2026-10-29T09:30:15]");
		expect(mixed?.start).not.toHaveProperty("seconds");
		expect(mixed?.end?.seconds).toBe(15);
		expect(mixed && formatClockEntry(mixed)).toBe(
			"[clock::2026-10-29T09:00--2026-10-29T09:30:15]",
		);
	});

	it("rejects bad seconds, and an end that is earlier by seconds", () => {
		expect(parseClockEntry("[clock::2026-10-29T09:00:60--]")).toBeNull();
		expect(parseClockEntry("[clock::2026-10-29T09:00:5--]")).toBeNull();
		expect(parseClockEntry("[clock::2026-10-29T09:00:ab--]")).toBeNull();
		expect(parseClockEntry("[clock::2026-10-29T09:00:30--2026-10-29T09:00:10]")).toBeNull();
		expect(parseClockEntry("[clock::2026-10-29T09:00:10--2026-10-29T09:00:10]")).not.toBeNull();
	});

	it("tolerates spaces around the stamps", () => {
		expect(
			parseClockEntry("[clock:: 2026-10-29T09:00:00 -- 2026-10-29T09:10:00 ]")?.end?.minutes,
		).toBe(550);
	});

	it("splits an entry that crosses midnight, to the second", () => {
		const entry = parseClockEntry("[clock::2026-10-26T21:06:26--2026-10-27T00:00:44]");
		if (!entry) {
			throw new Error("not parsed");
		}
		expect(minutesOnDate(entry, "2026-10-26", now)).toBeCloseTo(173 + 34 / 60, 5);
		expect(minutesOnDate(entry, "2026-10-27", now)).toBeCloseTo(44 / 60, 5);
		expect(entryMinutes(entry, now)).toBeCloseTo(174.3, 5);
		expect(rangeOnDate(entry, "2026-10-26", now)).toEqual({
			start: 21 * 60 + 6 + 26 / 60,
			end: 1440,
		});
		expect(rangeOnDate(entry, "2026-10-27", now)?.start).toBe(0);
	});

	it("round-trips any stamp with seconds", () => {
		const moment = fc.record({
			date: fc
				.date({
					min: new Date(Date.UTC(2000, 0, 1)),
					max: new Date(Date.UTC(2100, 0, 1)),
					noInvalidDate: true,
				})
				.map((date) => date.toISOString().slice(0, 10)),
			minutes: fc.integer({ min: 0, max: 1439 }),
			seconds: fc.integer({ min: 0, max: 59 }),
		});
		fc.assert(
			fc.property(
				moment,
				fc.integer({ min: 0, max: 400000 }),
				fc.boolean(),
				(start, length, running) => {
					const total = start.minutes * 60 + start.seconds + length;
					const end = running
						? null
						: {
								date: addDays(start.date, Math.floor(total / 86400)),
								minutes: Math.floor((total % 86400) / 60),
								seconds: total % 60,
							};
					const entry = { start, end };
					expect(parseClockEntry(formatClockEntry(entry))).toEqual(entry);
					if (end) {
						expect(minutesBetween(start, end) * 60).toBeCloseTo(length, 5);
					}
				},
			),
		);
	});

	it("reads the current moment to the second from the clock", () => {
		const clock = new FixedClock("2026-10-29", 9 * 60 + 5);
		expect(momentNow(clock)).toEqual({ date: "2026-10-29", minutes: 545, seconds: 0 });
	});
});

describe("clock lines under tasks", () => {
	const tasks = parseTasks(
		"a.md",
		[
			"- [ ] Write",
			"\t[clock::2026-10-29T09:00:15--2026-10-29T09:30:15]",
			"\t- [clock::2026-10-29T11:00--]",
			"\t- not a clock",
			"- [ ] Other",
			"  - [ ] spaced child",
		].join("\n"),
	);

	it("finds entries written with or without a bullet, each once", () => {
		expect(clocksOf(at(tasks, 0)).map((clock) => [clock.line, clock.end === null])).toEqual([
			[1, false],
			[2, true],
		]);
	});

	it("separates a task's own clocks from those of tasks nested under it", () => {
		const nested = parseTasks(
			"b.md",
			[
				"- [ ] Main",
				"\t[clock::2026-10-29T08:00:00--2026-10-29T08:10:00]",
				"\t- [ ] Sub",
				"\t\t[clock::2026-10-29T09:00:00--2026-10-29T09:20:00]",
				"\t\t- [clock::2026-10-29T10:00--2026-10-29T10:05]",
			].join("\n"),
		);
		expect(clocksOf(at(nested, 0)).map((clock) => clock.line)).toEqual([1]);
		expect(clocksOf(at(nested, 1)).map((clock) => clock.line)).toEqual([3, 4]);
		expect(clocksWithin(at(nested, 0)).map((clock) => clock.line)).toEqual([1, 3, 4]);
	});

	it("indents a new clock line one tab under the task", () => {
		expect(clockIndent(at(tasks, 0))).toBe("\t");
		expect(clockIndent(at(tasks, 2))).toBe("  \t");
		expect(clockIndent(at(parseTasks("c.md", "\t- [ ] Nested\n"), 0))).toBe("\t\t");
		expect(clockIndent(at(parseTasks("d.md", "1. [ ] Numbered\n"), 0))).toBe("\t");
	});

	it("inserts below the task and the continuation lines already under it", () => {
		expect(clockInsertLine(at(tasks, 0))).toBe(2);
		expect(clockInsertLine(at(tasks, 1))).toBe(5);
		const spaced = parseTasks(
			"e.md",
			[
				"- [ ] A",
				"\tsee notes",
				"\t[clock::2026-10-29T09:00--2026-10-29T09:10]",
				"",
				"\tlater",
			].join("\n"),
		);
		expect(clockInsertLine(at(spaced, 0))).toBe(3);
	});

	it("writes a running clock line with no bullet", () => {
		const open = openClockLine("\t", { date: "2026-10-29", minutes: 600, seconds: 7 });
		expect(open).toBe("\t[clock::2026-10-29T10:00:07--]");
		expect(parseClockEntry(open)?.end).toBeNull();
	});

	it("closes a clock to the precision it was started with", () => {
		const end = { date: "2026-10-29", minutes: 645, seconds: 40 };
		expect(closeClockLine("\t[clock::2026-10-29T10:00:07--]", end)).toBe(
			"\t[clock::2026-10-29T10:00:07--2026-10-29T10:45:40]",
		);
		expect(
			closeClockLine("\t[clock::2026-10-29T10:00:07--]", {
				date: end.date,
				minutes: end.minutes,
			}),
		).toBe("\t[clock::2026-10-29T10:00:07--2026-10-29T10:45:00]");
		// An older minute-only line stays minute-only, and keeps its bullet.
		expect(closeClockLine("\t- [clock::2026-10-29T10:00--]", end)).toBe(
			"\t- [clock::2026-10-29T10:00--2026-10-29T10:45]",
		);
		expect(
			closeClockLine("\t[clock::2026-10-29T10:00:07--2026-10-29T10:45:40]", now),
		).toBeNull();
	});
});

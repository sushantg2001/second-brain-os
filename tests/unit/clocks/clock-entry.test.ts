import { describe, expect, it } from "bun:test";
import fc from "fast-check";

import {
	closeClockLine,
	clocksOf,
	convertLegacy,
	datesOf,
	describeStop,
	formatLogTime,
	logOf,
	parseLogTime,
	startClock,
	stopClock,
	withLog,
	entryMinutes,
	formatClockEntry,
	minutesBetween,
	minutesOnDate,
	parseClockEntry,
	rangeOnDate,
} from "../../../src/features/clocks";
import { parseTasks, type Task } from "../../../src/features/tasks";
import { addDays, type Result } from "../../../src/shared/kernel";
import { clockBlock, yaml } from "../../fakes/yaml";

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

const parse = (content: string) => parseTasks("a.md", content, (text) => yaml.parse(text));
const apply = (
	content: string,
	edit: (lines: readonly string[], task: Task) => Result<string[], Error> | null,
	line = 0,
) => {
	const result = edit(
		content.split("\n"),
		at(
			parse(content).filter((task) => task.line === line),
			0,
		),
	);
	if (!result?.ok) {
		throw result?.error ?? new Error("no change");
	}
	return result.value.join("\n");
};
const at10 = { date: "2026-10-29", minutes: 600 };

describe("planner log times", () => {
	it("reads Day Planner timestamps and YAML dates", () => {
		expect(parseLogTime("2026-10-29 09:05:00")).toEqual({ date: "2026-10-29", minutes: 545 });
		expect(parseLogTime("2026-10-29T09:05")).toEqual({ date: "2026-10-29", minutes: 545 });
		expect(parseLogTime(new Date(Date.UTC(2026, 9, 29, 9, 5)))).toEqual({
			date: "2026-10-29",
			minutes: 545,
		});
		for (const bad of [
			"2026-10-29",
			"2026-02-30 09:00:00",
			"2026-10-29 25:00:00",
			5,
			null,
			new Date(Number.NaN),
		]) {
			expect(parseLogTime(bad)).toBeNull();
		}
		expect(formatLogTime({ date: "2026-10-29", minutes: 545 })).toBe("2026-10-29 09:05:00");
	});

	it("replaces the log and keeps other keys", () => {
		const data = { tags: ["x"], planner: { color: "red", log: [{ start: "a" }] } };
		expect(withLog(data, [])).toEqual({ tags: ["x"], planner: { color: "red", log: [] } });
		expect(logOf({ planner: { log: "nope" } })).toEqual([]);
		expect(withLog(null, [{ start: "b" }])).toEqual({ planner: { log: [{ start: "b" }] } });
	});
});

describe("yaml clocks under tasks", () => {
	it("reads the yaml log first, then old [clock::] items", () => {
		const tasks = parse(
			[
				"- [ ] Write",
				clockBlock(
					{ start: "2026-10-29 09:00:00", end: "2026-10-29 09:30:00" },
					{ start: "2026-10-29 11:00:00" },
				),
				"\t- [clock::2026-10-28T08:00--2026-10-28T08:10]",
				"\t- note",
			].join("\n"),
		);
		const clocks = clocksOf(at(tasks, 0));
		expect(
			clocks.map((clock) => [
				clock.source.kind,
				clock.start.minutes,
				clock.end?.minutes ?? null,
				clock.line,
			]),
		).toEqual([
			["yaml", 540, 570, 1],
			["yaml", 660, null, 1],
			["legacy", 480, 490, 8],
		]);
		expect(at(tasks, 0).props).toMatchObject({
			startLine: 1,
			endLine: 7,
			indent: "  ",
			valid: true,
		});
	});

	it("ignores unreadable entries and blocks", () => {
		const bad = parse(["- [ ] A", "  ```yaml", "  planner: [unclosed", "  ```"].join("\n"));
		expect(at(bad, 0).props?.valid).toBe(false);
		expect(clocksOf(at(bad, 0))).toEqual([]);
		const odd = parse(
			[
				"- [ ] A",
				clockBlock({ start: "soon" }, { start: "2026-10-29 09:00:00", end: "later" }),
			].join("\n"),
		);
		expect(clocksOf(at(odd, 0))).toEqual([]);
		const noReader = parseTasks(
			"a.md",
			["- [ ] A", clockBlock({ start: "2026-10-29 09:00:00" })].join("\n"),
		);
		expect(at(noReader, 0).props).toMatchObject({ valid: false });
	});

	it("starts a clock by adding a yaml block right under the task", () => {
		expect(
			apply("- [ ] Write\n\t- note", (lines, task) => startClock(lines, task, at10, yaml)),
		).toBe(
			[
				"- [ ] Write",
				"  ```yaml",
				"  planner:",
				"    log:",
				"      - start: 2026-10-29 10:00:00",
				"  ```",
				"\t- note",
			].join("\n"),
		);
		expect(
			apply("\t- [ ] Nested", (lines, task) => startClock(lines, task, at10, yaml)),
		).toContain("\t  ```yaml");
	});

	it("appends to an existing log and keeps other keys", () => {
		const content = [
			"- [ ] Write",
			"  ```yaml",
			"  color: red",
			"  planner:",
			"    log:",
			"      - start: 2026-10-29 09:00:00",
			"        end: 2026-10-29 09:30:00",
			"  ```",
		].join("\n");
		const started = apply(content, (lines, task) => startClock(lines, task, at10, yaml));
		expect(started).toContain("  color: red");
		expect(started).toContain(
			"      - start: 2026-10-29 09:00:00\n        end: 2026-10-29 09:30:00\n      - start: 2026-10-29 10:00:00",
		);
		const stopped = apply(started, (lines, task) =>
			stopClock(lines, task, { date: "2026-10-29", minutes: 645 }, yaml),
		);
		expect(stopped).toContain(
			"      - start: 2026-10-29 10:00:00\n        end: 2026-10-29 10:45:00",
		);
		expect(parse(stopped)[0]?.props?.data).toEqual({
			color: "red",
			planner: {
				log: [
					{ start: "2026-10-29 09:00:00", end: "2026-10-29 09:30:00" },
					{ start: "2026-10-29 10:00:00", end: "2026-10-29 10:45:00" },
				],
			},
		});
	});

	it("refuses to start twice or write into an unreadable block", () => {
		const running = ["- [ ] A", clockBlock({ start: "2026-10-29 09:00:00" })].join("\n");
		expect(startClock(running.split("\n"), at(parse(running), 0), at10, yaml).ok).toBe(false);
		const broken = ["- [ ] A", "  ```yaml", "  - just a list", "  ```"].join("\n");
		const result = startClock(broken.split("\n"), at(parse(broken), 0), at10, yaml);
		expect(!result.ok && result.error.message).toBe(
			"The task's yaml block could not be read. Fix it, then try again.",
		);
		expect(stopClock(["- [ ] A"], at(parse("- [ ] A"), 0), at10, yaml).ok).toBe(false);
	});

	it("stops old [clock::] items in place", () => {
		const content = "- [ ] A\n\t- [clock::2026-10-29T09:00--]";
		expect(apply(content, (lines, task) => stopClock(lines, task, at10, yaml))).toBe(
			"- [ ] A\n\t- [clock::2026-10-29T09:00--2026-10-29T10:00]",
		);
		expect(closeClockLine("\t- [clock::2026-10-29T10:00--2026-10-29T10:45]", at10)).toBeNull();
	});

	it("converts old items into the yaml log", () => {
		const content = [
			"- [ ] A",
			clockBlock({ start: "2026-10-27 08:00:00", end: "2026-10-27 08:30:00" }),
			"\t- keep me",
			"\t- [clock::2026-10-28T09:00--2026-10-28T09:45]",
			"\t- [clock::2026-10-29T09:00--]",
		].join("\n");
		const converted = apply(content, (lines, task) => convertLegacy(lines, task, yaml));
		expect(converted).not.toContain("[clock::");
		expect(converted).toContain("\t- keep me");
		expect(
			clocksOf(at(parse(converted), 0)).map((clock) => [
				clock.source.kind,
				clock.start.date,
				clock.end === null,
			]),
		).toEqual([
			["yaml", "2026-10-27", false],
			["yaml", "2026-10-28", false],
			["yaml", "2026-10-29", true],
		]);
		expect(convertLegacy(["- [ ] B"], at(parse("- [ ] B"), 0), yaml)).toBeNull();
	});

	it("describes a stop for previews", () => {
		expect(
			describeStop({ start: { date: "2026-10-27", minutes: 540 }, end: null }, at10),
		).toEqual({
			before: "start: 2026-10-27 09:00:00",
			after: "start: 2026-10-27 09:00:00, end: 2026-10-29 10:00:00",
		});
	});
});

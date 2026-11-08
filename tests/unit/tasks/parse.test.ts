import { describe, expect, it } from "bun:test";
import fc from "fast-check";

import { clocksOf } from "../../../src/features/clocks";
import {
	displayText,
	formatListLine,
	formatTimeBlock,
	indentWidth,
	parseFields,
	parseListLine,
	parseTasks,
	parseTimeBlock,
	stateOf,
	stripTimeBlock,
} from "../../../src/features/tasks";

describe("list lines", () => {
	it("parses tasks and plain items", () => {
		expect(parseListLine("- [ ] Write")).toEqual({
			indent: "",
			marker: "-",
			status: " ",
			text: "Write",
		});
		expect(parseListLine("\t* [x] Done")).toEqual({
			indent: "\t",
			marker: "*",
			status: "x",
			text: "Done",
		});
		expect(parseListLine("  1. [/] Doing")).toEqual({
			indent: "  ",
			marker: "1.",
			status: "/",
			text: "Doing",
		});
		expect(parseListLine("- plain")).toEqual({
			indent: "",
			marker: "-",
			status: null,
			text: "plain",
		});
		expect(parseListLine("- [ ]")).toEqual({ indent: "", marker: "-", status: " ", text: "" });
		expect(parseListLine("text")).toBeNull();
		expect(parseListLine("-no space")).toBeNull();
	});

	it("round-trips canonical lines", () => {
		const line = fc
			.tuple(
				fc.constantFrom("", "  ", "\t", "    "),
				fc.constantFrom("-", "*", "+", "1.", "12)"),
				fc.option(fc.constantFrom(" ", "x", "/", "-", ">"), { nil: null }),
				fc.stringMatching(/^\S(?:[^\n\r]*\S)?$/),
			)
			.map(([indent, marker, status, text]) => ({ indent, marker, status, text }));
		fc.assert(
			fc.property(line, (parts) => {
				expect(parseListLine(formatListLine(parts))).toEqual(parts);
			}),
		);
	});

	it("measures indents with tabs as four spaces", () => {
		expect(indentWidth("\t  ")).toBe(6);
	});
});

describe("task fields", () => {
	it("reads Tasks emoji and Dataview fields", () => {
		const fields = parseFields(
			"Call [[Mum|mum]] #family #2026 ⏳ 2026-10-29 📅 2026-11-01 🛫 2026-10-01 ✅ 2026-10-30 [[Areas/Home#Todo]]",
		);
		expect(fields).toEqual({
			scheduled: "2026-10-29",
			due: "2026-11-01",
			start: "2026-10-01",
			done: "2026-10-30",
			tags: ["family"],
			links: ["Mum", "Areas/Home"],
		});
		expect(parseFields("Pay [scheduled:: 2026-10-29] (due:: 2026-11-02)").scheduled).toBe(
			"2026-10-29",
		);
		expect(parseFields("Pay [scheduled:: 2026-10-29] (due:: 2026-11-02)").due).toBe(
			"2026-11-02",
		);
		expect(parseFields("bad ⏳ 2026-02-30").scheduled).toBeNull();
	});

	it("strips metadata for display", () => {
		expect(
			displayText("Call mum ⏫ 🔁 every week ⏳ 2026-10-29 📅 2026-11-01 [p:: 1] ^abc"),
		).toBe("Call mum");
	});
});

describe("time blocks", () => {
	it("parses start and end times", () => {
		expect(parseTimeBlock("09:00 - 10:30 Write spec")).toEqual({
			start: 540,
			end: 630,
			rest: "Write spec",
			malformed: false,
		});
		expect(parseTimeBlock("9:00-9:30")).toEqual({
			start: 540,
			end: 570,
			rest: "",
			malformed: false,
		});
		expect(parseTimeBlock("1:00 pm – 2:15 pm Lunch")?.end).toBe(855);
		expect(parseTimeBlock("14:00 Gym")).toEqual({
			start: 840,
			end: null,
			rest: "Gym",
			malformed: false,
		});
	});

	it("accepts a dot between hours and minutes, like Day Planner", () => {
		expect(parseTimeBlock("09.00 - 10.30 Write")).toEqual({
			start: 540,
			end: 630,
			rest: "Write",
			malformed: false,
		});
		expect(parseTimeBlock("9 - 10 Write")).toBeNull();
		expect(parseTimeBlock("09 00 Write")).toBeNull();
	});

	it("keeps a title that starts with am or pm", () => {
		expect(parseTimeBlock("09:00 - 10:00 PM review")).toEqual({
			start: 540,
			end: 600,
			rest: "PM review",
			malformed: false,
		});
		expect(parseTimeBlock("00:00 - 00:01 Am")).toEqual({
			start: 0,
			end: 1,
			rest: "Am",
			malformed: false,
		});
		expect(parseTimeBlock("10:00 pm sync")).toEqual({
			start: 600,
			end: null,
			rest: "pm sync",
			malformed: false,
		});
		expect(parseTimeBlock("9:00 am - 10:30 am Standup")).toEqual({
			start: 540,
			end: 630,
			rest: "Standup",
			malformed: false,
		});
		expect(parseTimeBlock("9:00 PM")).toEqual({
			start: 1260,
			end: null,
			rest: "",
			malformed: false,
		});
		expect(parseTimeBlock("12:30am-1:00am Late")).toEqual({
			start: 30,
			end: 60,
			rest: "Late",
			malformed: false,
		});
		expect(parseTimeBlock("0:30 am - 1:00 Odd")?.start).toBe(30);
	});

	it("flags an end before the start", () => {
		expect(parseTimeBlock("10:00 - 09:00 Oops")).toEqual({
			start: 600,
			end: null,
			rest: "Oops",
			malformed: true,
		});
	});

	it("ignores text that does not start with a time", () => {
		expect(parseTimeBlock("Meeting at 10:00")).toBeNull();
		expect(parseTimeBlock("25:00 Nope")).toBeNull();
		expect(parseTimeBlock("24:00 End")).toBeNull();
		expect(parseTimeBlock("10:00am-ish")).toBeNull();
	});

	it("round-trips formatting", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 0, max: 1438 }),
				fc.integer({ min: 1, max: 600 }),
				fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,20}[a-z]$/),
				(start, length, rest) => {
					const end = Math.min(1440, start + length);
					expect(parseTimeBlock(formatTimeBlock(start, end, rest))).toEqual({
						start,
						end,
						rest,
						malformed: false,
					});
				},
			),
		);
	});

	it("strips a block", () => {
		expect(stripTimeBlock("09:00 - 10:00 Write")).toBe("Write");
		expect(stripTimeBlock("Write")).toBe("Write");
	});
});

describe("parseTasks", () => {
	const note = [
		"---",
		"tags: [daily]",
		"- [ ] not a task, front matter",
		"---",
		"# Plan",
		"- [ ] 09:00 - 10:00 Write ⏳ 2026-10-29",
		"\t- [clock::2026-10-29T09:00--2026-10-29T09:40]",
		"\t- [x] Sub task",
		"\t\t- deep note",
		"- [/] Second",
		"text breaks the list",
		"  - [ ] Separate",
		"```",
		"- [ ] in code",
		"```",
		"## Later",
		"* [-] Cancelled",
	].join("\n");
	const tasks = parseTasks("Daily/2026-10-29.md", note);

	it("finds tasks outside front matter and code", () => {
		expect(tasks.map((task) => task.text)).toEqual([
			"09:00 - 10:00 Write ⏳ 2026-10-29",
			"Sub task",
			"Second",
			"Separate",
			"Cancelled",
		]);
	});

	it("records line, state, block, fields and heading", () => {
		const [first] = tasks;
		expect(first?.line).toBe(5);
		expect(first?.raw).toBe("- [ ] 09:00 - 10:00 Write ⏳ 2026-10-29");
		expect(first?.state).toBe("todo");
		expect(first?.block?.start).toBe(540);
		expect(first?.fields.scheduled).toBe("2026-10-29");
		expect(first?.heading).toBe("Plan");
		expect(tasks.at(-1)?.heading).toBe("Later");
		expect(tasks.at(-1)?.state).toBe("cancelled");
	});

	it("collects nested items as children", () => {
		expect(tasks[0]?.children.map((child) => child.line)).toEqual([6, 7, 8]);
		expect(tasks[1]?.children.map((child) => child.text)).toEqual(["deep note"]);
		expect(tasks[2]?.children).toEqual([]);
	});

	it("maps status symbols", () => {
		expect(stateOf(">")).toBe("waiting");
		expect(stateOf("?")).toBe("todo");
	});
});

describe("continuation lines", () => {
	const lines = (items: readonly { line: number }[]): number[] => items.map((item) => item.line);

	it("keeps a clock line written under a task with a tab and spaces", () => {
		const tasks = parseTasks(
			"a.md",
			[
				"- [x] youtube  [completion:: 2026-10-26]",
				"\t      [clock::2026-10-26T21:06:26--2026-10-27T00:00:44]",
				"\t      [clock::2026-10-27T00:35:32--2026-10-27T01:42:36]",
				"- [ ] next",
			].join("\n"),
		);
		expect(tasks.map((task) => task.text)).toEqual([
			"youtube  [completion:: 2026-10-26]",
			"next",
		]);
		expect(tasks[0]?.fields.done).toBe("2026-10-26");
		expect(lines(tasks[0]?.own ?? [])).toEqual([1, 2]);
		expect(tasks[0] && clocksOf(tasks[0])).toHaveLength(2);
		expect(tasks[1]?.own).toEqual([]);
	});

	it("keeps a clock line aligned with the task text", () => {
		const tasks = parseTasks(
			"a.md",
			[
				"- 00:00 - 10:00 plain bullet, not a task",
				"\t- [x] sleep #health/sleep  [completion:: 2026-10-29]",
				"\t  [clock::2026-10-29T00:30:20--2026-10-29T09:55:29]",
			].join("\n"),
		);
		expect(tasks).toHaveLength(1);
		expect(tasks[0]?.fields.tags).toEqual(["health/sleep"]);
		expect(tasks[0]?.fields.done).toBe("2026-10-29");
		expect(lines(tasks[0]?.own ?? [])).toEqual([2]);
	});

	it("works for numbered tasks and one-tab clock lines", () => {
		const tasks = parseTasks("a.md", "1. [ ] a\n\t[clock::2026-10-29T09:00:00--]\n");
		expect(tasks[0] && clocksOf(tasks[0]).map((clock) => clock.line)).toEqual([1]);
	});

	it("ends the list at text that is not indented under the task", () => {
		const tasks = parseTasks(
			"a.md",
			["- [ ] a", "[clock::2026-10-29T09:00:00--]", "\t- [ ] b"].join("\n"),
		);
		expect(tasks[0]?.own).toEqual([]);
		expect(tasks[0]?.children).toEqual([]);
		expect(tasks[1]?.parentLine).toBeNull();
	});

	it("keeps a clock line after a blank line", () => {
		const tasks = parseTasks("a.md", "- [ ] a\n\n\t[clock::2026-10-29T09:00:00--]\n");
		expect(lines(tasks[0]?.own ?? [])).toEqual([2]);
	});

	it("ignores clock lines in code blocks and under plain bullets", () => {
		const fenced = parseTasks(
			"a.md",
			["- [ ] a", "```", "\t[clock::2026-10-29T09:00:00--]", "```"].join("\n"),
		);
		expect(fenced[0]?.own).toEqual([]);
		const bullet = parseTasks("b.md", "- note\n\t[clock::2026-10-29T09:00:00--]\n");
		expect(bullet).toEqual([]);
	});

	it("keeps other indented text as part of the task, but it is not a clock", () => {
		const tasks = parseTasks("a.md", "- [ ] a\n\tsee the notes\n");
		expect(tasks[0]?.children.map((child) => child.text)).toEqual(["see the notes"]);
		expect(tasks[0] && clocksOf(tasks[0])).toEqual([]);
	});

	it("gives each line to the task it is under, and to the tasks above it", () => {
		const tasks = parseTasks(
			"a.md",
			[
				"- [ ] Main",
				"\t- [ ] Sub",
				"\t\t[clock::2026-10-29T09:00:00--2026-10-29T09:30:00]",
				"\t- [ ] Sub 2",
			].join("\n"),
		);
		const [main, sub, sub2] = tasks;
		expect(lines(sub?.own ?? [])).toEqual([2]);
		expect(lines(main?.own ?? [])).toEqual([1, 3]);
		expect(lines(main?.children ?? [])).toEqual([1, 2, 3]);
		expect([main?.parentLine, sub?.parentLine, sub2?.parentLine]).toEqual([null, 0, 0]);
		expect(main && clocksOf(main)).toEqual([]);
		expect(sub && clocksOf(sub)).toHaveLength(1);
	});

	it("skips plain bullets when finding a parent task", () => {
		const tasks = parseTasks("a.md", "- [ ] Main\n\t- note\n\t\t- [ ] Sub\n");
		expect(tasks[1]?.parentLine).toBe(0);
	});

	it("does not link tasks under different headings", () => {
		const tasks = parseTasks("a.md", "# A\n- [ ] one\n# B\n\t- [ ] two\n");
		expect(tasks[1]?.parentLine).toBeNull();
	});

	it("closes a nested task when text continues the task above it", () => {
		const tasks = parseTasks(
			"a.md",
			["- [ ] Main", "\t- [ ] Sub", "  text for Main", "\t- [ ] Sub 2"].join("\n"),
		);
		expect(tasks[2]?.parentLine).toBe(0);
		expect(lines(tasks[1]?.children ?? [])).toEqual([]);
	});
});

describe("time blocks on tasks and bullets", () => {
	it("reads blocks with single-digit hours, as in nested blocks", () => {
		const tasks = parseTasks(
			"a.md",
			[
				"- [ ] 00:00 - 2:00 Main block",
				"\t- [ ] 00:00 - 1:00 Sub block",
				"   - [ ] 1:00 - 2:00 Sub block 2",
			].join("\n"),
		);
		expect(tasks.map((task) => [task.block?.start, task.block?.end, task.parentLine])).toEqual([
			[0, 120, null],
			[0, 60, 0],
			[60, 120, 0],
		]);
	});

	it("leaves a plain bullet with a time alone, and strips fields from the title", () => {
		const tasks = parseTasks(
			"a.md",
			[
				"- 00:00 - 10:00 Late night  [type::log]",
				"\t- [x] brush  [completion:: 2026-10-29]",
			].join("\n"),
		);
		expect(tasks).toHaveLength(1);
		expect(tasks[0]?.parentLine).toBeNull();
		expect(displayText(stripTimeBlock("00:00 - 10:00 Late night  [type::log]"))).toBe(
			"Late night",
		);
	});
});

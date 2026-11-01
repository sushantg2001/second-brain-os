import { describe, expect, it } from "bun:test";
import fc from "fast-check";

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

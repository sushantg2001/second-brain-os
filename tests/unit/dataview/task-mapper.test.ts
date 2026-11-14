import { describe, expect, it } from "bun:test";

import { clocksOf } from "../../../src/features/clocks";
import { tasksIn } from "../../fakes/tasks";

describe("tasks from Dataview", () => {
	const note = [
		"---",
		"tags: [daily]",
		"- [ ] not a task, front matter",
		"---",
		"# Plan",
		"- [ ] 09:00 - 10:00 Write ⏳ 2026-10-29 📅 2026-11-01 🛫 2026-10-01 [[Areas/Home#Todo]]",
		"\t- [clock::2026-10-29T09:00--2026-10-29T09:40]",
		"\t- [x] Sub task [completion:: 2026-10-30]",
		"\t\t- deep note",
		"- [/] Second",
		"```",
		"- [ ] in code",
		"```",
		"## Later",
		"* [-] Cancelled",
	].join("\n");
	const tasks = tasksIn("Daily/2026-10-29.md", note);

	it("finds tasks outside front matter and code", () => {
		expect(tasks.map((task) => task.text)).toEqual([
			"09:00 - 10:00 Write ⏳ 2026-10-29 📅 2026-11-01 🛫 2026-10-01 [[Areas/Home#Todo]]",
			"Sub task [completion:: 2026-10-30]",
			"Second",
			"Cancelled",
		]);
	});

	it("reports where each task is", () => {
		const [first, sub, second] = tasks;
		expect([first?.line, first?.lineCount, first?.lastLine]).toEqual([5, 1, 8]);
		expect([sub?.line, sub?.lastLine, sub?.parentLine]).toEqual([7, 8, 5]);
		expect([second?.line, second?.lastLine, second?.parentLine]).toEqual([9, 9, null]);
	});

	it("reads status, state, block, dates, links and heading", () => {
		const [first, sub, second, last] = tasks;
		expect([first?.status, first?.state, second?.status, second?.state]).toEqual([
			" ",
			"todo",
			"/",
			"in-progress",
		]);
		expect(first?.block?.start).toBe(540);
		expect(first?.fields).toEqual({
			scheduled: "2026-10-29",
			due: "2026-11-01",
			start: "2026-10-01",
			done: null,
			links: ["Areas/Home"],
		});
		expect(sub?.fields.done).toBe("2026-10-30");
		expect(first?.heading).toBe("Plan");
		expect(last?.heading).toBe("Later");
		expect(last?.state).toBe("cancelled");
	});

	it("keeps a date that cannot be read out of the fields", () => {
		const [task] = tasksIn("a.md", "- [ ] bad ⏳ 2026-02-30 [due:: tomorrow]");
		expect(task?.fields.scheduled).toBeNull();
		expect(task?.fields.due).toBeNull();
	});

	it("takes the first date when a task has the same one twice", () => {
		const [task] = tasksIn("a.md", "- [x] Done ✅ 2026-10-28 [completion:: 2026-10-27]");
		expect(task?.fields.done).toBe("2026-10-28");
	});
});

describe("clocks of a task", () => {
	it("reads clocks written under a task with a tab and spaces", () => {
		const tasks = tasksIn(
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
		expect([tasks[0]?.lineCount, tasks[0]?.lastLine]).toEqual([3, 2]);
		expect(tasks[0] && clocksOf(tasks[0])).toHaveLength(2);
		expect(tasks[1]?.clocks).toEqual([]);
	});

	it("keeps the order of clocks and a running one without an end", () => {
		const [task] = tasksIn(
			"a.md",
			"- [ ] a\n\t[clock::2026-10-29T09:00:00--2026-10-29T09:30:00]\n\t[clock::2026-10-29T14:00:00--]\n",
		);
		expect(task?.clocks).toEqual([
			"2026-10-29T09:00:00--2026-10-29T09:30:00",
			"2026-10-29T14:00:00--",
		]);
		expect(task && clocksOf(task).map((clock) => clock.end === null)).toEqual([false, true]);
	});

	it("works for numbered tasks and one-tab clock lines", () => {
		const [task] = tasksIn("a.md", "1. [ ] a\n\t[clock::2026-10-29T09:00:00--]\n");
		expect(task?.clocks).toEqual(["2026-10-29T09:00:00--"]);
	});

	it("reads the older clock list items under a task", () => {
		const [task] = tasksIn(
			"a.md",
			"- [ ] a\n\t- [clock::2026-10-29T09:00--2026-10-29T09:30]\n",
		);
		expect(task?.clocks).toEqual(["2026-10-29T09:00--2026-10-29T09:30"]);
		expect(task?.lineCount).toBe(1);
		expect(task?.lastLine).toBe(1);
	});

	it("leaves the clocks of a sub task to the sub task", () => {
		const [main, sub, sub2] = tasksIn(
			"a.md",
			[
				"- [ ] Main",
				"\t- [ ] Sub",
				"\t\t[clock::2026-10-29T09:00:00--2026-10-29T09:30:00]",
				"\t- [ ] Sub 2",
			].join("\n"),
		);
		expect(main?.clocks).toEqual([]);
		expect(sub?.clocks).toHaveLength(1);
		expect([main?.parentLine, sub?.parentLine, sub2?.parentLine]).toEqual([null, 0, 0]);
		expect(main?.lastLine).toBe(3);
	});

	it("ignores a clock in a code block or under a plain bullet that is not nested in a task", () => {
		const [fenced] = tasksIn(
			"a.md",
			["- [ ] a", "```", "\t[clock::2026-10-29T09:00:00--]", "```"].join("\n"),
		);
		expect(fenced?.clocks).toEqual([]);
		expect(tasksIn("b.md", "- note\n\t[clock::2026-10-29T09:00:00--]\n")).toEqual([]);
	});

	it("skips plain bullets when finding a parent task", () => {
		const tasks = tasksIn("a.md", "- [ ] Main\n\t- note\n\t\t- [ ] Sub\n");
		expect(tasks[1]?.parentLine).toBe(0);
	});

	it("does not link tasks under different headings", () => {
		const tasks = tasksIn("a.md", "# A\n- [ ] one\n# B\n\t- [ ] two\n");
		expect(tasks[1]?.parentLine).toBeNull();
	});
});

describe("time blocks on tasks and bullets", () => {
	it("reads blocks with single-digit hours, as in nested blocks", () => {
		const tasks = tasksIn(
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

	it("leaves a plain bullet with a time alone", () => {
		const tasks = tasksIn(
			"a.md",
			[
				"- 00:00 - 10:00 Late night  [type::log]",
				"\t- [x] brush  [completion:: 2026-10-29]",
			].join("\n"),
		);
		expect(tasks).toHaveLength(1);
		expect(tasks[0]?.parentLine).toBeNull();
	});
});

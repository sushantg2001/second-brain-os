import { describe, expect, it } from "bun:test";

import { buildDayPlan } from "../../../src/features/planner";
import { parseTasks } from "../../../src/features/tasks";

/** A day log: timed tasks with what was done in them listed below, untimed, one clock each. */
const LOG = [
	"- [x] 00:00 - 10:00 Late night  [type::log]  [completion:: 2026-10-29]",
	"\t- [x] brush before sleep  [completion:: 2026-10-29]",
	"\t- [x] sleep #health/sleep  [completion:: 2026-10-29]",
	"\t      [clock::2026-10-29T00:30:20--2026-10-29T09:55:29]",
	"- [x] 10:00 - 12:00 Morning  [type::log]",
	"\t- [x] getting fresh after waking",
	"\t- [ ] bath",
	"\t\t- [ ] shampoo",
	"\t- a plain note, not a task",
	"- [ ] Buy milk",
].join("\n");

function plan(content = LOG) {
	const tasks = parseTasks("2026-10-29.md", content);
	return buildDayPlan("2026-10-29", "2026-10-29.md", tasks, 30);
}

describe("sub tasks of a block", () => {
	it("lists the untimed tasks under a block, in note order", () => {
		const night = plan().blocks.find((block) => block.title === "Late night");
		expect(night?.subtasks.map((task) => [task.title, task.level, task.state])).toEqual([
			["brush before sleep", 0, "done"],
			["sleep #health/sleep", 0, "done"],
		]);
	});

	it("indents tasks nested under a sub task and leaves out plain list items", () => {
		const morning = plan().blocks.find((block) => block.title === "Morning");
		expect(morning?.subtasks.map((task) => [task.title, task.level])).toEqual([
			["getting fresh after waking", 0],
			["bath", 0],
			["shampoo", 1],
		]);
	});

	it("still lists an open sub task as unscheduled, so it can be given a time", () => {
		expect(plan().unscheduled.map((task) => task.title)).toEqual([
			"bath",
			"shampoo",
			"Buy milk",
		]);
	});

	it("does not repeat a sub task that is drawn as a block inside its parent", () => {
		const nested = plan(
			[
				"- [ ] 10:00 - 12:00 Workshop",
				"\t- [ ] 10:30 - 11:00 Intro",
				"\t\t- [ ] slides",
				"\t- [ ] notes",
			].join("\n"),
		);
		const workshop = nested.blocks.find((block) => block.title === "Workshop");
		const intro = nested.blocks.find((block) => block.title === "Intro");
		expect(workshop?.subtasks.map((task) => task.title)).toEqual(["notes"]);
		expect(intro?.subtasks.map((task) => task.title)).toEqual(["slides"]);
	});

	it("lists the sub tasks of a block that is scheduled from another note", () => {
		const elsewhere = parseTasks(
			"Projects/Site.md",
			[
				"- [ ] 14:00 - 15:00 Review ⏳ 2026-10-29",
				"\t- [ ] check copy",
				"\t- [x] check links",
			].join("\n"),
		);
		const review = elsewhere.filter((task) => task.block !== null);
		const day = buildDayPlan("2026-10-29", null, review, 30, () => elsewhere);
		expect(day.blocks[0]?.subtasks.map((task) => [task.title, task.state])).toEqual([
			["check copy", "todo"],
			["check links", "done"],
		]);
	});

	it("gives a block with nothing under it an empty list", () => {
		expect(plan("- [ ] 09:00 - 10:00 Alone").blocks[0]?.subtasks).toEqual([]);
	});
});

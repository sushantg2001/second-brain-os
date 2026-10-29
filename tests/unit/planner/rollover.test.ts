import { describe, expect, it } from "bun:test";

import { removeCarried, tasksToCarry } from "../../../src/features/planner";
import { parseTasks } from "../../../src/features/tasks";
import { clockBlock, yaml } from "../../fakes/yaml";

const NOTE = [
	"# Yesterday",
	"- [ ] 09:00 - 10:00 Write spec",
	"\t- [ ] Sub step",
	"\t- [clock::2026-10-28T09:00--2026-10-28T09:30]",
	"- [x] Done thing",
	"- [/] 14:00 Half done",
	"- [-] Dropped",
	"- [ ] ",
	"Notes",
].join("\n");

describe("carrying tasks over", () => {
	const tasks = parseTasks("2026-10-28.md", NOTE);
	const carried = tasksToCarry(NOTE, tasks);

	it("takes open top-level tasks with their nested lines, without old times", () => {
		expect(carried.map((item) => item.carried)).toEqual([
			[
				"- [ ] Write spec",
				"\t- [ ] Sub step",
				"\t- [clock::2026-10-28T09:00--2026-10-28T09:30]",
			],
			["- [/] Half done"],
		]);
	});

	it("removes exactly those lines from the old note", () => {
		expect(removeCarried(NOTE, carried)).toBe(
			["# Yesterday", "- [x] Done thing", "- [-] Dropped", "- [ ] ", "Notes"].join("\n"),
		);
	});

	it("leaves a changed note alone", () => {
		expect(removeCarried(NOTE.replace("Write spec", "Write the spec"), carried)).toBeNull();
	});
});

describe("carrying tasks with Day Planner clocks", () => {
	it("moves the yaml block with its task", () => {
		const note = [
			"- [ ] Write",
			clockBlock({ start: "2026-10-28 09:00:00", end: "2026-10-28 09:30:00" }),
			"- [x] Done",
		].join("\n");
		const tasks = parseTasks("2026-10-28.md", note, (text) => yaml.parse(text));
		const carried = tasksToCarry(note, tasks);
		expect(carried[0]?.carried).toHaveLength(7);
		expect(carried[0]?.carried.at(-1)).toBe("  ```");
		expect(removeCarried(note, carried)).toBe("- [x] Done");
	});
});

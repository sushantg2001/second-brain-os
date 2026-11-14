import { describe, expect, it } from "bun:test";

import { removeCarried, tasksToCarry } from "../../../src/features/planner";
import { tasksIn } from "../../fakes/tasks";

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
	const tasks = tasksIn("2026-10-28.md", NOTE);
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

	it("carries clock lines written without a bullet along with their task", () => {
		const note = [
			"- [ ] 09:00 - 10:00 Write spec",
			"\t      [clock::2026-10-28T09:00:10--2026-10-28T09:30:20]",
			"\t- [ ] Sub step",
			"\t\t[clock::2026-10-28T09:40:00--]",
			"- [ ] Next",
		].join("\n");
		const items = tasksToCarry(note, tasksIn("2026-10-28.md", note));
		expect(items.map((item) => item.carried)).toEqual([
			[
				"- [ ] Write spec",
				"\t      [clock::2026-10-28T09:00:10--2026-10-28T09:30:20]",
				"\t- [ ] Sub step",
				"\t\t[clock::2026-10-28T09:40:00--]",
			],
			["- [ ] Next"],
		]);
		expect(removeCarried(note, items)).toBe("");
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

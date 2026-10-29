import { describe, expect, it } from "bun:test";

import {
	addTo,
	combine,
	EMPTY_ROLLUP,
	inRange,
	rollupTasks,
	sortedPillarTimes,
} from "../../../src/features/rollups";
import { parseTasks } from "../../../src/features/tasks";

const tasks = parseTasks(
	"p.md",
	["- [x] A ✅ 2026-10-20", "- [-] B", "- [ ] C", "- [/] D", "- [x] E ✅ 2026-10-25"].join("\n"),
);

describe("rollupTasks", () => {
	it("counts closed tasks, clocked time and the last activity", () => {
		const clocked = (task: (typeof tasks)[number]) =>
			task.text === "C"
				? { minutes: 30, lastDate: "2026-10-28" }
				: { minutes: 10, lastDate: null };
		expect(rollupTasks(tasks, clocked)).toEqual({
			done: 3,
			total: 5,
			percent: 60,
			clockedMinutes: 70,
			lastActivity: "2026-10-28",
		});
		expect(rollupTasks([], clocked)).toEqual(EMPTY_ROLLUP);
	});

	it("combines rollups", () => {
		expect(
			combine([
				{ done: 1, total: 3, percent: 33, clockedMinutes: 5, lastActivity: "2026-10-01" },
				{ done: 2, total: 2, percent: 100, clockedMinutes: 10, lastActivity: null },
				{ done: 0, total: 3, percent: 0, clockedMinutes: 0, lastActivity: "2026-09-01" },
			]),
		).toEqual({
			done: 3,
			total: 8,
			percent: 38,
			clockedMinutes: 15,
			lastActivity: "2026-10-01",
		});
		expect(combine([])).toEqual(EMPTY_ROLLUP);
	});
});

describe("review helpers", () => {
	it("checks ranges inclusively", () => {
		const range = { from: "2026-10-26", to: "2026-11-01" };
		expect(inRange("2026-10-26", range)).toBe(true);
		expect(inRange("2026-11-01", range)).toBe(true);
		expect(inRange("2026-11-02", range)).toBe(false);
		expect(inRange(null, range)).toBe(false);
	});

	it("totals and sorts pillar time with unlinked time last", () => {
		const totals = new Map<string, number>();
		addTo(totals, "Work", 30);
		addTo(totals, "", 90);
		addTo(totals, "Health", 60);
		addTo(totals, "Work", 30);
		addTo(totals, "Rest", 0);
		addTo(totals, "Art", 60);
		expect(sortedPillarTimes(totals)).toEqual([
			["Art", 60],
			["Health", 60],
			["Work", 60],
			["", 90],
		]);
	});
});

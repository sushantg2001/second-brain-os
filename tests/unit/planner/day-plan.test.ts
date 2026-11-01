import { describe, expect, it } from "bun:test";
import fc from "fast-check";

import {
	buildDayPlan,
	currentBlock,
	layoutColumns,
	newBlockLine,
	nextBlock,
	nextFreeSlot,
	normalizeRange,
	withBlock,
	withoutBlock,
} from "../../../src/features/planner";
import { parseTasks } from "../../../src/features/tasks";

const daily = parseTasks(
	"2026-10-29.md",
	[
		"- [ ] 09:00 - 10:00 Write spec ⏫",
		"- [x] 10:30 Standup",
		"- [ ] Buy milk",
		"- [x] Done without time",
		"- [ ] 09:30 - 11:00 Overlap",
	].join("\n"),
);
const elsewhere = parseTasks(
	"Projects/Site.md",
	[
		"- [ ] 14:00 - 15:00 Review ⏳ 2026-10-29",
		"- [ ] Draft copy ⏳ 2026-10-29",
		"- [ ] Other day ⏳ 2026-10-30",
		"- [ ] Not scheduled",
	].join("\n"),
);
const plan = buildDayPlan("2026-10-29", "2026-10-29.md", [...daily, ...elsewhere], 30);

describe("buildDayPlan", () => {
	it("collects timed tasks from the daily note and scheduled tasks", () => {
		expect(
			plan.blocks.map((block) => [block.title, block.start, block.end, block.source]),
		).toEqual([
			["Write spec", 540, 600, "daily"],
			["Overlap", 570, 660, "daily"],
			["Standup", 630, 660, "daily"],
			["Review", 840, 900, "scheduled"],
		]);
		expect(plan.blocks.find((block) => block.title === "Standup")?.explicitEnd).toBe(false);
	});

	it("lists open tasks without a time", () => {
		expect(plan.unscheduled.map((task) => task.title)).toEqual(["Buy milk", "Draft copy"]);
	});

	it("totals planned minutes", () => {
		expect(plan.plannedMinutes).toBe(60 + 90 + 30 + 60);
	});

	it("puts overlapping blocks side by side", () => {
		expect(plan.blocks.map((block) => [block.column, block.columns])).toEqual([
			[0, 2],
			[1, 2],
			[0, 2],
			[0, 1],
		]);
	});

	it("works without a daily note", () => {
		const scheduledOnly = buildDayPlan("2026-10-29", null, [...daily, ...elsewhere], 30);
		expect(scheduledOnly.blocks.map((block) => block.title)).toEqual(["Review"]);
	});

	it("finds the current and next open block", () => {
		expect(currentBlock(plan, 545)?.title).toBe("Write spec");
		expect(currentBlock(plan, 635)?.title).toBe("Overlap");
		expect(nextBlock(plan, 600)?.title).toBe("Review");
		expect(currentBlock(plan, 1000)).toBeNull();
		expect(nextBlock(plan, 1000)).toBeNull();
	});
});

describe("layoutColumns", () => {
	it("never puts overlapping blocks in the same column", () => {
		const range = fc
			.tuple(fc.integer({ min: 0, max: 1400 }), fc.integer({ min: 1, max: 180 }))
			.map(([start, length]) => ({ start, end: Math.min(1440, start + length) }));
		fc.assert(
			fc.property(fc.array(range, { maxLength: 30 }), (ranges) => {
				const sorted = [...ranges].sort((a, b) => a.start - b.start);
				const laid = layoutColumns(sorted);
				expect(laid).toHaveLength(ranges.length);
				for (const a of laid) {
					expect(a.column).toBeLessThan(a.columns);
					for (const b of laid) {
						if (a !== b && a.start < b.end && b.start < a.end) {
							expect(a.column === b.column).toBe(false);
						}
					}
				}
			}),
		);
	});
});

describe("nextFreeSlot", () => {
	const blocks = [
		{ start: 540, end: 600 },
		{ start: 600, end: 630 },
		{ start: 700, end: 720 },
	];

	it("skips busy time", () => {
		expect(nextFreeSlot(blocks, 540, 30)).toBe(630);
		expect(nextFreeSlot(blocks, 540, 90)).toBe(720);
		expect(nextFreeSlot(blocks, 480, 60)).toBe(480);
		expect(nextFreeSlot(blocks, 1420, 30)).toBeNull();
		expect(nextFreeSlot(blocks, 540, 30, 600)).toBeNull();
	});

	it("never returns a slot that overlaps a block", () => {
		const range = fc
			.tuple(fc.integer({ min: 0, max: 1400 }), fc.integer({ min: 1, max: 120 }))
			.map(([start, length]) => ({ start, end: Math.min(1440, start + length) }));
		fc.assert(
			fc.property(
				fc.array(range, { maxLength: 20 }),
				fc.integer({ min: 0, max: 1400 }),
				fc.integer({ min: 5, max: 120 }),
				(taken, from, duration) => {
					const slot = nextFreeSlot(taken, from, duration);
					if (slot !== null) {
						expect(slot).toBeGreaterThanOrEqual(from);
						for (const block of taken) {
							expect(slot < block.end && block.start < slot + duration).toBe(false);
						}
					}
				},
			),
		);
	});
});

describe("block edits", () => {
	it("sets, replaces and removes time blocks", () => {
		expect(withBlock("- [ ] Write", 540, 600)).toBe("- [ ] 09:00 - 10:00 Write");
		expect(withBlock("\t- [x] 08:00 - 08:30 Write ⏳ 2026-10-29", 600, null)).toBe(
			"\t- [x] 10:00 Write ⏳ 2026-10-29",
		);
		expect(withoutBlock("- [ ] 09:00 - 10:00 Write")).toBe("- [ ] Write");
		expect(withBlock("- note", 1, 2)).toBeNull();
		expect(withoutBlock("plain")).toBeNull();
		expect(newBlockLine("  Lunch ", 720, 780)).toBe("- [ ] 12:00 - 13:00 Lunch");
	});

	it("normalizes ranges to the step and the day", () => {
		expect(normalizeRange(547, 601, 15)).toEqual({ start: 540, end: 600 });
		expect(normalizeRange(-30, 10, 15)).toEqual({ start: 0, end: 45 });
		expect(normalizeRange(1430, 1500, 15)).toEqual({ start: 1425, end: 1440 });
		expect(normalizeRange(600, 600, 15)).toEqual({ start: 600, end: 615 });
	});
});

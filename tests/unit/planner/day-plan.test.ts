import { describe, expect, it } from "bun:test";
import fc from "fast-check";

import {
	buildDayPlan,
	childrenOf,
	currentBlock,
	descendantsOf,
	layoutColumns,
	newBlockLine,
	nextBlock,
	nextFreeSlot,
	normalizeRange,
	shiftBlockLine,
	withBlock,
	withoutBlock,
} from "../../../src/features/planner";
import { tasksIn } from "../../fakes/tasks";

const daily = tasksIn(
	"2026-10-29.md",
	[
		"- [ ] 09:00 - 10:00 Write spec ⏫",
		"- [x] 10:30 Standup",
		"- [ ] Buy milk",
		"- [x] Done without time",
		"- [ ] 09:30 - 11:00 Overlap",
	].join("\n"),
);
const elsewhere = tasksIn(
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

describe("nested blocks", () => {
	const DATE = "2026-10-29";
	const planOf = (note: string, extra: Record<string, string> = {}, duration = 30) =>
		buildDayPlan(
			DATE,
			"d.md",
			[
				...tasksIn("d.md", note),
				...Object.entries(extra).flatMap(([path, text]) => tasksIn(path, text)),
			],
			duration,
		);
	const shape = (plan: ReturnType<typeof planOf>) =>
		plan.blocks.map((block) => [block.title, block.parentId, block.depth]);

	const MAIN = [
		"- [ ] 00:00 - 2:00 Main",
		"\t- [ ] 00:00 - 1:00 Sub",
		"\t- [ ] 1:00 - 2:00 Sub 2",
	].join("\n");

	it("draws sub blocks inside the block of the task they are under", () => {
		const plan = planOf(MAIN);
		expect(shape(plan)).toEqual([
			["Main", null, 0],
			["Sub", "d.md:0", 1],
			["Sub 2", "d.md:0", 1],
		]);
		expect(plan.blocks.map((block) => [block.column, block.columns])).toEqual([
			[0, 1],
			[0, 1],
			[0, 1],
		]);
		expect(plan.plannedMinutes).toBe(120);
		expect(childrenOf(plan, { id: "d.md:0" }).map((block) => block.title)).toEqual([
			"Sub",
			"Sub 2",
		]);
	});

	it("lays out overlapping sub blocks side by side inside the parent", () => {
		const plan = planOf(
			["- [ ] 0:00 - 2:00 Main", "\t- [ ] 0:00 - 1:30 A", "\t- [ ] 1:00 - 2:00 B"].join("\n"),
		);
		expect(plan.blocks.map((block) => [block.title, block.column, block.columns])).toEqual([
			["Main", 0, 1],
			["A", 0, 2],
			["B", 1, 2],
		]);
	});

	it("keeps a sub block that sticks out of its parent as a separate block", () => {
		const plan = planOf(["- [ ] 0:00 - 2:00 Main", "\t- [ ] 1:30 - 2:30 Late"].join("\n"));
		expect(shape(plan)).toEqual([
			["Main", null, 0],
			["Late", null, 0],
		]);
		expect(plan.blocks.map((block) => block.columns)).toEqual([2, 2]);
		expect(plan.plannedMinutes).toBe(120 + 60);
	});

	it("nests a sub block with exactly the parent's time", () => {
		const plan = planOf(["- [ ] 1:00 - 2:00 Main", "\t- [ ] 1:00 - 2:00 Same"].join("\n"));
		expect(plan.blocks.find((block) => block.title === "Same")?.parentId).toBe("d.md:0");
		expect(plan.plannedMinutes).toBe(60);
	});

	it("nests three levels", () => {
		const plan = planOf(
			[
				"- [ ] 0:00 - 4:00 Top",
				"\t- [ ] 0:00 - 2:00 Mid",
				"\t\t- [ ] 0:00 - 1:00 Leaf",
				"\t- [ ] 3:00 - 4:00 Other",
			].join("\n"),
		);
		expect(shape(plan)).toEqual([
			["Top", null, 0],
			["Mid", "d.md:0", 1],
			["Leaf", "d.md:1", 2],
			["Other", "d.md:0", 1],
		]);
		expect(descendantsOf(plan, { id: "d.md:0" }).map((block) => block.title)).toEqual([
			"Mid",
			"Leaf",
			"Other",
		]);
		expect(descendantsOf(plan, { id: "d.md:1" }).map((block) => block.title)).toEqual(["Leaf"]);
		expect(descendantsOf(plan, { id: "d.md:3" })).toEqual([]);
	});

	it("skips a task without a time when looking for the parent block", () => {
		const plan = planOf(
			["- [ ] 0:00 - 4:00 Top", "\t- [ ] Middle", "\t\t- [ ] 1:00 - 2:00 Leaf"].join("\n"),
		);
		expect(plan.blocks.find((block) => block.title === "Leaf")).toMatchObject({
			parentId: "d.md:0",
			depth: 1,
		});
		expect(plan.unscheduled.map((task) => task.title)).toEqual(["Middle"]);
	});

	it("finds a farther ancestor when the closest one does not contain the block", () => {
		const plan = planOf(
			["- [ ] 0:00 - 4:00 Top", "\t- [ ] 0:00 - 2:00 Mid", "\t\t- [ ] 3:00 - 4:00 Leaf"].join(
				"\n",
			),
		);
		expect(plan.blocks.find((block) => block.title === "Leaf")?.parentId).toBe("d.md:0");
	});

	it("leaves sub blocks on their own when the parent has no time", () => {
		const plan = planOf(
			["- [ ] Parent", "\t- [ ] 1:00 - 2:00 A", "\t- [ ] 3:00 - 4:00 B"].join("\n"),
		);
		expect(shape(plan)).toEqual([
			["A", null, 0],
			["B", null, 0],
		]);
		expect(plan.unscheduled.map((task) => task.title)).toEqual(["Parent"]);
	});

	it("counts a sub task with only a start by the default duration", () => {
		const fits = planOf(["- [ ] 0:00 - 2:00 Main", "\t- [ ] 1:00 Start only"].join("\n"));
		expect(fits.blocks.find((block) => block.title === "Start only")).toMatchObject({
			parentId: "d.md:0",
			end: 90,
			explicitEnd: false,
		});
		const sticksOut = planOf(["- [ ] 0:00 - 2:00 Main", "\t- [ ] 1:45 Start only"].join("\n"));
		expect(sticksOut.blocks.find((block) => block.title === "Start only")?.parentId).toBeNull();
	});

	it("lists an open sub task without a time as unscheduled, not as a block", () => {
		const plan = planOf(["- [ ] 0:00 - 2:00 Main", "\t- [ ] Think"].join("\n"));
		expect(plan.blocks).toHaveLength(1);
		expect(plan.unscheduled.map((task) => task.title)).toEqual(["Think"]);
	});

	it("nests done blocks too", () => {
		const plan = planOf(["- [x] 0:00 - 2:00 Main", "\t- [x] 0:00 - 1:00 Sub"].join("\n"));
		expect(plan.blocks.map((block) => [block.title, block.state, block.depth])).toEqual([
			["Main", "done", 0],
			["Sub", "done", 1],
		]);
	});

	it("does not nest across notes", () => {
		const plan = planOf("- [ ] 0:00 - 2:00 Main", {
			"e.md": "- [ ] Child ⏳ 2026-10-29\n\t- [ ] 1:00 - 2:00 Inner ⏳ 2026-10-29",
		});
		expect(plan.blocks.find((block) => block.title === "Inner")).toMatchObject({
			parentId: null,
			source: "scheduled",
		});
	});

	it("nests up to the end of the day and with 12-hour times", () => {
		const late = planOf(["- [ ] 22:00 - 24:00 Night", "\t- [ ] 23:00 - 24:00 Late"].join("\n"));
		expect(late.blocks.find((block) => block.title === "Late")).toMatchObject({
			parentId: "d.md:0",
			end: 1440,
		});
		const morning = planOf(
			["- [ ] 9:00 am - 12:00 pm Morning", "\t- [ ] 10:00 am - 11:00 am Call"].join("\n"),
		);
		expect(morning.blocks.find((block) => block.title === "Call")?.parentId).toBe("d.md:0");
	});

	it("uses the default duration for a parent whose end is before its start", () => {
		const plan = planOf(
			["- [ ] 10:00 - 09:00 Backwards", "\t- [ ] 10:00 - 10:20 Inside"].join("\n"),
		);
		expect(plan.blocks.map((block) => [block.title, block.end, block.depth])).toEqual([
			["Backwards", 630, 0],
			["Inside", 620, 1],
		]);
	});

	it("orders blocks that start together by end, then line", () => {
		const plan = planOf(
			["- [ ] 1:00 - 3:00 Long", "- [ ] 1:00 - 2:00 Short", "- [ ] 1:00 - 2:00 Twin"].join(
				"\n",
			),
		);
		expect(plan.blocks.map((block) => block.title)).toEqual(["Short", "Twin", "Long"]);
	});

	it("reports the innermost open block as current", () => {
		const plan = planOf(MAIN);
		expect(currentBlock(plan, 30)?.title).toBe("Sub");
		expect(currentBlock(plan, 90)?.title).toBe("Sub 2");
		expect(nextBlock(plan, 30)?.title).toBe("Sub 2");
		const done = planOf(["- [ ] 0:00 - 2:00 Main", "\t- [x] 0:00 - 1:00 Sub"].join("\n"));
		expect(currentBlock(done, 30)?.title).toBe("Main");
	});
});

describe("shiftBlockLine", () => {
	const block = (text: string) => {
		const [task] = buildDayPlan("2026-10-29", "d.md", tasksIn("d.md", text), 30).blocks;
		if (!task) {
			throw new Error("no block");
		}
		return task;
	};

	it("moves both ends of a block and keeps the rest of the line", () => {
		const raw = "\t- [x] 1:00 - 2:00 Sub  [completion:: 2026-10-29]";
		expect(shiftBlockLine(raw, block(raw), 60)).toBe(
			"\t- [x] 02:00 - 03:00 Sub  [completion:: 2026-10-29]",
		);
		expect(shiftBlockLine(raw, block(raw), -30)).toBe(
			"\t- [x] 00:30 - 01:30 Sub  [completion:: 2026-10-29]",
		);
	});

	it("does not add an end to a block that only has a start", () => {
		const raw = "- [ ] 10:30 Standup";
		expect(shiftBlockLine(raw, block(raw), 30)).toBe("- [ ] 11:00 Standup");
	});

	it("writes a block whose end was before its start as a start only", () => {
		const raw = "- [ ] 10:00 - 09:00 Backwards";
		expect(shiftBlockLine(raw, block(raw), 60)).toBe("- [ ] 11:00 Backwards");
	});

	it("leaves lines that are not tasks alone", () => {
		const base = block("- [ ] 10:00 - 11:00 A");
		expect(shiftBlockLine("- 10:00 - 11:00 bullet", base, 30)).toBeNull();
		expect(shiftBlockLine("text", base, 30)).toBeNull();
	});
});

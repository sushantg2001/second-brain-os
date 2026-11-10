import { describe, expect, it } from "bun:test";

import { layoutClockLane, type LaneRange } from "../../../src/features/planner";

const range = (
	key: string,
	start: number,
	end: number,
	options: Partial<Pick<LaneRange, "parentKey" | "depth" | "leaf">> = {},
): LaneRange => ({ key, start, end, parentKey: null, depth: 0, leaf: true, ...options });

function placeOf(ranges: readonly LaneRange[], key: string) {
	const place = layoutClockLane(ranges).places.get(key);
	if (!place) {
		throw new Error(`No place for ${key}`);
	}
	return place;
}

describe("layoutClockLane", () => {
	it("gives a lone range the whole lane", () => {
		const lane = layoutClockLane([range("a", 600, 660)]);
		expect(lane.places.get("a")).toEqual({ left: 0, width: 100 });
		expect(lane.tracks).toBe(1);
	});

	it("puts a task and its sub tasks in the columns of its share, in order", () => {
		const ranges = [
			range("main", 600, 700, { leaf: false }),
			range("sub", 600, 650, { parentKey: "main", depth: 1 }),
			range("sub2", 650, 700, { parentKey: "main", depth: 1 }),
		];
		expect(placeOf(ranges, "main")).toEqual({ left: 0, width: 50 });
		expect(placeOf(ranges, "sub")).toEqual({ left: 50, width: 50 });
		expect(placeOf(ranges, "sub2")).toEqual({ left: 50, width: 50 });
	});

	it("lets a range with nothing inside it run to the edge of its share", () => {
		const ranges = [
			range("main", 600, 700, { leaf: false }),
			range("sub", 600, 650, { parentKey: "main", depth: 1 }),
			range("alone", 800, 860),
		];
		// "alone" is at the first level of a lane that has two, but has nothing under it.
		expect(placeOf(ranges, "alone")).toEqual({ left: 0, width: 100 });
	});

	it("sets tasks clocked over the same time side by side, each with its sub tasks", () => {
		const ranges = [
			range("one", 660, 840, { leaf: false }),
			range("one-sub", 660, 840, { parentKey: "one", depth: 1 }),
			range("two", 798, 870, { leaf: false }),
			range("two-sub", 798, 870, { parentKey: "two", depth: 1 }),
		];
		const lane = layoutClockLane(ranges);
		expect(lane.tracks).toBe(2);
		expect(lane.places.get("one")).toEqual({ left: 0, width: 25 });
		expect(lane.places.get("one-sub")).toEqual({ left: 25, width: 25 });
		expect(lane.places.get("two")).toEqual({ left: 50, width: 25 });
		expect(lane.places.get("two-sub")).toEqual({ left: 75, width: 25 });
	});

	it("does not narrow a task that overlaps nothing because another day's tasks do", () => {
		const ranges = [
			range("early", 600, 660),
			range("a", 800, 900),
			range("b", 850, 950),
			range("late", 1000, 1060),
		];
		expect(placeOf(ranges, "early")).toEqual({ left: 0, width: 100 });
		expect(placeOf(ranges, "late")).toEqual({ left: 0, width: 100 });
		expect(placeOf(ranges, "a").width).toBe(50);
		expect(placeOf(ranges, "b")).toEqual({ left: 50, width: 50 });
	});

	it("gives an empty day no places", () => {
		const lane = layoutClockLane([]);
		expect(lane.places.size).toBe(0);
		expect(lane.tracks).toBe(1);
	});
});

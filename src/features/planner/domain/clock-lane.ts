import type { Minutes } from "../../../shared/kernel";
import { layoutColumns } from "./day-plan";

/** What the lane needs to know about a clocked range. */
export interface LaneRange {
	readonly key: string;
	/** The range that holds this one, or null for the range of a task that is not under another. */
	readonly parentKey: string | null;
	readonly start: Minutes;
	readonly end: Minutes;
	/** 0 for a task that is not under another task; 1 for a sub task of that, and so on. */
	readonly depth: number;
	/** True when no range of a sub task sits inside this one. */
	readonly leaf: boolean;
}

/** Where a range goes in the lane, as percentages of the lane's width. */
export interface LanePlace {
	readonly left: number;
	readonly width: number;
}

/**
 * Lays out the lane of clocked time. Tasks clocked over the same time sit side by side, each with
 * its sub tasks in the columns after it, so one never covers another. Within its share of the
 * lane a task takes the first column and its sub tasks the ones after, and a block with nothing
 * inside it runs on to the edge of its share.
 */
export function layoutClockLane(ranges: readonly LaneRange[]): {
	readonly places: ReadonlyMap<string, LanePlace>;
	/** How many tasks are clocked side by side at the most. */
	readonly tracks: number;
} {
	const roots = ranges
		.filter((range) => range.parentKey === null)
		.sort((a, b) => a.start - b.start || a.end - b.end);
	const slots = new Map(roots.map((root) => [root.key, { column: 0, columns: 1 }]));
	for (const root of layoutColumns(roots)) {
		slots.set(root.key, { column: root.column, columns: root.columns });
	}
	const parents = new Map(ranges.map((range) => [range.key, range.parentKey]));
	const rootOf = (key: string): string => {
		let current = key;
		for (let up = parents.get(current); up; up = parents.get(current)) {
			current = up;
		}
		return current;
	};
	const levels = Math.max(0, ...ranges.map((range) => range.depth)) + 1;
	const places = new Map<string, LanePlace>();
	for (const range of ranges) {
		const { column, columns } = slots.get(rootOf(range.key)) ?? { column: 0, columns: 1 };
		const share = 100 / columns;
		const level = share / levels;
		const left = column * share + range.depth * level;
		const right = range.leaf ? (column + 1) * share : left + level;
		places.set(range.key, { left, width: right - left });
	}
	return { places, tracks: Math.max(1, ...[...slots.values()].map((slot) => slot.columns)) };
}

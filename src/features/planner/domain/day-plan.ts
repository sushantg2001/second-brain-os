import { MINUTES_PER_DAY, type IsoDate, type Minutes } from "../../../shared/kernel";
import { displayText, isClosed, stripTimeBlock, type Task, type TaskState } from "../../tasks";

export type BlockSource = "daily" | "scheduled";

export interface PlannedTask {
	/** Stable within one read of the vault: path and line. */
	readonly id: string;
	readonly path: string;
	readonly line: number;
	readonly raw: string;
	readonly title: string;
	readonly state: TaskState;
	readonly source: BlockSource;
}

export interface PlannedBlock extends PlannedTask {
	readonly start: Minutes;
	readonly end: Minutes;
	/** False when the task only has a start time and `end` uses the default duration. */
	readonly explicitEnd: boolean;
	/** Column within a group of overlapping blocks, and the group's column count. */
	readonly column: number;
	readonly columns: number;
}

export interface DayPlan {
	readonly date: IsoDate;
	readonly blocks: readonly PlannedBlock[];
	/** Open tasks for the day without a time. */
	readonly unscheduled: readonly PlannedTask[];
	/** Total minutes of open and done blocks, counting overlaps once per block. */
	readonly plannedMinutes: Minutes;
}

function plannedTask(task: Task, source: BlockSource): PlannedTask {
	return {
		id: `${task.path}:${task.line}`,
		path: task.path,
		line: task.line,
		raw: task.raw,
		title: displayText(stripTimeBlock(task.text)) || "Untitled",
		state: task.state,
		source,
	};
}

/** Assigns side-by-side columns to overlapping blocks. Blocks must be sorted by start. */
export function layoutColumns<T extends { start: Minutes; end: Minutes }>(
	blocks: readonly T[],
): (T & { column: number; columns: number })[] {
	const result: (T & { column: number; columns: number })[] = [];
	let group: (T & { column: number; columns: number })[] = [];
	let groupEnd = -1;
	const flush = (): void => {
		const columns = Math.max(1, ...group.map((block) => block.column + 1));
		for (const block of group) {
			result.push({ ...block, columns });
		}
		group = [];
	};
	for (const block of blocks) {
		if (block.start >= groupEnd && group.length > 0) {
			flush();
		}
		const taken = new Set(
			group.filter((other) => other.end > block.start).map((other) => other.column),
		);
		let column = 0;
		while (taken.has(column)) {
			column++;
		}
		group.push({ ...block, column, columns: 1 });
		groupEnd = Math.max(groupEnd, block.end);
	}
	if (group.length > 0) {
		flush();
	}
	return result;
}

/**
 * The plan for one day: tasks in its daily note plus tasks elsewhere scheduled for it.
 * Tasks with a time become blocks; open tasks without one are listed as unscheduled.
 */
export function buildDayPlan(
	date: IsoDate,
	dailyPath: string | null,
	tasks: Iterable<Task>,
	defaultDuration: Minutes,
): DayPlan {
	const timed: Omit<PlannedBlock, "column" | "columns">[] = [];
	const unscheduled: PlannedTask[] = [];
	for (const task of tasks) {
		const source: BlockSource | null =
			task.path === dailyPath ? "daily" : task.fields.scheduled === date ? "scheduled" : null;
		if (source === null) {
			continue;
		}
		const base = plannedTask(task, source);
		if (task.block) {
			const end =
				task.block.end ?? Math.min(MINUTES_PER_DAY, task.block.start + defaultDuration);
			timed.push({
				...base,
				start: task.block.start,
				end,
				explicitEnd: task.block.end !== null,
			});
		} else if (!isClosed(task.state)) {
			unscheduled.push(base);
		}
	}
	timed.sort((a, b) => a.start - b.start || a.end - b.end || a.line - b.line);
	const blocks = layoutColumns(timed);
	const plannedMinutes = blocks.reduce((sum, block) => sum + (block.end - block.start), 0);
	return { date, blocks, unscheduled, plannedMinutes };
}

/** The first gap of `duration` minutes at or after `from`, or null when the day is full. */
export function nextFreeSlot(
	blocks: readonly { start: Minutes; end: Minutes }[],
	from: Minutes,
	duration: Minutes,
	dayEnd: Minutes = MINUTES_PER_DAY,
): Minutes | null {
	let candidate = from;
	for (const block of [...blocks].sort((a, b) => a.start - b.start)) {
		if (block.end <= candidate) {
			continue;
		}
		if (block.start >= candidate + duration) {
			break;
		}
		candidate = Math.max(candidate, block.end);
	}
	return candidate + duration <= dayEnd ? candidate : null;
}

export function currentBlock(plan: DayPlan, now: Minutes): PlannedBlock | null {
	return (
		plan.blocks.find(
			(block) => block.start <= now && now < block.end && !isClosed(block.state),
		) ?? null
	);
}

export function nextBlock(plan: DayPlan, now: Minutes): PlannedBlock | null {
	return plan.blocks.find((block) => block.start > now && !isClosed(block.state)) ?? null;
}

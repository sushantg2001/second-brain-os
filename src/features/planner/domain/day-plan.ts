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

/** A task nested under a block, listed inside it. */
export interface PlannedSubTask extends PlannedTask {
	/** 0 for a task directly under the block, 1 for one under that, and so on. */
	readonly level: number;
}

export interface PlannedBlock extends PlannedTask {
	readonly start: Minutes;
	readonly end: Minutes;
	/** False when the task only has a start time and `end` uses the default duration. */
	readonly explicitEnd: boolean;
	/** Column within a group of overlapping sibling blocks, and the group's column count. */
	readonly column: number;
	readonly columns: number;
	/** The block this one sits inside, or null for a block that is not inside another. */
	readonly parentId: string | null;
	/** 0 for a block that is not inside another, 1 for one inside that, and so on. */
	readonly depth: number;
	/**
	 * Tasks nested under this block's task that are not blocks of their own: a day's log often
	 * has a timed task with the things done in it listed below, without times. Sub tasks that are
	 * drawn as blocks inside this one are not repeated here.
	 */
	readonly subtasks: readonly PlannedSubTask[];
}

export interface DayPlan {
	readonly date: IsoDate;
	readonly blocks: readonly PlannedBlock[];
	/** Open tasks for the day without a time. */
	readonly unscheduled: readonly PlannedTask[];
	/**
	 * Total minutes of open and done blocks, counting overlaps once per block. A block inside
	 * another is part of it and adds nothing.
	 */
	readonly plannedMinutes: Minutes;
}

function taskKey(task: { path: string; line: number }): string {
	return `${task.path}:${task.line}`;
}

function plannedTask(task: Task, source: BlockSource): PlannedTask {
	return {
		id: taskKey(task),
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

type Timed = Omit<PlannedBlock, "column" | "columns" | "parentId" | "depth" | "subtasks"> & {
	readonly task: Task;
};

function byTime(a: { start: Minutes; end: Minutes; line: number }, b: typeof a): number {
	return a.start - b.start || a.end - b.end || a.line - b.line;
}

/**
 * The plan for one day: tasks in its daily note plus tasks elsewhere scheduled for it.
 * Tasks with a time become blocks; open tasks without one are listed as unscheduled.
 *
 * A block whose time falls inside that of a task it is nested under is drawn inside it: its parent
 * is the closest task above it, in the same note, that has a block containing it. Blocks that only
 * overlap, or are not inside the block of the task they are under, sit side by side.
 *
 * `inNote` lists every task in a note, so a block can list the tasks nested under it even when
 * they are not themselves part of the day. Without it only `tasks` are looked at.
 */
export function buildDayPlan(
	date: IsoDate,
	dailyPath: string | null,
	tasks: Iterable<Task>,
	defaultDuration: Minutes,
	inNote?: (path: string) => readonly Task[],
): DayPlan {
	const all = [...tasks];
	const timed: Timed[] = [];
	const unscheduled: PlannedTask[] = [];
	for (const task of all) {
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
				task,
				start: task.block.start,
				end,
				explicitEnd: task.block.end !== null,
			});
		} else if (!isClosed(task.state)) {
			unscheduled.push(base);
		}
	}
	timed.sort(byTime);

	const taskAt = new Map(all.map((task) => [`${task.path}:${task.line}`, task]));
	const blockAt = new Map(timed.map((block) => [block.id, block]));
	const parentOf = (block: Timed): Timed | null => {
		let up = block.task.parentLine;
		while (up !== null) {
			const ancestor = taskAt.get(`${block.path}:${up}`);
			const candidate = ancestor
				? blockAt.get(`${ancestor.path}:${ancestor.line}`)
				: undefined;
			if (candidate && candidate.start <= block.start && block.end <= candidate.end) {
				return candidate;
			}
			up = ancestor ? ancestor.parentLine : null;
		}
		return null;
	};
	const parents = new Map(timed.map((block) => [block.id, parentOf(block)?.id ?? null]));
	const depthOf = (id: string): number => {
		const parent = parents.get(id) ?? null;
		return parent === null ? 0 : depthOf(parent) + 1;
	};

	const nestedUnder = new Map<string, Task[]>();
	const noted = new Set<string>();
	const noteTasks = (path: string): readonly Task[] =>
		inNote ? inNote(path) : all.filter((task) => task.path === path);
	const childTasks = (task: Task): readonly Task[] => {
		if (!noted.has(task.path)) {
			noted.add(task.path);
			for (const candidate of noteTasks(task.path)) {
				if (candidate.parentLine !== null) {
					const key = `${task.path}:${candidate.parentLine}`;
					nestedUnder.set(key, [...(nestedUnder.get(key) ?? []), candidate]);
				}
			}
		}
		return nestedUnder.get(taskKey(task)) ?? [];
	};
	const subtasksOf = (block: Timed): PlannedSubTask[] => {
		const found: PlannedSubTask[] = [];
		const walk = (task: Task, level: number): void => {
			for (const child of childTasks(task)) {
				// A sub task drawn as a block lists its own sub tasks.
				if (!blockAt.has(taskKey(child))) {
					found.push({ ...plannedTask(child, block.source), level });
					walk(child, level + 1);
				}
			}
		};
		walk(block.task, 0);
		return found;
	};

	const groups = new Map<string | null, Timed[]>();
	for (const block of timed) {
		const parent = parents.get(block.id) ?? null;
		groups.set(parent, [...(groups.get(parent) ?? []), block]);
	}
	const blocks = [...groups.entries()]
		.flatMap(([parentId, group]) =>
			layoutColumns(group).map(({ task, ...block }) => ({
				...block,
				parentId,
				depth: depthOf(block.id),
				subtasks: subtasksOf({ ...block, task }),
			})),
		)
		.sort((a, b) => a.start - b.start || a.depth - b.depth || byTime(a, b));
	const plannedMinutes = blocks
		.filter((block) => block.parentId === null)
		.reduce((sum, block) => sum + (block.end - block.start), 0);
	return { date, blocks, unscheduled, plannedMinutes };
}

/** The blocks drawn directly inside a block. */
export function childrenOf(plan: DayPlan, block: { id: string }): PlannedBlock[] {
	return plan.blocks.filter((candidate) => candidate.parentId === block.id);
}

/** Every block inside a block, at any depth. */
export function descendantsOf(plan: DayPlan, block: { id: string }): PlannedBlock[] {
	return childrenOf(plan, block).flatMap((child) => [child, ...descendantsOf(plan, child)]);
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

/** The open block that holds `now`; the innermost one when blocks are nested. */
export function currentBlock(plan: DayPlan, now: Minutes): PlannedBlock | null {
	let current: PlannedBlock | null = null;
	for (const block of plan.blocks) {
		if (
			block.start <= now &&
			now < block.end &&
			!isClosed(block.state) &&
			(current === null || block.depth > current.depth)
		) {
			current = block;
		}
	}
	return current;
}

export function nextBlock(plan: DayPlan, now: Minutes): PlannedBlock | null {
	return plan.blocks.find((block) => block.start > now && !isClosed(block.state)) ?? null;
}

import {
	err,
	ok,
	select,
	type Clock,
	type IsoDate,
	type Minutes,
	type NoteStore,
	type NowSnapshot,
	type ReadableStore,
	type Result,
} from "../../../shared/kernel";
import {
	displayText,
	locate,
	parseListLine,
	stripTimeBlock,
	type Task,
	type TaskIndex,
	type TaskRef,
	type TaskSnapshot,
} from "../../tasks";
import {
	datesOf,
	entryMinutes,
	minutesOnDate,
	momentNow,
	rangeOnDate,
} from "../domain/clock-entry";
import { clocksOf, closeClockIn, openClockLine, type ClockLine } from "../domain/task-clocks";

export interface RunningClock {
	readonly task: Task;
	readonly clock: ClockLine;
}

export interface ClockedRange {
	/** Unique among the ranges of one day, for rendering. */
	readonly key: string;
	readonly taskId: string;
	/** Where the task is, so the range can open it. */
	readonly path: string;
	readonly line: number;
	readonly title: string;
	readonly start: Minutes;
	readonly end: Minutes;
	readonly running: boolean;
	/** 0 for a task that is not nested under another task; 1 for a sub task of that, and so on. */
	readonly depth: number;
	/** The range of the task above this one that holds it, or null for a range at depth 0. */
	readonly parentKey: string | null;
	/** True when no range of a sub task sits inside this one. */
	readonly leaf: boolean;
}

export interface ClocksDeps {
	readonly tasks: TaskIndex;
	readonly notes: NoteStore;
	readonly now: ReadableStore<NowSnapshot>;
	readonly clock: Clock;
}

interface Span {
	start: Minutes;
	end: Minutes;
	running: boolean;
}

/**
 * Spans closer together than this, in minutes, are one stretch of work: stopping a clock by hand
 * and starting the next leaves a few seconds between them.
 */
const JOIN_WITHIN = 1;

/** Joins spans that overlap, touch or are only a moment apart into one. */
function mergeSpans(spans: readonly Span[]): Span[] {
	const merged: Span[] = [];
	for (const span of [...spans].sort((a, b) => a.start - b.start)) {
		const last = merged.at(-1);
		if (last && span.start <= last.end + JOIN_WITHIN) {
			last.end = Math.max(last.end, span.end);
			last.running = last.running || span.running;
		} else {
			merged.push({ ...span });
		}
	}
	return merged;
}

function taskKey(task: { path: string; line: number }): string {
	return `${task.path}:${task.line}`;
}

export function taskTitle(task: Task): string {
	return displayText(stripTimeBlock(task.text)) || "Untitled";
}

function findRunning(tasks: Iterable<Task>): RunningClock[] {
	const running: RunningClock[] = [];
	for (const task of tasks) {
		for (const clock of clocksOf(task)) {
			if (clock.end === null) {
				running.push({ task, clock });
			}
		}
	}
	return running.sort((a, b) =>
		a.clock.start.date === b.clock.start.date
			? a.clock.start.minutes - b.clock.start.minutes
			: a.clock.start.date < b.clock.start.date
				? -1
				: 1,
	);
}

/**
 * What the clock views need from the task index: every task by position, so a task's parents can
 * be found, and the few that have clock lines, with those lines read once.
 */
interface ClockIndex {
	readonly snapshot: TaskSnapshot;
	readonly tasks: ReadonlyMap<string, Task>;
	readonly clocked: readonly { readonly task: Task; readonly clocks: readonly ClockLine[] }[];
}

/** Time tracking: `clock` fields written on the lines under tasks, found by Dataview. */
export class Clocks {
	readonly #running: ReadableStore<readonly RunningClock[]>;
	#index: ClockIndex | null = null;
	/** Ranges by day, valid for one version of the task index and one minute of the day. */
	#ranges: {
		readonly snapshot: TaskSnapshot;
		readonly now: NowSnapshot;
		readonly byDate: Map<IsoDate, ClockedRange[]>;
	} | null = null;

	constructor(private readonly deps: ClocksDeps) {
		this.#running = select(deps.tasks.snapshot, () => findRunning(deps.tasks.all()));
	}

	/**
	 * Read once per version of the task index. The views ask on every render, a drag renders on
	 * every pointer move, and a vault holds thousands of tasks of which a few have clocks.
	 */
	#indexed(): ClockIndex {
		const snapshot = this.deps.tasks.snapshot.get();
		if (this.#index?.snapshot !== snapshot) {
			const tasks = new Map<string, Task>();
			const clocked: { task: Task; clocks: ClockLine[] }[] = [];
			for (const task of this.deps.tasks.all()) {
				tasks.set(taskKey(task), task);
				const clocks = clocksOf(task);
				if (clocks.length > 0) {
					clocked.push({ task, clocks });
				}
			}
			this.#index = { snapshot, tasks, clocked };
		}
		return this.#index;
	}

	/** Every running clock, oldest first. Normally zero or one. */
	get running(): ReadableStore<readonly RunningClock[]> {
		return this.#running;
	}

	/** The most recently started running clock. */
	active(): RunningClock | null {
		return this.#running.get().at(-1) ?? null;
	}

	isRunning(task: { path: string; line: number }): boolean {
		return this.#running
			.get()
			.some((running) => running.task.path === task.path && running.task.line === task.line);
	}

	/** Starts a clock on a task, stopping any other running clock first. */
	async start(ref: TaskRef): Promise<Result<void, Error>> {
		const stopped = await this.stop();
		if (!stopped.ok) {
			return stopped;
		}
		const now = momentNow(this.deps.clock);
		let failure: Error | null = null;
		await this.deps.notes.process(ref.path, (content) => {
			const lines = content.split(/\r?\n/);
			const at = locate(lines, ref);
			if (!at.ok) {
				failure = at.error;
				return content;
			}
			const task = this.deps.tasks.tasksIn(ref.path).find((found) => found.line === at.value);
			if (!task) {
				failure = new Error(
					"Dataview has not indexed that task yet. Try again in a moment.",
				);
				return content;
			}
			// One tab deeper than the task, below the lines that already continue it.
			const indent = `${parseListLine(lines[at.value] ?? "")?.indent ?? ""}\t`;
			lines.splice(at.value + task.lineCount, 0, openClockLine(indent, now));
			return lines.join(content.includes("\r\n") ? "\r\n" : "\n");
		});
		return failure ? err(failure) : ok(undefined);
	}

	/** Stops every running clock now. */
	async stop(): Promise<Result<void, Error>> {
		const now = momentNow(this.deps.clock);
		for (const { task, clock } of this.#running.get()) {
			let failure: Error | null = null;
			await this.deps.notes.process(task.path, (content) => {
				const next = closeClockIn(
					content,
					{ line: task.line, lastLine: task.lastLine, value: clock.value },
					now,
				);
				if (!next.ok) {
					failure = next.error;
					return content;
				}
				return next.value;
			});
			if (failure) {
				return err(failure);
			}
		}
		return ok(undefined);
	}

	/** Starts the clock on a task, or stops it when it is the running one. */
	toggle(ref: TaskRef): Promise<Result<void, Error>> {
		return this.isRunning(ref) ? this.stop() : this.start(ref);
	}

	/**
	 * Clocked ranges on a day, for drawing on the timeline. A task with clocked sub tasks gets
	 * ranges that span their time (overlapping or touching ones joined), so the sub task's range
	 * is drawn inside its parent's.
	 */
	rangesOn(date: IsoDate): ClockedRange[] {
		const { snapshot, tasks, clocked } = this.#indexed();
		const now = this.deps.now.get();
		if (this.#ranges?.snapshot !== snapshot || this.#ranges.now !== now) {
			this.#ranges = { snapshot, now, byDate: new Map() };
		}
		const known = this.#ranges.byDate.get(date);
		if (known) {
			return known;
		}
		const ranges = this.#rangesOn(date, now, tasks, clocked);
		this.#ranges.byDate.set(date, ranges);
		return ranges;
	}

	#rangesOn(
		date: IsoDate,
		now: NowSnapshot,
		tasks: ReadonlyMap<string, Task>,
		clocked: ClockIndex["clocked"],
	): ClockedRange[] {
		const parentOf = (task: Task): Task | undefined =>
			task.parentLine === null ? undefined : tasks.get(`${task.path}:${task.parentLine}`);
		const levelOf = (task: Task): number => {
			let level = 0;
			for (let up = parentOf(task); up; up = parentOf(up)) {
				level++;
			}
			return level;
		};

		const own = new Map<string, Span[]>();
		const nested = new Map<string, Span[]>();
		for (const { task, clocks } of clocked) {
			for (const clock of clocks) {
				const range = rangeOnDate(clock, date, now);
				if (!range) {
					continue;
				}
				const span = { ...range, running: clock.end === null };
				own.set(taskKey(task), [...(own.get(taskKey(task)) ?? []), span]);
				for (let up = parentOf(task); up; up = parentOf(up)) {
					nested.set(taskKey(up), [...(nested.get(taskKey(up)) ?? []), span]);
				}
			}
		}

		type Draft = Omit<ClockedRange, "parentKey" | "leaf">;
		const drafts: Draft[] = [];
		for (const key of new Set([...own.keys(), ...nested.keys()])) {
			const task = tasks.get(key);
			if (!task) {
				continue;
			}
			const inside = nested.get(key) ?? [];
			const spans =
				inside.length > 0
					? mergeSpans([...(own.get(key) ?? []), ...inside])
					: (own.get(key) ?? []);
			const depth = levelOf(task);
			spans.forEach((span, index) => {
				drafts.push({
					key: `${key}-${index}`,
					taskId: key,
					path: task.path,
					line: task.line,
					title: taskTitle(task),
					depth,
					...span,
				});
			});
		}

		// A sub task's range always lies inside one of its parent's, since the parent's ranges are
		// built from them, so the parent is the range of the task above that holds it.
		const byTask = new Map<string, Draft[]>();
		for (const draft of drafts) {
			byTask.set(draft.taskId, [...(byTask.get(draft.taskId) ?? []), draft]);
		}
		const parentKeyOf = (draft: Draft): string | null => {
			const task = tasks.get(draft.taskId);
			const above = task ? parentOf(task) : undefined;
			const holder = above
				? byTask
						.get(taskKey(above))
						?.find((range) => range.start <= draft.start && draft.end <= range.end)
				: undefined;
			return holder?.key ?? null;
		};
		const parents = new Map(drafts.map((draft) => [draft.key, parentKeyOf(draft)]));
		const holders = new Set(parents.values());
		return drafts
			.map((draft): ClockedRange => ({
				...draft,
				parentKey: parents.get(draft.key) ?? null,
				leaf: !holders.has(draft.key),
			}))
			.sort((a, b) => a.start - b.start || a.depth - b.depth);
	}

	minutesOn(date: IsoDate): Minutes {
		const now = this.deps.now.get();
		let total = 0;
		for (const { clocks } of this.#indexed().clocked) {
			for (const clock of clocks) {
				total += minutesOnDate(clock, date, now);
			}
		}
		return total;
	}

	/** Total clocked minutes for one task, counting the tasks nested under it. */
	minutesFor(task: Task): Minutes {
		const now = this.deps.now.get();
		return this.deps.tasks
			.tasksIn(task.path)
			.filter((nested) => nested.line >= task.line && nested.line <= task.lastLine)
			.flatMap(clocksOf)
			.reduce((sum, clock) => sum + entryMinutes(clock, now), 0);
	}

	/** Clocked minutes per day across the vault. */
	minutesByDate(): Map<IsoDate, Minutes> {
		const now = this.deps.now.get();
		const totals = new Map<IsoDate, Minutes>();
		for (const { clocks } of this.#indexed().clocked) {
			for (const clock of clocks) {
				for (const date of datesOf(clock, now)) {
					const minutes = minutesOnDate(clock, date, now);
					if (minutes > 0) {
						totals.set(date, (totals.get(date) ?? 0) + minutes);
					}
				}
			}
		}
		return totals;
	}
}

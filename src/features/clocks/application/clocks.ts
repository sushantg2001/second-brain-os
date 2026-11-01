import {
	err,
	ok,
	select,
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
	parseTasks,
	replaceLine,
	stripTimeBlock,
	type Task,
	type TaskIndex,
	type TaskRef,
} from "../../tasks";
import { datesOf, entryMinutes, minutesOnDate, rangeOnDate } from "../domain/clock-entry";
import {
	childIndent,
	closeClockLine,
	clocksOf,
	openClockLine,
	type ClockLine,
} from "../domain/task-clocks";

export interface RunningClock {
	readonly task: Task;
	readonly clock: ClockLine;
}

export interface ClockedRange {
	readonly taskId: string;
	readonly title: string;
	readonly start: Minutes;
	readonly end: Minutes;
	readonly running: boolean;
}

export interface ClocksDeps {
	readonly tasks: TaskIndex;
	readonly notes: NoteStore;
	readonly now: ReadableStore<NowSnapshot>;
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

/** Time tracking: clock entries written as list items under tasks. */
export class Clocks {
	readonly #running: ReadableStore<readonly RunningClock[]>;

	constructor(private readonly deps: ClocksDeps) {
		this.#running = select(deps.tasks.snapshot, () => findRunning(deps.tasks.all()));
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
		const now = this.deps.now.get();
		let failure: Error | null = null;
		await this.deps.notes.process(ref.path, (content) => {
			const lines = content.split(/\r?\n/);
			const at = locate(lines, ref);
			const task = at.ok
				? parseTasks(ref.path, content).find((candidate) => candidate.line === at.value)
				: undefined;
			if (!task) {
				failure = at.ok ? new Error("That line is not a task.") : at.error;
				return content;
			}
			const last = task.children.at(-1) ?? task;
			lines.splice(last.line + 1, 0, openClockLine(childIndent(task, content), now));
			return lines.join(content.includes("\r\n") ? "\r\n" : "\n");
		});
		await this.deps.tasks.update(ref.path);
		return failure ? err(failure) : ok(undefined);
	}

	/** Stops every running clock at the current minute. */
	async stop(): Promise<Result<void, Error>> {
		const now = this.deps.now.get();
		for (const { task, clock } of this.#running.get()) {
			let failure: Error | null = null;
			await this.deps.notes.process(task.path, (content) => {
				const closed = closeClockLine(clock.raw, now);
				const next = closed === null ? null : replaceLine(content, clock, closed);
				if (!next?.ok) {
					failure = next?.error ?? new Error("That clock is not running.");
					return content;
				}
				return next.value;
			});
			await this.deps.tasks.update(task.path);
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

	/** Clocked ranges on a day, for drawing on the timeline. */
	rangesOn(date: IsoDate): ClockedRange[] {
		const now = this.deps.now.get();
		const ranges: ClockedRange[] = [];
		for (const task of this.deps.tasks.all()) {
			for (const clock of clocksOf(task)) {
				const range = rangeOnDate(clock, date, now);
				if (range) {
					ranges.push({
						taskId: `${task.path}:${task.line}`,
						title: taskTitle(task),
						...range,
						running: clock.end === null,
					});
				}
			}
		}
		return ranges.sort((a, b) => a.start - b.start);
	}

	minutesOn(date: IsoDate): Minutes {
		const now = this.deps.now.get();
		let total = 0;
		for (const task of this.deps.tasks.all()) {
			for (const clock of clocksOf(task)) {
				total += minutesOnDate(clock, date, now);
			}
		}
		return total;
	}

	/** Total clocked minutes for one task. */
	minutesFor(task: Task): Minutes {
		const now = this.deps.now.get();
		return clocksOf(task).reduce((sum, clock) => sum + entryMinutes(clock, now), 0);
	}

	/** Clocked minutes per day across the vault. */
	minutesByDate(): Map<IsoDate, Minutes> {
		const now = this.deps.now.get();
		const totals = new Map<IsoDate, Minutes>();
		for (const task of this.deps.tasks.all()) {
			for (const clock of clocksOf(task)) {
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

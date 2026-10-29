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
	type YamlCodec,
} from "../../../shared/kernel";
import {
	displayText,
	locate,
	parseTasks,
	stripTimeBlock,
	type Task,
	type TaskIndex,
	type TaskRef,
} from "../../tasks";
import { datesOf, entryMinutes, minutesOnDate, rangeOnDate } from "../domain/clock-entry";
import {
	clocksOf,
	convertLegacy,
	describeStop,
	startClock,
	stopClock,
	type TaskClock,
} from "../domain/task-clocks";

export interface RunningClock {
	readonly task: Task;
	readonly clock: TaskClock;
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
	readonly yaml: YamlCodec;
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

	/**
	 * Rewrites one task's lines inside an atomic edit. The task is found again in the current
	 * text, so an edit never lands on a line that changed since it was read.
	 */
	private async editTask(
		ref: TaskRef,
		edit: (lines: readonly string[], task: Task) => Result<string[], Error> | null,
	): Promise<Result<boolean, Error>> {
		let outcome: Result<boolean, Error> = ok(false);
		await this.deps.notes.process(ref.path, (content) => {
			const lines = content.split(/\r?\n/);
			const at = locate(lines, ref);
			if (!at.ok) {
				outcome = at;
				return content;
			}
			const task = parseTasks(ref.path, content, (text) => this.deps.yaml.parse(text)).find(
				(candidate) => candidate.line === at.value,
			);
			if (!task) {
				outcome = err(new Error("That line is not a task."));
				return content;
			}
			const next = edit(lines, task);
			if (next === null) {
				return content;
			}
			if (!next.ok) {
				outcome = next;
				return content;
			}
			outcome = ok(true);
			return next.value.join(content.includes("\r\n") ? "\r\n" : "\n");
		});
		await this.deps.tasks.update(ref.path);
		return outcome;
	}

	/** Starts a clock on a task, stopping any other running clock first. */
	async start(ref: TaskRef): Promise<Result<void, Error>> {
		const stopped = await this.stop();
		if (!stopped.ok) {
			return stopped;
		}
		const now = this.deps.now.get();
		const result = await this.editTask(ref, (lines, task) =>
			startClock(lines, task, now, this.deps.yaml),
		);
		return result.ok ? ok(undefined) : result;
	}

	/** Stops the running clock on one task. */
	async stopTask(ref: TaskRef): Promise<Result<void, Error>> {
		const now = this.deps.now.get();
		const result = await this.editTask(ref, (lines, task) =>
			stopClock(lines, task, now, this.deps.yaml),
		);
		return result.ok ? ok(undefined) : result;
	}

	/** Stops every running clock at the current minute. */
	async stop(): Promise<Result<void, Error>> {
		const tasks = new Map<string, Task>();
		for (const { task } of this.#running.get()) {
			tasks.set(`${task.path}:${task.line}`, task);
		}
		for (const task of tasks.values()) {
			const result = await this.stopTask(task);
			if (!result.ok) {
				return result;
			}
		}
		return ok(undefined);
	}

	/** What stopping the clock on a task would record. */
	previewStop(task: Task): { before: string; after: string } | null {
		const running = clocksOf(task).find((clock) => clock.end === null);
		return running ? describeStop(running, this.deps.now.get()) : null;
	}

	/** Moves every older `[clock::]` item into its task's yaml log. Returns the tasks changed. */
	async convertLegacy(): Promise<Result<number, Error>> {
		const tasks = [...this.deps.tasks.all()].filter((task) =>
			clocksOf(task).some((clock) => clock.source.kind === "legacy"),
		);
		let changed = 0;
		// Bottom-up within each note, so earlier conversions do not move later tasks.
		for (const task of tasks.sort((a, b) =>
			a.path === b.path ? b.line - a.line : a.path < b.path ? -1 : 1,
		)) {
			const result = await this.editTask(task, (lines, current) =>
				convertLegacy(lines, current, this.deps.yaml),
			);
			if (!result.ok) {
				return result;
			}
			changed += result.value ? 1 : 0;
		}
		return ok(changed);
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

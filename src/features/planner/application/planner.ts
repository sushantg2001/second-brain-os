import {
	err,
	ok,
	Store,
	type Clock,
	type IsoDate,
	type Minutes,
	type NoteStore,
	type ReadableStore,
	type Result,
} from "../../../shared/kernel";
import type { PeriodicNotes } from "../../periodic";
import { appendToSection, type TaskActions, type TaskIndex, type TaskRef } from "../../tasks";
import { newBlockLine, normalizeRange, withBlock, withoutBlock } from "../domain/block-edits";
import { buildDayPlan, nextFreeSlot, type DayPlan, type PlannedTask } from "../domain/day-plan";
import type { PlannerSettings } from "../domain/settings";

export interface PlannerDeps {
	readonly tasks: TaskIndex;
	readonly actions: TaskActions;
	readonly periodic: PeriodicNotes;
	readonly notes: NoteStore;
	readonly settings: ReadableStore<PlannerSettings>;
	readonly clock: Clock;
}

function refOf(task: PlannedTask): TaskRef {
	return { path: task.path, line: task.line, raw: task.raw };
}

/** Builds day plans from the task index and writes block changes back to the notes. */
export class Planner {
	readonly #planned = new Store<ReadonlyMap<IsoDate, Minutes>>(new Map());
	#cache = new Map<IsoDate, DayPlan>();
	/** The inputs the cache was built from; any change (by identity) clears it. */
	#cacheInputs: readonly unknown[] = [];

	constructor(private readonly deps: PlannerDeps) {}

	get settings(): PlannerSettings {
		return this.deps.settings.get();
	}

	get settingsStore(): ReadableStore<PlannerSettings> {
		return this.deps.settings;
	}

	/** Planned minutes per day that has a daily note or scheduled tasks with times. */
	get plannedByDate(): ReadableStore<ReadonlyMap<IsoDate, Minutes>> {
		return this.#planned;
	}

	today(): IsoDate {
		return this.deps.clock.today();
	}

	plan(date: IsoDate): DayPlan {
		const inputs = [
			this.deps.tasks.snapshot.get(),
			this.deps.periodic.index.get(),
			this.deps.periodic.settings,
			this.settings.defaultDuration,
		];
		if (inputs.some((input, index) => input !== this.#cacheInputs[index])) {
			this.#cache = new Map();
			this.#cacheInputs = inputs;
		}
		let plan = this.#cache.get(date);
		if (!plan) {
			plan = buildDayPlan(
				date,
				this.deps.periodic.find("day", date),
				this.deps.tasks.all(),
				this.settings.defaultDuration,
			);
			this.#cache.set(date, plan);
		}
		return plan;
	}

	/** Recomputes planned minutes for the calendar. */
	refreshPlanned(): void {
		const dates = new Set<IsoDate>(this.deps.periodic.index.get().day.keys());
		for (const task of this.deps.tasks.all()) {
			if (task.fields.scheduled && task.block) {
				dates.add(task.fields.scheduled);
			}
		}
		const planned = new Map<IsoDate, Minutes>();
		for (const date of dates) {
			const minutes = this.plan(date).plannedMinutes;
			if (minutes > 0) {
				planned.set(date, minutes);
			}
		}
		this.#planned.set(planned);
	}

	/** Keeps planned minutes current. Returns the unsubscribe function. */
	attach(): () => void {
		const refresh = (): void => this.refreshPlanned();
		const unsubscribers = [
			this.deps.tasks.snapshot.subscribe(refresh),
			this.deps.periodic.index.subscribe(refresh),
			this.deps.settings.subscribe(refresh),
		];
		refresh();
		return () => {
			for (const unsubscribe of unsubscribers) {
				unsubscribe();
			}
		};
	}

	async moveBlock(task: PlannedTask, start: Minutes, end: Minutes): Promise<Result<void, Error>> {
		const range = normalizeRange(start, end, this.settings.snapMinutes);
		return this.deps.actions.editLine(refOf(task), (raw) =>
			withBlock(raw, range.start, range.end),
		);
	}

	unschedule(task: PlannedTask): Promise<Result<void, Error>> {
		return this.deps.actions.editLine(refOf(task), withoutBlock);
	}

	/** Gives an unscheduled task a time. Without a start, uses the next free slot. */
	async schedule(
		task: PlannedTask,
		date: IsoDate,
		start?: Minutes,
	): Promise<Result<void, Error>> {
		const duration = this.settings.defaultDuration;
		const slot = start ?? this.freeSlot(date, duration);
		if (slot === null) {
			return err(new Error("There is no free time left on that day."));
		}
		return this.moveBlock(task, slot, slot + duration);
	}

	/** Adds a new task with a time block to the day's note, creating the note if needed. */
	async createBlock(
		date: IsoDate,
		title: string,
		start: Minutes,
		end: Minutes,
	): Promise<Result<void, Error>> {
		if (!title.trim()) {
			return err(new Error("A block needs a title."));
		}
		const note = await this.deps.periodic.ensure("day", date);
		if (!note.ok) {
			return note;
		}
		const range = normalizeRange(start, end, this.settings.snapMinutes);
		const line = newBlockLine(title, range.start, range.end);
		await this.deps.notes.process(note.value.path, (content) =>
			appendToSection(content, this.settings.heading, [line]),
		);
		await this.deps.tasks.update(note.value.path);
		return ok(undefined);
	}

	toggleDone(task: PlannedTask): Promise<Result<void, Error>> {
		return this.deps.actions.toggleDone(refOf(task));
	}

	/** First free slot of the default length: from now for today, else from the day's start. */
	freeSlot(date: IsoDate, duration: Minutes = this.settings.defaultDuration): Minutes | null {
		const step = this.settings.snapMinutes;
		const dayStart = this.settings.startHour * 60;
		const from =
			date === this.today()
				? Math.max(dayStart, Math.ceil(this.deps.clock.nowMinutes() / step) * step)
				: dayStart;
		return nextFreeSlot(this.plan(date).blocks, from, duration, this.settings.endHour * 60);
	}
}

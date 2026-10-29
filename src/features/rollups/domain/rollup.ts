import { compareDates, type IsoDate, type Minutes } from "../../../shared/kernel";
import { isClosed, type Task } from "../../tasks";

export interface Rollup {
	readonly done: number;
	readonly total: number;
	/** 0 to 100, rounded. 0 when there are no tasks. */
	readonly percent: number;
	readonly clockedMinutes: Minutes;
	/** Latest completion or clock date, or null. */
	readonly lastActivity: IsoDate | null;
}

export const EMPTY_ROLLUP: Rollup = {
	done: 0,
	total: 0,
	percent: 0,
	clockedMinutes: 0,
	lastActivity: null,
};

function later(a: IsoDate | null, b: IsoDate | null): IsoDate | null {
	if (a === null) {
		return b;
	}
	if (b === null) {
		return a;
	}
	return compareDates(a, b) >= 0 ? a : b;
}

function percent(done: number, total: number): number {
	return total === 0 ? 0 : Math.round((done / total) * 100);
}

/**
 * Numbers for one project from its tasks. `clocked` gives each task's clocked minutes and the
 * last date it was clocked.
 */
export function rollupTasks(
	tasks: readonly Task[],
	clocked: (task: Task) => { minutes: Minutes; lastDate: IsoDate | null },
): Rollup {
	let done = 0;
	let clockedMinutes = 0;
	let lastActivity: IsoDate | null = null;
	for (const task of tasks) {
		if (isClosed(task.state)) {
			done++;
		}
		lastActivity = later(lastActivity, task.fields.done);
		const clock = clocked(task);
		clockedMinutes += clock.minutes;
		lastActivity = later(lastActivity, clock.lastDate);
	}
	return {
		done,
		total: tasks.length,
		percent: percent(done, tasks.length),
		clockedMinutes,
		lastActivity,
	};
}

/** Sums rollups, for goals and pillars. */
export function combine(rollups: Iterable<Rollup>): Rollup {
	let done = 0;
	let total = 0;
	let clockedMinutes = 0;
	let lastActivity: IsoDate | null = null;
	for (const rollup of rollups) {
		done += rollup.done;
		total += rollup.total;
		clockedMinutes += rollup.clockedMinutes;
		lastActivity = later(lastActivity, rollup.lastActivity);
	}
	return { done, total, percent: percent(done, total), clockedMinutes, lastActivity };
}

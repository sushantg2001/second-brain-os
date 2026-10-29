import type {
	DateFormatter,
	IsoDate,
	Minutes,
	NowSnapshot,
	ReadableStore,
} from "../../../shared/kernel";
import { createServiceContext } from "../../../shared/react";
import type { Planner } from "../application/planner";
import type { PlannedTask } from "../domain/day-plan";

/** Time tracking shown on the timeline. Provided by the clocks feature when it is loaded. */
export interface PlannerClockControls {
	readonly isRunning: (task: PlannedTask) => boolean;
	readonly toggle: (task: PlannedTask) => void;
	readonly rangesOn: (date: IsoDate) => readonly {
		readonly taskId: string;
		readonly title: string;
		readonly start: Minutes;
		readonly end: Minutes;
		readonly running: boolean;
	}[];
	readonly minutesOn: (date: IsoDate) => Minutes;
}

export interface PlannerServices {
	readonly planner: Planner;
	readonly dates: DateFormatter;
	/** Ticks every half minute, so the now line and "today" stay current. */
	readonly now: ReadableStore<NowSnapshot>;
	/** Changes whenever plans may have changed. */
	readonly version: ReadableStore<unknown>;
	readonly openTask: (task: PlannedTask) => void;
	readonly newBlock: (date: IsoDate, start: Minutes, end: Minutes) => void;
	readonly report: (error: Error) => void;
	readonly clocks?: PlannerClockControls;
}

export const PlannerContext = createServiceContext<PlannerServices>("PlannerServices");

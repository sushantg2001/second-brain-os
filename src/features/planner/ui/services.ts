import type { DateFormatter, IsoDate, Minutes, ReadableStore } from "../../../shared/kernel";
import { createServiceContext } from "../../../shared/react";
import type { Planner } from "../application/planner";
import type { PlannedTask } from "../domain/day-plan";

export interface NowSnapshot {
	readonly date: IsoDate;
	readonly minutes: Minutes;
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
}

export const PlannerContext = createServiceContext<PlannerServices>("PlannerServices");

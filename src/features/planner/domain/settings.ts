export interface PlannerSettings {
	/** First hour shown on the timeline, 0 to 23. */
	readonly startHour: number;
	/** Last hour shown, 1 to 24. */
	readonly endHour: number;
	/** Drag and keyboard step in minutes. */
	readonly snapMinutes: number;
	/** Length of a block that only has a start time. */
	readonly defaultDuration: number;
	/** Heading in the daily note that new blocks go under. */
	readonly heading: string;
	/** Height of one hour on the timeline, in pixels. */
	readonly hourHeight: number;
	readonly notifyOnStart: boolean;
	readonly showStatusBar: boolean;
	/** Days in the multi-day view. */
	readonly multiDayCount: number;
}

export const DEFAULT_PLANNER_SETTINGS: PlannerSettings = {
	startHour: 6,
	endHour: 22,
	snapMinutes: 15,
	defaultDuration: 30,
	heading: "Day planner",
	hourHeight: 60,
	notifyOnStart: false,
	showStatusBar: true,
	multiDayCount: 3,
};

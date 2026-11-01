export type Granularity = "day" | "week" | "month" | "quarter" | "year";

export const GRANULARITIES: readonly Granularity[] = ["day", "week", "month", "quarter", "year"];

export interface GranularityLabels {
	/** "daily", used in command ids and messages. */
	readonly periodicity: string;
	readonly noun: string;
	readonly openCurrent: string;
	readonly createCurrent: string;
}

export const LABELS: Readonly<Record<Granularity, GranularityLabels>> = {
	day: {
		periodicity: "daily",
		noun: "day",
		openCurrent: "Open today's daily note",
		createCurrent: "Create today's daily note",
	},
	week: {
		periodicity: "weekly",
		noun: "week",
		openCurrent: "Open this week's note",
		createCurrent: "Create this week's note",
	},
	month: {
		periodicity: "monthly",
		noun: "month",
		openCurrent: "Open this month's note",
		createCurrent: "Create this month's note",
	},
	quarter: {
		periodicity: "quarterly",
		noun: "quarter",
		openCurrent: "Open this quarter's note",
		createCurrent: "Create this quarter's note",
	},
	year: {
		periodicity: "yearly",
		noun: "year",
		openCurrent: "Open this year's note",
		createCurrent: "Create this year's note",
	},
};

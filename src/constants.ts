import type { Granularity } from "./types";

export const VIEW_TYPE_CALENDAR = "calendar-periodic-notes";

export const GRANULARITIES: Granularity[] = [
	"day",
	"week",
	"month",
	"quarter",
	"year",
];

export const DEFAULT_FORMATS: Record<Granularity, string> = {
	day: "YYYY-MM-DD",
	week: "gggg-[W]ww",
	month: "YYYY-MM",
	quarter: "YYYY-[Q]Q",
	year: "YYYY",
};

interface DisplayConfig {
	periodicity: string;
	relativeUnit: string;
	labelOpenPresent: string;
	labelCreatePresent: string;
}

export const DISPLAY_CONFIGS: Record<Granularity, DisplayConfig> = {
	day: {
		periodicity: "daily",
		relativeUnit: "today",
		labelOpenPresent: "Open today's daily note",
		labelCreatePresent: "Create today's daily note",
	},
	week: {
		periodicity: "weekly",
		relativeUnit: "this week",
		labelOpenPresent: "Open this week's note",
		labelCreatePresent: "Create this week's note",
	},
	month: {
		periodicity: "monthly",
		relativeUnit: "this month",
		labelOpenPresent: "Open this month's note",
		labelCreatePresent: "Create this month's note",
	},
	quarter: {
		periodicity: "quarterly",
		relativeUnit: "this quarter",
		labelOpenPresent: "Open this quarter's note",
		labelCreatePresent: "Create this quarter's note",
	},
	year: {
		periodicity: "yearly",
		relativeUnit: "this year",
		labelOpenPresent: "Open this year's note",
		labelCreatePresent: "Create this year's note",
	},
};

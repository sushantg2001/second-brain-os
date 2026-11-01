import type { Granularity } from "./granularity";

export interface PeriodicConfig {
	readonly enabled: boolean;
	/** moment.js format for the file name. */
	readonly format: string;
	/** Vault folder, "" for the root. */
	readonly folder: string;
	/** Path of a template note, "" for none. */
	readonly template: string;
}

export const WEEK_STARTS = [
	"locale",
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
] as const;

export type WeekStart = (typeof WEEK_STARTS)[number];

export interface PeriodicSettings {
	readonly notes: Readonly<Record<Granularity, PeriodicConfig>>;
	readonly weekStart: WeekStart;
	readonly confirmBeforeCreate: boolean;
	readonly showWeekNumbers: boolean;
}

export const DEFAULT_FORMATS: Readonly<Record<Granularity, string>> = {
	day: "YYYY-MM-DD",
	week: "gggg-[W]ww",
	month: "YYYY-MM",
	quarter: "YYYY-[Q]Q",
	year: "YYYY",
};

const config = (granularity: Granularity, enabled: boolean): PeriodicConfig => ({
	enabled,
	format: DEFAULT_FORMATS[granularity],
	folder: "",
	template: "",
});

export const DEFAULT_PERIODIC_SETTINGS: PeriodicSettings = {
	notes: {
		day: config("day", true),
		week: config("week", true),
		month: config("month", false),
		quarter: config("quarter", false),
		year: config("year", false),
	},
	weekStart: "locale",
	confirmBeforeCreate: false,
	showWeekNumbers: false,
};

/** 0 (Sunday) to 6. `localeStart` is used for "locale". */
export function resolveWeekStart(weekStart: WeekStart, localeStart: number): number {
	return weekStart === "locale" ? localeStart : WEEK_STARTS.indexOf(weekStart) - 1;
}

/** The format in effect: an empty format falls back to the default. */
export function formatOf(settings: PeriodicSettings, granularity: Granularity): string {
	return settings.notes[granularity].format.trim() || DEFAULT_FORMATS[granularity];
}

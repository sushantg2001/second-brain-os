export type Granularity = "day" | "week" | "month" | "quarter" | "year";

export interface PeriodicConfig {
	enabled: boolean;
	format: string;
	folder: string;
	template: string;
}

export type WeekStart =
	| "locale"
	| "sunday"
	| "monday"
	| "tuesday"
	| "wednesday"
	| "thursday"
	| "friday"
	| "saturday";

export interface PluginSettings {
	notes: Record<Granularity, PeriodicConfig>;
	weekStart: WeekStart;
	confirmBeforeCreate: boolean;
	showWeekNumbers: boolean;
}

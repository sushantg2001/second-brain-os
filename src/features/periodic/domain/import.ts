import { GRANULARITIES, type Granularity } from "./granularity";
import {
	WEEK_STARTS,
	type PeriodicConfig,
	type PeriodicSettings,
	type WeekStart,
} from "./settings";

/** Settings read from other plugins, as stored in their data.json. */
export interface ForeignSettings {
	/** Liam Cain's Periodic Notes, or this plugin's 1.x release. */
	readonly periodicNotes?: unknown;
	/** Liam Cain's Calendar. */
	readonly calendar?: unknown;
}

/** Periodic Notes keys by granularity. */
const PERIODIC_NOTES_KEYS: Readonly<Record<Granularity, string>> = {
	day: "daily",
	week: "weekly",
	month: "monthly",
	quarter: "quarterly",
	year: "yearly",
};

function record(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function readConfig(value: unknown, current: PeriodicConfig): PeriodicConfig | null {
	const source = record(value);
	if (!source) {
		return null;
	}
	const text = (key: string, fallback: string): string =>
		typeof source[key] === "string" ? source[key] : fallback;
	return {
		enabled: typeof source.enabled === "boolean" ? source.enabled : current.enabled,
		format: text("format", current.format),
		folder: text("folder", current.folder),
		template: text("template", current.template),
	};
}

/**
 * Merges settings from Periodic Notes (its `daily`/`weekly`... sections, or 1.x's `notes`) and
 * Calendar (`weekStart`, `shouldConfirmBeforeCreate`, `showWeekNumbers`). Unknown values are
 * ignored. Returns the merged settings and which granularities changed.
 */
export function importForeignSettings(
	current: PeriodicSettings,
	foreign: ForeignSettings,
): { settings: PeriodicSettings; imported: string[] } {
	const notes = { ...current.notes };
	const imported: string[] = [];
	const periodic = record(foreign.periodicNotes);
	const ownNotes = record(periodic?.notes);
	for (const granularity of GRANULARITIES) {
		const source = ownNotes?.[granularity] ?? periodic?.[PERIODIC_NOTES_KEYS[granularity]];
		const config = readConfig(source, notes[granularity]);
		if (config) {
			notes[granularity] = config;
			imported.push(`${PERIODIC_NOTES_KEYS[granularity]} notes`);
		}
	}
	let { weekStart, confirmBeforeCreate, showWeekNumbers } = current;
	const calendar = record(foreign.calendar);
	const weekSource = calendar?.weekStart ?? periodic?.weekStart;
	if (typeof weekSource === "string" && (WEEK_STARTS as readonly string[]).includes(weekSource)) {
		weekStart = weekSource as WeekStart;
		imported.push("week start");
	}
	const confirm = calendar?.shouldConfirmBeforeCreate ?? periodic?.confirmBeforeCreate;
	if (typeof confirm === "boolean") {
		confirmBeforeCreate = confirm;
		imported.push("confirm before create");
	}
	const weekNumbers =
		calendar?.showWeeklyNote ?? calendar?.showWeekNumbers ?? periodic?.showWeekNumbers;
	if (typeof weekNumbers === "boolean") {
		showWeekNumbers = weekNumbers;
		imported.push("week numbers");
	}
	return {
		settings: { ...current, notes, weekStart, confirmBeforeCreate, showWeekNumbers },
		imported,
	};
}

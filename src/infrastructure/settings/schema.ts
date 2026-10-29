// Namespace import on purpose: `import { z }` defeats tree-shaking and adds ~350 KB.
import * as z from "zod/mini";

import {
	DEFAULT_PERIODIC_SETTINGS,
	WEEK_STARTS,
	type PeriodicSettings,
} from "../../features/periodic";

export const SETTINGS_VERSION = 2;

const periodicConfig = z.object({
	enabled: z.boolean(),
	format: z.string(),
	folder: z.string(),
	template: z.string(),
});

const periodic = z.object({
	notes: z.object({
		day: periodicConfig,
		week: periodicConfig,
		month: periodicConfig,
		quarter: periodicConfig,
		year: periodicConfig,
	}),
	weekStart: z.enum(WEEK_STARTS),
	confirmBeforeCreate: z.boolean(),
	showWeekNumbers: z.boolean(),
});

/** Each feature owns a section. A new section or field needs a migration in migrations.ts. */
export const settingsSchema = z.object({
	version: z.literal(SETTINGS_VERSION),
	periodic,
});

export type Settings = z.infer<typeof settingsSchema>;

/** Compile-time check that every section matches the type its feature declares. */
export type SectionTypes = {
	periodic: PeriodicSettings;
};
const _sectionsMatch: {
	[K in keyof SectionTypes]: Settings[K] extends SectionTypes[K] ? true : never;
} = {
	periodic: true,
};
void _sectionsMatch;

export const DEFAULT_SETTINGS: Settings = {
	version: SETTINGS_VERSION,
	periodic: DEFAULT_PERIODIC_SETTINGS,
};

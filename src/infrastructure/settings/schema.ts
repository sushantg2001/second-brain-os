// Namespace import on purpose: `import { z }` defeats tree-shaking and adds ~350 KB.
import * as z from "zod/mini";

import {
	DEFAULT_PERIODIC_SETTINGS,
	WEEK_STARTS,
	type PeriodicSettings,
} from "../../features/periodic";
import { DEFAULT_PLANNER_SETTINGS, type PlannerSettings } from "../../features/planner";
import { CAPTURE_TARGETS, DEFAULT_PPV_SETTINGS, type PpvSettings } from "../../features/ppv";

export const SETTINGS_VERSION = 4;

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

const planner = z.object({
	startHour: z.number(),
	endHour: z.number(),
	snapMinutes: z.number(),
	defaultDuration: z.number(),
	heading: z.string(),
	hourHeight: z.number(),
	notifyOnStart: z.boolean(),
	showStatusBar: z.boolean(),
	multiDayCount: z.number(),
});

const byPpvType = z.object({
	pillar: z.string(),
	goal: z.string(),
	project: z.string(),
	resource: z.string(),
});

const ppv = z.object({
	folders: byPpvType,
	templates: byPpvType,
	archiveFolder: z.string(),
	archiveClosedProjects: z.boolean(),
	captureTarget: z.enum(CAPTURE_TARGETS),
	inboxPath: z.string(),
	captureHeading: z.string(),
});

/** Each feature owns a section. A new section or field needs a migration in migrations.ts. */
export const settingsSchema = z.object({
	version: z.literal(SETTINGS_VERSION),
	periodic,
	planner,
	ppv,
});

export type Settings = z.infer<typeof settingsSchema>;

/** Compile-time check that every section matches the type its feature declares. */
export type SectionTypes = {
	periodic: PeriodicSettings;
	planner: PlannerSettings;
	ppv: PpvSettings;
};
const _sectionsMatch: {
	[K in keyof SectionTypes]: Settings[K] extends SectionTypes[K] ? true : never;
} = {
	periodic: true,
	planner: true,
	ppv: true,
};
void _sectionsMatch;

export const DEFAULT_SETTINGS: Settings = {
	version: SETTINGS_VERSION,
	periodic: DEFAULT_PERIODIC_SETTINGS,
	planner: DEFAULT_PLANNER_SETTINGS,
	ppv: DEFAULT_PPV_SETTINGS,
};

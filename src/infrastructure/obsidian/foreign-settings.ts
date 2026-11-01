import type { App } from "obsidian";

import type { ForeignSettings } from "../../features/periodic";

/** Plugin ids whose settings can be imported, in order of preference. */
const PERIODIC_IDS = ["periodic-notes", "calendar-periodic-notes"];
const CALENDAR_ID = "calendar";

interface LoadedPlugin {
	readonly settings?: unknown;
	readonly options?: unknown;
}

/** Reads the in-memory settings of Periodic Notes, Calendar or this plugin's 1.x release. */
export function readForeignSettings(app: App): ForeignSettings {
	const plugins =
		(app as App & { plugins?: { plugins?: Record<string, LoadedPlugin | undefined> } }).plugins
			?.plugins ?? {};
	const periodic = PERIODIC_IDS.map((id) => plugins[id]?.settings).find(
		(settings) => settings !== undefined,
	);
	const calendarPlugin = plugins[CALENDAR_ID];
	const calendar = calendarPlugin?.options ?? calendarPlugin?.settings;
	return {
		...(periodic === undefined ? {} : { periodicNotes: periodic }),
		...(calendar === undefined ? {} : { calendar }),
	};
}

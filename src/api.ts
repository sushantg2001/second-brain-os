import { moment, TFile } from "obsidian";
import type { Moment } from "moment";

import { GRANULARITIES } from "./constants";
import type { Granularity } from "./types";
import type CalendarPeriodicNotesPlugin from "./main";

export interface PublicApi {
	getGranularities(): Granularity[];
	createPeriodicNote(
		granularity: Granularity,
		openNote?: boolean,
		date?: Moment,
	): Promise<TFile>;
	getPeriodicNote(granularity: Granularity, date?: Moment): TFile | null;
}

export function createApi(plugin: CalendarPeriodicNotesPlugin): PublicApi {
	return {
		getGranularities(): Granularity[] {
			return GRANULARITIES.filter(
				(granularity) => plugin.settings.notes[granularity].enabled,
			);
		},
		async createPeriodicNote(
			granularity: Granularity,
			openNote = false,
			date: Moment = moment(),
		): Promise<TFile> {
			const file = await plugin.notesManager.createOrReturnNote(
				granularity,
				date,
			);
			if (openNote) {
				await plugin.notesManager.openNote(granularity, date);
			}
			return file;
		},
		getPeriodicNote(
			granularity: Granularity,
			date: Moment = moment(),
		): TFile | null {
			return plugin.notesManager.getNote(granularity, date);
		},
	};
}

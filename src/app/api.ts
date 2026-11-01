import { moment, TFile } from "obsidian";

import type { Granularity } from "../features/periodic";
import type { Container } from "./container";

type Moment = ReturnType<typeof moment>;

/**
 * The public API on `app.plugins.getPlugin("second-brain-os").api`. It keeps the shape of the
 * Periodic Notes API so existing scripts keep working. Changes follow semver.
 */
export interface PublicApi {
	getGranularities(): Granularity[];
	getPeriodicNote(granularity: Granularity, date?: Moment): TFile | null;
	createPeriodicNote(granularity: Granularity, openNote?: boolean, date?: Moment): Promise<TFile>;
}

function iso(date: Moment | undefined): string {
	return (date ?? moment()).format("YYYY-MM-DD");
}

export function createApi(container: Container): PublicApi {
	const { app, periodic } = container;
	const fileAt = (path: string | null): TFile | null => {
		const file = path ? app.vault.getAbstractFileByPath(path) : null;
		return file instanceof TFile ? file : null;
	};
	return {
		getGranularities: () => periodic.enabledGranularities(),
		getPeriodicNote: (granularity, date) => fileAt(periodic.find(granularity, iso(date))),
		async createPeriodicNote(granularity, openNote = false, date) {
			const result = openNote
				? await periodic.open(granularity, iso(date))
				: await periodic.ensure(granularity, iso(date));
			if (!result.ok) {
				throw result.error;
			}
			const file = fileAt(
				typeof result.value === "string" ? result.value : result.value.path,
			);
			if (!file) {
				throw new Error("The note was created but could not be found.");
			}
			return file;
		},
	};
}

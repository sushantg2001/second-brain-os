import { beforeEach, describe, expect, it } from "vitest";
import { moment, type App } from "obsidian";

import { App as MockApp } from "../mocks/obsidian";
import { createApi, type PublicApi } from "../../src/api";
import { PeriodicNotesManager } from "../../src/notes";
import { mergeSettings } from "../../src/settings";
import type CalendarPeriodicNotesPlugin from "../../src/main";

describe("public api", () => {
	let app: MockApp;
	let api: PublicApi;

	beforeEach(() => {
		app = new MockApp();
		const settings = mergeSettings({
			notes: {
				day: { enabled: true },
				week: { enabled: true },
			},
		});
		const notesManager = new PeriodicNotesManager(
			app as unknown as App,
			() => settings,
		);
		api = createApi({
			settings,
			notesManager,
		} as unknown as CalendarPeriodicNotesPlugin);
	});

	it("lists only enabled granularities", () => {
		expect(api.getGranularities()).toEqual(["day", "week"]);
	});

	it("creates a periodic note without opening it", async () => {
		const file = await api.createPeriodicNote("day", false, moment("2024-01-05"));
		expect(file.path).toBe("2024-01-05.md");
		expect(app.workspace.lastLeaf.openedFiles).toHaveLength(0);
	});

	it("opens the note when requested", async () => {
		await api.createPeriodicNote("day", true, moment("2024-01-05"));
		expect(app.workspace.lastLeaf.openedFiles).toHaveLength(1);
	});

	it("returns the existing note on repeat creation", async () => {
		const first = await api.createPeriodicNote("day", false, moment("2024-01-05"));
		const second = await api.createPeriodicNote("day", false, moment("2024-01-05"));
		expect(second).toBe(first);
	});

	it("looks up periodic notes by date", async () => {
		expect(api.getPeriodicNote("day", moment("2024-01-05"))).toBeNull();
		const file = await api.createPeriodicNote("day", false, moment("2024-01-05"));
		expect(api.getPeriodicNote("day", moment("2024-01-05"))).toBe(file);
	});
});

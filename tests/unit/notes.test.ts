import { beforeEach, describe, expect, it } from "vitest";
import { moment, type App, type TFile } from "obsidian";

import { App as MockApp } from "../mocks/obsidian";
import { PeriodicNotesManager, renderTemplate } from "../../src/notes";
import { mergeSettings } from "../../src/settings";
import type { PluginSettings } from "../../src/types";

describe("renderTemplate", () => {
	const date = moment("2024-05-04");

	it("replaces title, date, and time placeholders", () => {
		const result = renderTemplate(
			"# {{title}}\n{{date}} {{date:MMMM}}",
			date,
			"2024-05-04",
		);
		expect(result).toBe("# 2024-05-04\n2024-05-04 May");
	});

	it("supports custom time formats", () => {
		const result = renderTemplate("{{time:HH}}", date, "x");
		expect(result).toBe(moment().format("HH"));
	});

	it("is case insensitive", () => {
		expect(renderTemplate("{{TITLE}}", date, "note")).toBe("note");
	});

	it("leaves unknown placeholders untouched", () => {
		expect(renderTemplate("{{tags}}", date, "x")).toBe("{{tags}}");
	});
});

describe("PeriodicNotesManager", () => {
	let app: MockApp;
	let settings: PluginSettings;
	let manager: PeriodicNotesManager;

	beforeEach(() => {
		app = new MockApp();
		settings = mergeSettings({
			notes: {
				day: { enabled: true, folder: "journal/daily" },
				week: { enabled: true },
			},
		});
		manager = new PeriodicNotesManager(
			app as unknown as App,
			() => settings,
		);
	});

	it("builds note paths from folder and format", () => {
		expect(manager.getNotePath("day", moment("2024-01-05"))).toBe(
			"journal/daily/2024-01-05.md",
		);
		expect(manager.getNotePath("week", moment("2024-01-05"))).toBe(
			"2024-W01.md",
		);
	});

	it("creates a note and its folder", async () => {
		const file = await manager.createNote("day", moment("2024-01-05"));
		expect(file.path).toBe("journal/daily/2024-01-05.md");
		expect(manager.getNote("day", moment("2024-01-05"))).toBe(file);
	});

	it("applies the template when creating a note", async () => {
		settings.notes.day.template = "templates/daily.md";
		await app.vault.createFolder("templates");
		await app.vault.create("templates/daily.md", "# {{title}}");

		const file = await manager.createNote("day", moment("2024-01-05"));
		expect(await app.vault.read(file)).toBe("# 2024-01-05");
	});

	it("returns the existing note instead of recreating it", async () => {
		const first = await manager.createOrReturnNote("day", moment("2024-01-05"));
		const second = await manager.createOrReturnNote(
			"day",
			moment("2024-01-05"),
		);
		expect(second).toBe(first);
	});

	it("parses dates from periodic note files", async () => {
		const file = await manager.createNote("day", moment("2024-01-05"));
		const date = manager.getNoteDate("day", file);
		expect(date?.format("YYYY-MM-DD")).toBe("2024-01-05");
	});

	it("ignores files outside the configured folder", async () => {
		await app.vault.create("2024-01-05.md", "");
		const file = app.vault.getMarkdownFiles()[0];
		expect(file).toBeDefined();
		expect(
			manager.getNoteDate("day", file as unknown as TFile),
		).toBeNull();
	});

	it("ignores files that do not match the format", async () => {
		await app.vault.createFolder("journal/daily");
		await manager.createNote("day", moment("2024-01-05"));
		await app.vault.create("journal/daily/scratch.md", "");

		const notes = manager.getAllNotes("day");
		expect(notes).toHaveLength(1);
		expect(notes[0]?.date.format("YYYY-MM-DD")).toBe("2024-01-05");
	});

	it("opens notes through a workspace leaf", async () => {
		await manager.openNote("day", moment("2024-01-05"));
		const leaf = app.workspace.lastLeaf;
		expect(leaf.openedFiles).toHaveLength(1);
		expect(leaf.openedFiles[0]?.path).toBe("journal/daily/2024-01-05.md");
	});
});

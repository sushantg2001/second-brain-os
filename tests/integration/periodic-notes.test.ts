import { describe, expect, it } from "bun:test";

import { createPeriodicHarness } from "../fakes/periodic-harness";

describe("PeriodicNotes", () => {
	it("builds paths from format and folder", async () => {
		const { periodic } = await createPeriodicHarness({
			settings: {
				weekStart: "monday",
				notes: { day: { folder: "Journal/Daily" }, week: { format: "GGGG-[W]WW" } },
			},
		});
		expect(periodic.pathFor("day", "2026-10-29")).toBe("Journal/Daily/2026-10-29.md");
		expect(periodic.pathFor("week", "2026-10-29")).toBe("2026-W44.md");
		expect(periodic.title("week", "2026-11-01")).toBe("2026-W44");
	});

	it("handles ISO week 53 and the year boundary", async () => {
		const { periodic } = await createPeriodicHarness({
			settings: { weekStart: "monday", notes: { week: { format: "GGGG-[W]WW" } } },
		});
		expect(periodic.title("week", "2027-01-01")).toBe("2026-W53");
		expect(periodic.dateOf("week", "2026-W53.md")).toBe("2026-12-28");
	});

	it("identifies notes, including nested formats", async () => {
		const { periodic } = await createPeriodicHarness({
			settings: {
				notes: {
					day: { folder: "Daily", format: "YYYY/MM/YYYY-MM-DD" },
					month: { enabled: true },
				},
			},
		});
		expect(periodic.dateOf("day", "Daily/2026/10/2026-10-29.md")).toBe("2026-10-29");
		expect(periodic.dateOf("day", "Daily/2026-10-29.md")).toBeNull();
		expect(periodic.dateOf("day", "Other/2026/10/2026-10-29.md")).toBeNull();
		expect(periodic.dateOf("day", "Daily/2026/10/2026-10-29.canvas")).toBeNull();
		expect(periodic.identify("2026-10.md")).toEqual({
			granularity: "month",
			date: "2026-10-01",
		});
		expect(periodic.identify("notes.md")).toBeNull();
	});

	it("requires flat notes to sit directly in the folder", async () => {
		const { periodic } = await createPeriodicHarness();
		expect(periodic.dateOf("day", "2026-10-29.md")).toBe("2026-10-29");
		expect(periodic.dateOf("day", "sub/2026-10-29.md")).toBeNull();
	});

	it("indexes existing notes and refreshes after creating one", async () => {
		const { periodic } = await createPeriodicHarness({
			files: { "2026-10-28.md": "", "2026-10-30.md": "", "random.md": "" },
		});
		expect([...periodic.index.get().day.keys()].sort()).toEqual(["2026-10-28", "2026-10-30"]);
		const created = await periodic.ensure("day", "2026-10-29");
		expect(created.ok && created.value).toEqual({ path: "2026-10-29.md", created: true });
		expect(periodic.index.get().day.has("2026-10-29")).toBe(true);
	});

	it("creates folders and fills the template", async () => {
		const { periodic, app } = await createPeriodicHarness({
			files: { "Templates/Daily.md": "# {{title}}\n{{date:dddd}}, {{date:MMMM D}}" },
			settings: { notes: { day: { folder: "Journal/Daily", template: "Templates/Daily" } } },
		});
		const created = await periodic.ensure("day", "2026-10-29");
		expect(created.ok).toBe(true);
		expect(app.vault.contentOf("Journal/Daily/2026-10-29.md")).toBe(
			"# 2026-10-29\nThursday, October 29",
		);
	});

	it("returns an existing note without touching it", async () => {
		const { periodic, app } = await createPeriodicHarness({
			files: { "2026-10-29.md": "keep me" },
		});
		const result = await periodic.ensure("day", "2026-10-29");
		expect(result.ok && result.value.created).toBe(false);
		expect(app.vault.contentOf("2026-10-29.md")).toBe("keep me");
	});

	it("reports a missing template and creates nothing", async () => {
		const { periodic, app } = await createPeriodicHarness({
			settings: { notes: { day: { template: "Templates/Missing" } } },
		});
		const result = await periodic.ensure("day", "2026-10-29");
		expect(result.ok).toBe(false);
		expect(!result.ok && result.error.message).toBe("Template not found: Templates/Missing");
		expect(app.vault.getAbstractFileByPath("2026-10-29.md")).toBeNull();
	});

	it("runs Templater when the template uses its syntax", async () => {
		const processed: string[] = [];
		const { periodic, app } = await createPeriodicHarness({
			files: { "T.md": "<% tp.file.title %>" },
			settings: { notes: { day: { template: "T.md" } } },
		});
		app.plugins.plugins["templater-obsidian"] = {
			templater: {
				overwrite_file_commands: (file: { path: string }) => {
					processed.push(file.path);
					return Promise.resolve();
				},
			},
		};
		await periodic.ensure("day", "2026-10-29");
		expect(processed).toEqual(["2026-10-29.md"]);
	});

	it("opens notes in the requested pane", async () => {
		const { periodic, app } = await createPeriodicHarness();
		const result = await periodic.open("day", "2026-10-29", "split");
		expect(result.ok).toBe(true);
		const leaf = app.workspace.leaves.at(-1);
		expect(leaf?.kind).toBe("split");
		expect(leaf?.file?.path).toBe("2026-10-29.md");
		expect(app.workspace.getActiveFile()?.path).toBe("2026-10-29.md");
	});

	it("finds adjacent notes from the active note or from today", async () => {
		const { periodic, workspace } = await createPeriodicHarness({
			files: { "2026-10-20.md": "", "2026-10-25.md": "", "2026-11-03.md": "" },
			today: "2026-10-29",
		});
		expect(periodic.adjacent("day", "prev")).toBe("2026-10-25");
		expect(periodic.adjacent("day", "next")).toBe("2026-11-03");
		await workspace.open("2026-10-25.md");
		expect(periodic.adjacent("day", "prev")).toBe("2026-10-20");
	});

	it("only indexes enabled granularities", async () => {
		const { periodic } = await createPeriodicHarness({ files: { "2026-10.md": "" } });
		expect(periodic.enabledGranularities()).toEqual(["day", "week"]);
		expect(periodic.index.get().month.size).toBe(0);
	});
});

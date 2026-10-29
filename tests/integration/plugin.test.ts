import { describe, expect, it } from "bun:test";
import type { Plugin as ObsidianPlugin } from "obsidian";

import { createApi } from "../../src/app/api";
import { createContainer } from "../../src/app/container";
import { startPlugin } from "../../src/app/lifecycle";
import SecondBrainOsPlugin from "../../src/main";
import { moment, Notice, Plugin } from "../mocks/obsidian";
import { createTestApp } from "../fakes/fake-obsidian-app";
import { READY_PLUGINS } from "../fakes/fake-plugin-registry";
import { loadPlugin, sleep } from "../fakes/plugin-harness";

describe("plugin lifecycle", () => {
	it("waits for required plugins before registering features", async () => {
		const app = await createTestApp({ plugins: READY_PLUGINS.slice(0, 2) });
		const plugin = new Plugin(app);
		const obsidianPlugin = plugin as unknown as ObsidianPlugin;
		const container = createContainer(obsidianPlugin);
		await startPlugin(obsidianPlugin, container);
		app.workspace.finishLayout();
		await sleep(0);

		expect(plugin.commands.map((command) => command.id)).toEqual([
			"second-brain-os:show-required-plugins",
		]);
		expect(app.workspace.getLeavesOfType("sbos-setup")).toHaveLength(1);

		app.plugins.manifests["templater-obsidian"] = { version: "2.1.0" };
		app.plugins.enabledPlugins.add("templater-obsidian");
		app.plugins.plugins["templater-obsidian"] = {};
		container.dependencyGate.recheck();
		expect(plugin.commands.some((command) => command.id.endsWith("open-daily-note"))).toBe(
			true,
		);
	});

	it("registers features, the settings tab and the calendar once ready", async () => {
		const { app, plugin } = await loadPlugin();
		const ids = plugin.commands.map((command) => command.id.replace("second-brain-os:", ""));
		expect(ids).toContain("open-daily-note");
		expect(ids).toContain("prev-yearly-note");
		expect(ids).toContain("open-calendar");
		expect(ids).toContain("jump-to-date");
		expect(plugin.settingTabs).toHaveLength(1);
		expect(app.workspace.getLeavesOfType("sbos-calendar")).toHaveLength(1);
		expect(app.workspace.getLeavesOfType("sbos-setup")).toHaveLength(0);
	});

	it("reports unreadable settings and keeps defaults", async () => {
		Notice.messages.length = 0;
		await loadPlugin({ data: { version: 99 } });
		expect(Notice.messages[0]).toContain("could not read its settings");
	});

	it("exposes the public API from the plugin class", async () => {
		const app = await createTestApp({ plugins: READY_PLUGINS });
		const plugin = new SecondBrainOsPlugin(app as never, { id: "second-brain-os" } as never);
		await plugin.onload();
		expect(plugin.api.getGranularities()).toEqual(["day", "week"]);
	});
});

describe("periodic commands", () => {
	it("opens and creates today's notes", async () => {
		const { app, plugin } = await loadPlugin({ today: "2026-10-29" });
		expect(plugin.runCommand("open-daily-note")).toBe(true);
		await sleep(0);
		expect(app.workspace.getActiveFile()?.path).toBe("2026-10-29.md");
		plugin.runCommand("create-weekly-note");
		await sleep(0);
		expect(app.vault.getAbstractFileByPath("2026-W44.md")).not.toBeNull();
	});

	it("hides commands for disabled granularities", async () => {
		const { plugin } = await loadPlugin();
		expect(plugin.runCommand("open-monthly-note")).toBe(false);
	});

	it("jumps between existing notes and explains when there are none", async () => {
		Notice.messages.length = 0;
		const { app, plugin } = await loadPlugin({
			files: { "2026-10-01.md": "" },
			today: "2026-10-29",
		});
		plugin.runCommand("prev-daily-note");
		await sleep(0);
		expect(app.workspace.getActiveFile()?.path).toBe("2026-10-01.md");
		plugin.runCommand("prev-daily-note");
		expect(Notice.messages).toContain("No earlier daily note exists.");
	});

	it("re-indexes when notes are added outside the plugin", async () => {
		const { app, container } = await loadPlugin();
		await app.vault.create("2026-10-02.md", "");
		await sleep(200);
		expect(container.periodic.index.get().day.has("2026-10-02")).toBe(true);
	});

	it("shows template errors as a notice", async () => {
		Notice.messages.length = 0;
		const { plugin, container } = await loadPlugin();
		await container.settings.section("periodic").update((settings) => ({
			...settings,
			notes: { ...settings.notes, day: { ...settings.notes.day, template: "Nope" } },
		}));
		plugin.runCommand("open-daily-note");
		await sleep(0);
		expect(Notice.messages).toContain("Template not found: Nope");
	});
});

describe("public API", () => {
	it("keeps the Periodic Notes API shape", async () => {
		const { container, app } = await loadPlugin({ files: { "2026-10-29.md": "" } });
		const api = createApi(container);
		expect(api.getPeriodicNote("day", moment("2026-10-29"))?.path).toBe("2026-10-29.md");
		expect(api.getPeriodicNote("day", moment("2026-10-30"))).toBeNull();
		const created = await api.createPeriodicNote("week", false, moment("2026-10-29"));
		expect(created.path).toBe("2026-W44.md");
		const opened = await api.createPeriodicNote("day", true, moment("2026-11-01"));
		expect(app.workspace.getActiveFile()).toBe(opened);
	});

	it("throws when a note cannot be created", async () => {
		const { container } = await loadPlugin();
		await container.settings.section("periodic").update((settings) => ({
			...settings,
			notes: { ...settings.notes, day: { ...settings.notes.day, template: "Missing" } },
		}));
		const error = await createApi(container)
			.createPeriodicNote("day")
			.then(
				() => null,
				(reason: unknown) => reason,
			);
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain("Template not found");
	});
});

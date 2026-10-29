import { PluginSettingTab, type Plugin } from "obsidian";

import { renderLintSettings } from "../features/lint";
import { importForeignSettings, renderPeriodicSettings } from "../features/periodic";
import { renderPlannerSettings } from "../features/planner";
import { renderPpvSettings } from "../features/ppv";
import { readForeignSettings } from "../infrastructure/obsidian";
import type { Container } from "./container";

/**
 * One settings tab, with a section per feature. It uses `display()` because the declarative
 * settings API needs Obsidian 1.13 and minAppVersion is lower.
 */
export class SecondBrainSettingTab extends PluginSettingTab {
	constructor(
		plugin: Plugin,
		private readonly container: Container,
	) {
		super(plugin.app, plugin);
	}

	override display(): void {
		const { containerEl, container } = this;
		containerEl.replaceChildren();
		const redraw = (): void => this.display();
		renderPeriodicSettings(
			containerEl,
			container.settings.section("periodic"),
			container.periodic,
			redraw,
			() => importPeriodicSettings(container),
		);
		renderPlannerSettings(containerEl, container.settings.section("planner"));
		renderPpvSettings(containerEl, container.settings.section("ppv"));
		renderLintSettings(containerEl, container.settings.section("lint"));
	}
}

/** Imports from Periodic Notes and Calendar, and describes the result for the user. */
export async function importPeriodicSettings(container: Container): Promise<string> {
	const section = container.settings.section("periodic");
	const { settings, imported } = importForeignSettings(
		section.store.get(),
		readForeignSettings(container.app),
	);
	if (imported.length === 0) {
		const message = "Nothing to import. Enable the periodic notes or calendar plugin first.";
		container.notifier.notify(message);
		return message;
	}
	await section.update(() => settings);
	const message = `Imported ${imported.join(", ")}.`;
	container.notifier.notify(message);
	return message;
}

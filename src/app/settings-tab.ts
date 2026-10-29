import { PluginSettingTab, type Plugin } from "obsidian";

import { renderPeriodicSettings } from "../features/periodic";
import { renderPlannerSettings } from "../features/planner";
import { renderPpvSettings } from "../features/ppv";
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
		);
		renderPlannerSettings(containerEl, container.settings.section("planner"));
		renderPpvSettings(containerEl, container.settings.section("ppv"));
	}
}

import { App, PluginSettingTab, Setting } from "obsidian";

import { DEFAULT_FORMATS, DISPLAY_CONFIGS, GRANULARITIES } from "./constants";
import type { Granularity, PluginSettings, WeekStart } from "./types";
import type CalendarPeriodicNotesPlugin from "./main";

export const DEFAULT_SETTINGS: PluginSettings = {
	notes: {
		day: { enabled: true, format: "", folder: "", template: "" },
		week: { enabled: false, format: "", folder: "", template: "" },
		month: { enabled: false, format: "", folder: "", template: "" },
		quarter: { enabled: false, format: "", folder: "", template: "" },
		year: { enabled: false, format: "", folder: "", template: "" },
	},
	weekStart: "locale",
	confirmBeforeCreate: true,
	showWeekNumbers: false,
};

export function mergeSettings(data: unknown): PluginSettings {
	const stored = (data ?? {}) as Partial<PluginSettings>;
	const notes = {} as PluginSettings["notes"];
	for (const granularity of GRANULARITIES) {
		notes[granularity] = {
			...DEFAULT_SETTINGS.notes[granularity],
			...stored.notes?.[granularity],
		};
	}
	return { ...DEFAULT_SETTINGS, ...stored, notes };
}

export function getFormat(
	settings: PluginSettings,
	granularity: Granularity,
): string {
	return settings.notes[granularity].format || DEFAULT_FORMATS[granularity];
}

const WEEK_START_OPTIONS: Record<WeekStart, string> = {
	locale: "Locale default",
	sunday: "Sunday",
	monday: "Monday",
	tuesday: "Tuesday",
	wednesday: "Wednesday",
	thursday: "Thursday",
	friday: "Friday",
	saturday: "Saturday",
};

export class CalendarPeriodicNotesSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: CalendarPeriodicNotesPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Start week on")
			.setDesc("Which day the calendar week begins on.")
			.addDropdown((dropdown) => {
				for (const [value, label] of Object.entries(WEEK_START_OPTIONS)) {
					dropdown.addOption(value, label);
				}
				dropdown.setValue(this.plugin.settings.weekStart);
				dropdown.onChange(async (value) => {
					this.plugin.settings.weekStart = value as WeekStart;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Confirm before creating new note")
			.setDesc(
				"Show a confirmation dialog when clicking a date that has no note yet.",
			)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.confirmBeforeCreate);
				toggle.onChange(async (value) => {
					this.plugin.settings.confirmBeforeCreate = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Show week numbers")
			.setDesc(
				"Add a week number column to the calendar. Clicking a week number opens the weekly note.",
			)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.showWeekNumbers);
				toggle.onChange(async (value) => {
					this.plugin.settings.showWeekNumbers = value;
					await this.plugin.saveSettings();
				});
			});

		for (const granularity of GRANULARITIES) {
			this.displayGranularitySection(granularity);
		}
	}

	private displayGranularitySection(granularity: Granularity): void {
		const { containerEl } = this;
		const config = this.plugin.settings.notes[granularity];
		const periodicity = DISPLAY_CONFIGS[granularity].periodicity;
		const label = periodicity.charAt(0).toUpperCase() + periodicity.slice(1);

		new Setting(containerEl).setName(`${label} notes`).setHeading();

		new Setting(containerEl).setName("Enabled").addToggle((toggle) => {
			toggle.setValue(config.enabled);
			toggle.onChange(async (value) => {
				config.enabled = value;
				await this.plugin.saveSettings();
				this.display();
			});
		});

		if (!config.enabled) {
			return;
		}

		new Setting(containerEl)
			.setName("Format")
			.setDesc(
				`Moment format for ${periodicity} note filenames. Default: ${DEFAULT_FORMATS[granularity]}`,
			)
			.addText((text) => {
				text.setPlaceholder(DEFAULT_FORMATS[granularity]);
				text.setValue(config.format);
				text.onChange(async (value) => {
					config.format = value.trim();
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Folder")
			.setDesc(`Vault folder where ${periodicity} notes are stored.`)
			.addText((text) => {
				text.setPlaceholder("Journal/daily");
				text.setValue(config.folder);
				text.onChange(async (value) => {
					config.folder = value.trim();
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Template")
			.setDesc(`Path to the template file for new ${periodicity} notes.`)
			.addText((text) => {
				text.setPlaceholder("Templates/daily.md");
				text.setValue(config.template);
				text.onChange(async (value) => {
					config.template = value.trim();
					await this.plugin.saveSettings();
				});
			});
	}
}

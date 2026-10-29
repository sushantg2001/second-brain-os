import { Setting } from "obsidian";

import type { SettingsSection } from "../../../shared/kernel";
import type { PeriodicNotes } from "../application/periodic-notes";
import { GRANULARITIES, LABELS, type Granularity } from "../domain/granularity";
import {
	DEFAULT_FORMATS,
	WEEK_STARTS,
	type PeriodicConfig,
	type PeriodicSettings,
	type WeekStart,
} from "../domain/settings";

const WEEK_START_LABELS: Readonly<Record<WeekStart, string>> = {
	locale: "Locale default",
	sunday: "Sunday",
	monday: "Monday",
	tuesday: "Tuesday",
	wednesday: "Wednesday",
	thursday: "Thursday",
	friday: "Friday",
	saturday: "Saturday",
};

function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The "Periodic notes" and "Calendar" part of the settings tab. */
export function renderPeriodicSettings(
	containerEl: HTMLElement,
	section: SettingsSection<PeriodicSettings>,
	periodic: PeriodicNotes,
	redraw: () => void,
): void {
	const current = (): PeriodicSettings => section.store.get();
	const updateNote = (granularity: Granularity, patch: Partial<PeriodicConfig>) =>
		section.update((settings) => ({
			...settings,
			notes: {
				...settings.notes,
				[granularity]: { ...settings.notes[granularity], ...patch },
			},
		}));

	new Setting(containerEl).setName("Calendar").setHeading();
	new Setting(containerEl)
		.setName("Start week on")
		.setDesc("First day of the week in the calendar and for weekly notes.")
		.addDropdown((dropdown) =>
			dropdown
				.addOptions(
					Object.fromEntries(
						WEEK_STARTS.map((value) => [value, WEEK_START_LABELS[value]]),
					),
				)
				.setValue(current().weekStart)
				.onChange(
					(value) =>
						void section.update((settings) => ({
							...settings,
							weekStart: value as WeekStart,
						})),
				),
		);
	new Setting(containerEl)
		.setName("Confirm before creating notes")
		.setDesc("Ask before the calendar creates a note that does not exist yet.")
		.addToggle((toggle) =>
			toggle.setValue(current().confirmBeforeCreate).onChange(
				(value) =>
					void section.update((settings) => ({
						...settings,
						confirmBeforeCreate: value,
					})),
			),
		);
	new Setting(containerEl).setName("Show week numbers").addToggle((toggle) =>
		toggle.setValue(current().showWeekNumbers).onChange(
			(value) =>
				void section.update((settings) => ({
					...settings,
					showWeekNumbers: value,
				})),
		),
	);

	for (const granularity of GRANULARITIES) {
		const config = current().notes[granularity];
		const periodicity = LABELS[granularity].periodicity;
		new Setting(containerEl).setName(`${capitalize(periodicity)} notes`).setHeading();
		new Setting(containerEl).setName("Enabled").addToggle((toggle) =>
			toggle.setValue(config.enabled).onChange(async (value) => {
				await updateNote(granularity, { enabled: value });
				redraw();
			}),
		);
		if (!config.enabled) {
			continue;
		}
		const preview = new Setting(containerEl)
			.setName("Format")
			.setDesc(`Current note: ${periodic.title(granularity, periodic.today())}`);
		preview.addText((text) =>
			text
				.setPlaceholder(DEFAULT_FORMATS[granularity])
				.setValue(config.format)
				.onChange(async (value) => {
					await updateNote(granularity, { format: value });
					preview.setDesc(
						`Current note: ${periodic.title(granularity, periodic.today())}`,
					);
				}),
		);
		new Setting(containerEl)
			.setName("Folder")
			.setDesc("Leave empty for the vault root.")
			.addText((text) =>
				text
					.setValue(config.folder)
					.onChange((value) => void updateNote(granularity, { folder: value })),
			);
		new Setting(containerEl)
			.setName("Template")
			.setDesc(
				"Path of a template note. Supports Templater and {{title}}, {{date}} and {{time}}.",
			)
			.addText((text) =>
				text
					.setValue(config.template)
					.onChange((value) => void updateNote(granularity, { template: value })),
			);
	}
}

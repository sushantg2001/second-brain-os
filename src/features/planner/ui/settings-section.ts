import { Setting } from "obsidian";

import type { SettingsSection } from "../../../shared/kernel";
import type { PlannerSettings } from "../domain/settings";

function integer(text: string, min: number, max: number): number | null {
	if (!/^\d+$/.test(text.trim())) {
		return null;
	}
	const value = Number(text);
	return value >= min && value <= max ? value : null;
}

/** The "Day planner" part of the settings tab. Invalid numbers are ignored until fixed. */
export function renderPlannerSettings(
	containerEl: HTMLElement,
	section: SettingsSection<PlannerSettings>,
): void {
	const current = (): PlannerSettings => section.store.get();
	const set = (patch: Partial<PlannerSettings>) =>
		void section.update((settings) => ({ ...settings, ...patch }));
	const numberSetting = (
		name: string,
		desc: string,
		key:
			| "startHour"
			| "endHour"
			| "snapMinutes"
			| "defaultDuration"
			| "hourHeight"
			| "multiDayCount",
		min: number,
		max: number,
		valid: (value: number, settings: PlannerSettings) => boolean = () => true,
	): void => {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) =>
				text.setValue(String(current()[key])).onChange((raw) => {
					const value = integer(raw, min, max);
					if (value !== null && valid(value, current())) {
						set({ [key]: value });
					}
				}),
			);
	};

	new Setting(containerEl).setName("Day planner").setHeading();
	numberSetting(
		"Day starts at",
		"First hour on the timeline (0 to 23).",
		"startHour",
		0,
		23,
		(value, settings) => value < settings.endHour,
	);
	numberSetting(
		"Day ends at",
		"Last hour on the timeline (1 to 24).",
		"endHour",
		1,
		24,
		(value, settings) => value > settings.startHour,
	);
	numberSetting("Snap to minutes", "Step for dragging and keyboard moves.", "snapMinutes", 1, 60);
	numberSetting(
		"Default duration",
		"Minutes for a block with only a start time.",
		"defaultDuration",
		5,
		480,
	);
	numberSetting("Hour height", "Pixels per hour on the timeline.", "hourHeight", 24, 240);
	numberSetting("Days in multi-day view", "From 2 to 7.", "multiDayCount", 2, 7);
	new Setting(containerEl)
		.setName("Heading for new blocks")
		.setDesc("Blocks created from the timeline go under this heading in the daily note.")
		.addText((text) =>
			text.setValue(current().heading).onChange((value) => {
				if (value.trim()) {
					set({ heading: value.trim() });
				}
			}),
		);
	new Setting(containerEl)
		.setName("Show the calendar in the day planner")
		.setDesc("A month calendar above the timeline, always on the day the timeline shows.")
		.addToggle((toggle) =>
			toggle
				.setValue(current().showCalendar)
				.onChange((value) => set({ showCalendar: value })),
		);
	new Setting(containerEl)
		.setName("Show current block in the status bar")
		.addToggle((toggle) =>
			toggle
				.setValue(current().showStatusBar)
				.onChange((value) => set({ showStatusBar: value })),
		);
	new Setting(containerEl)
		.setName("Notify when a block starts")
		.addToggle((toggle) =>
			toggle
				.setValue(current().notifyOnStart)
				.onChange((value) => set({ notifyOnStart: value })),
		);
}

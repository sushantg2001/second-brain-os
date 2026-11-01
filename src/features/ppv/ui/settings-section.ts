import { Setting } from "obsidian";

import type { SettingsSection } from "../../../shared/kernel";
import {
	CAPTURE_TARGETS,
	PPV_TYPES,
	TYPE_LABELS,
	type CaptureTarget,
	type PpvSettings,
} from "../domain/settings";

/** The "Pillars, pipelines and vaults" part of the settings tab. */
export function renderPpvSettings(
	containerEl: HTMLElement,
	section: SettingsSection<PpvSettings>,
): void {
	const current = (): PpvSettings => section.store.get();
	const set = (patch: Partial<PpvSettings>) =>
		void section.update((settings) => ({ ...settings, ...patch }));

	new Setting(containerEl).setName("Pillars, pipelines and vaults").setHeading();
	for (const type of PPV_TYPES) {
		const label = TYPE_LABELS[type];
		new Setting(containerEl)
			.setName(`${label} folder`)
			.addText((text) =>
				text
					.setValue(current().folders[type])
					.onChange((value) =>
						set({ folders: { ...current().folders, [type]: value.trim() } }),
					),
			);
		new Setting(containerEl)
			.setName(`${label} template`)
			.setDesc("Optional template note. Leave empty for the built-in layout.")
			.addText((text) =>
				text
					.setValue(current().templates[type])
					.onChange((value) =>
						set({ templates: { ...current().templates, [type]: value.trim() } }),
					),
			);
	}
	new Setting(containerEl)
		.setName("Archive folder")
		.addText((text) =>
			text
				.setValue(current().archiveFolder)
				.onChange((value) => set({ archiveFolder: value.trim() })),
		);
	new Setting(containerEl)
		.setName("Archive finished projects")
		.setDesc("Move a project to the archive folder when it is done or dropped.")
		.addToggle((toggle) =>
			toggle
				.setValue(current().archiveClosedProjects)
				.onChange((value) => set({ archiveClosedProjects: value })),
		);
	new Setting(containerEl).setName("Capture to").addDropdown((dropdown) =>
		dropdown
			.addOptions(
				Object.fromEntries(
					CAPTURE_TARGETS.map((target) => [
						target,
						target === "daily" ? "Today's note" : "Inbox note",
					]),
				),
			)
			.setValue(current().captureTarget)
			.onChange((value) => set({ captureTarget: value as CaptureTarget })),
	);
	new Setting(containerEl)
		.setName("Inbox note")
		.addText((text) =>
			text
				.setValue(current().inboxPath)
				.onChange((value) => set({ inboxPath: value.trim() })),
		);
	new Setting(containerEl).setName("Capture heading").addText((text) =>
		text.setValue(current().captureHeading).onChange((value) => {
			if (value.trim()) {
				set({ captureHeading: value.trim() });
			}
		}),
	);
}

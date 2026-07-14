import { moment, Plugin, WorkspaceLeaf } from "obsidian";

import { createApi, type PublicApi } from "./api";
import { getCommands } from "./commands";
import { VIEW_TYPE_CALENDAR } from "./constants";
import { PeriodicNotesManager } from "./notes";
import {
	CalendarPeriodicNotesSettingTab,
	mergeSettings,
} from "./settings";
import { CalendarView } from "./ui/view";
import { JumpToDateModal } from "./ui/jump-to-date-modal";
import type { PluginSettings } from "./types";

export default class CalendarPeriodicNotesPlugin extends Plugin {
	settings!: PluginSettings;
	notesManager!: PeriodicNotesManager;
	api!: PublicApi;

	async onload(): Promise<void> {
		this.settings = mergeSettings(await this.loadData());
		this.notesManager = new PeriodicNotesManager(this.app, () => this.settings);
		this.api = createApi(this);

		this.registerView(
			VIEW_TYPE_CALENDAR,
			(leaf) => new CalendarView(leaf, this),
		);

		this.addRibbonIcon("calendar-days", "Open calendar", () => {
			void this.activateCalendarView();
		});

		this.addCommand({
			id: "open-calendar-view",
			name: "Open calendar view",
			callback: () => {
				void this.activateCalendarView();
			},
		});

		this.addCommand({
			id: "reveal-active-note",
			name: "Reveal active note in calendar",
			checkCallback: (checking) => {
				const view = this.getCalendarView();
				if (!view) {
					return false;
				}
				if (!checking) {
					view.revealActiveNote();
				}
				return true;
			},
		});

		this.addCommand({
			id: "jump-to-date",
			name: "Jump to date",
			checkCallback: (checking) => {
				const view = this.getCalendarView();
				if (!view) {
					return false;
				}
				if (!checking) {
					new JumpToDateModal(this.app, moment(), (target) =>
						view.setDisplayedMonth(target),
					).open();
				}
				return true;
			},
		});

		for (const command of getCommands(this)) {
			this.addCommand(command);
		}

		this.addSettingTab(new CalendarPeriodicNotesSettingTab(this.app, this));
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.getCalendarView()?.onSettingsChange();
	}

	private getCalendarView(): CalendarView | null {
		const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR)[0];
		return leaf?.view instanceof CalendarView ? leaf.view : null;
	}

	private async activateCalendarView(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_CALENDAR)[0];
		if (existing) {
			await workspace.revealLeaf(existing);
			return;
		}
		const leaf: WorkspaceLeaf | null = workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({ type: VIEW_TYPE_CALENDAR, active: true });
			await workspace.revealLeaf(leaf);
		}
	}
}

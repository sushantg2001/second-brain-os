import { moment, ItemView, TFile, WorkspaceLeaf } from "obsidian";
import type { Moment } from "moment";

import { DISPLAY_CONFIGS, VIEW_TYPE_CALENDAR } from "../constants";
import { Calendar } from "./calendar";
import { ConfirmationModal } from "./confirm-modal";
import { JumpToDateModal } from "./jump-to-date-modal";
import type { Granularity } from "../types";
import type CalendarPeriodicNotesPlugin from "../main";

export class CalendarView extends ItemView {
	private calendar: Calendar | null = null;
	private lastToday: Moment = moment();

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: CalendarPeriodicNotesPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_CALENDAR;
	}

	getDisplayText(): string {
		return "Calendar";
	}

	getIcon(): string {
		return "calendar-days";
	}

	onOpen(): Promise<void> {
		this.contentEl.empty();
		this.calendar = new Calendar(
			this.contentEl.createDiv(),
			{
				weekStart: this.plugin.settings.weekStart,
				showWeekNumbers: this.plugin.settings.showWeekNumbers,
			},
			{
				hasDailyNote: (date) =>
					this.plugin.notesManager.getNote("day", date) !== null,
				hasWeeklyNote: (date) =>
					this.plugin.settings.notes.week.enabled &&
					this.plugin.notesManager.getNote("week", date) !== null,
				onClickDay: (date, inNewSplit) =>
					this.openOrCreateNote("day", date, inNewSplit),
				onClickWeek: (date, inNewSplit) =>
					this.openOrCreateNote("week", date, inNewSplit),
				onTitleClick: (displayedMonth) => {
					new JumpToDateModal(this.app, displayedMonth, (target) =>
						this.setDisplayedMonth(target),
					).open();
				},
			},
		);
		this.calendar.render();

		this.registerEvent(this.app.vault.on("create", this.refresh));
		this.registerEvent(this.app.vault.on("delete", this.refresh));
		this.registerEvent(this.app.vault.on("rename", this.refresh));
		this.registerEvent(
			this.app.workspace.on("file-open", () => this.highlightActiveNote()),
		);
		this.registerInterval(
			window.setInterval(() => this.rolloverToday(), 1000 * 60),
		);

		this.highlightActiveNote();
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.calendar = null;
		return Promise.resolve();
	}

	onSettingsChange(): void {
		this.calendar?.setOptions({
			weekStart: this.plugin.settings.weekStart,
			showWeekNumbers: this.plugin.settings.showWeekNumbers,
		});
	}

	setDisplayedMonth(date: Moment): void {
		this.calendar?.setDisplayedMonth(date);
	}

	revealActiveNote(): void {
		const date = this.getActiveNoteDate();
		if (date) {
			this.calendar?.setDisplayedMonth(date);
		}
	}

	private refresh = (): void => {
		this.calendar?.render();
	};

	private rolloverToday(): void {
		const now = moment();
		if (!now.isSame(this.lastToday, "day")) {
			this.lastToday = now;
			this.calendar?.setToday(now);
		}
	}

	private getActiveNoteDate(): Moment | null {
		const file = this.app.workspace.getActiveFile();
		if (!(file instanceof TFile)) {
			return null;
		}
		return (
			this.plugin.notesManager.getNoteDate("day", file) ??
			this.plugin.notesManager.getNoteDate("week", file)
		);
	}

	private highlightActiveNote(): void {
		this.calendar?.setSelectedDate(this.getActiveNoteDate());
	}

	private openOrCreateNote(
		granularity: Granularity,
		date: Moment,
		inNewSplit: boolean,
	): void {
		if (granularity === "week" && !this.plugin.settings.notes.week.enabled) {
			return;
		}
		const existing = this.plugin.notesManager.getNote(granularity, date);
		if (!existing && this.plugin.settings.confirmBeforeCreate) {
			const periodicity = DISPLAY_CONFIGS[granularity].periodicity;
			new ConfirmationModal(this.app, {
				title: "New note",
				text: `File ${this.plugin.notesManager.getNotePath(granularity, date)} does not exist. Would you like to create it?`,
				cta: `Create ${periodicity} note`,
				onAccept: () => {
					void this.plugin.notesManager.openNote(granularity, date, inNewSplit);
				},
			}).open();
			return;
		}
		void this.plugin.notesManager.openNote(granularity, date, inNewSplit);
	}
}

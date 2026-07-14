import { moment } from "obsidian";
import type { Moment } from "moment";

import { getMonthGrid, getWeekdayNames } from "../utils/dates";
import type { WeekStart } from "../types";

export interface CalendarOptions {
	weekStart: WeekStart;
	showWeekNumbers: boolean;
}

export interface CalendarCallbacks {
	hasDailyNote(date: Moment): boolean;
	hasWeeklyNote(date: Moment): boolean;
	onClickDay(date: Moment, inNewSplit: boolean): void;
	onClickWeek(date: Moment, inNewSplit: boolean): void;
	onTitleClick(displayedMonth: Moment): void;
}

export class Calendar {
	private displayedMonth: Moment;
	private today: Moment;
	private selectedDate: Moment | null = null;

	constructor(
		private containerEl: HTMLElement,
		private options: CalendarOptions,
		private callbacks: CalendarCallbacks,
	) {
		this.today = moment();
		this.displayedMonth = this.today.clone();
	}

	getDisplayedMonth(): Moment {
		return this.displayedMonth.clone();
	}

	setDisplayedMonth(date: Moment): void {
		this.displayedMonth = date.clone();
		this.render();
	}

	setToday(date: Moment): void {
		this.today = date.clone();
		this.render();
	}

	setSelectedDate(date: Moment | null): void {
		this.selectedDate = date ? date.clone() : null;
		this.render();
	}

	setOptions(options: CalendarOptions): void {
		this.options = options;
		this.render();
	}

	render(): void {
		this.containerEl.empty();
		this.containerEl.addClass("cpn-calendar");
		this.renderHeader();
		this.renderGrid();
	}

	private renderHeader(): void {
		const header = this.containerEl.createDiv({ cls: "cpn-header" });

		const title = header.createEl("button", {
			cls: "cpn-title",
			attr: { "aria-label": "Jump to date" },
		});
		title.createSpan({
			cls: "cpn-title-month",
			text: this.displayedMonth.format("MMMM"),
		});
		title.createSpan({
			cls: "cpn-title-year",
			text: this.displayedMonth.format(" YYYY"),
		});
		title.addEventListener("click", () => {
			this.callbacks.onTitleClick(this.displayedMonth.clone());
		});

		const nav = header.createDiv({ cls: "cpn-nav" });
		nav
			.createEl("button", {
				cls: "cpn-nav-button",
				text: "‹",
				attr: { "aria-label": "Previous month" },
			})
			.addEventListener("click", () => {
				this.setDisplayedMonth(this.displayedMonth.clone().subtract(1, "month"));
			});
		nav
			.createEl("button", {
				cls: "cpn-nav-button cpn-nav-today",
				text: "•",
				attr: { "aria-label": "Go to this month" },
			})
			.addEventListener("click", () => {
				this.setDisplayedMonth(this.today.clone());
			});
		nav
			.createEl("button", {
				cls: "cpn-nav-button",
				text: "›",
				attr: { "aria-label": "Next month" },
			})
			.addEventListener("click", () => {
				this.setDisplayedMonth(this.displayedMonth.clone().add(1, "month"));
			});
	}

	private renderGrid(): void {
		const { weekStart, showWeekNumbers } = this.options;
		const table = this.containerEl.createEl("table", { cls: "cpn-grid" });

		const headRow = table.createEl("thead").createEl("tr");
		if (showWeekNumbers) {
			headRow.createEl("th", { text: "W", cls: "cpn-weeknum-header" });
		}
		for (const name of getWeekdayNames(weekStart)) {
			headRow.createEl("th", { text: name });
		}

		const body = table.createEl("tbody");
		for (const week of getMonthGrid(this.displayedMonth, weekStart)) {
			const row = body.createEl("tr");
			if (showWeekNumbers) {
				this.renderWeekNumberCell(row, week);
			}
			for (const day of week) {
				this.renderDayCell(row, day);
			}
		}
	}

	private renderWeekNumberCell(row: HTMLElement, week: Moment[]): void {
		const weekStart = week[0];
		if (!weekStart) {
			return;
		}
		const cell = row.createEl("td", { cls: "cpn-weeknum" });
		const button = cell.createEl("button", {
			cls: "cpn-cell-button",
			text: weekStart.format("ww"),
		});
		if (this.callbacks.hasWeeklyNote(weekStart)) {
			button.createDiv({ cls: "cpn-dot" });
		}
		button.addEventListener("click", (event) => {
			this.callbacks.onClickWeek(weekStart.clone(), event.ctrlKey || event.metaKey);
		});
	}

	private renderDayCell(row: HTMLElement, day: Moment): void {
		const cell = row.createEl("td", { cls: "cpn-day" });
		const button = cell.createEl("button", {
			cls: "cpn-cell-button",
			text: day.format("D"),
		});
		if (!day.isSame(this.displayedMonth, "month")) {
			button.addClass("cpn-adjacent-month");
		}
		if (day.isSame(this.today, "day")) {
			button.addClass("cpn-today");
		}
		if (this.selectedDate && day.isSame(this.selectedDate, "day")) {
			button.addClass("cpn-selected");
		}
		if (this.callbacks.hasDailyNote(day)) {
			button.createDiv({ cls: "cpn-dot" });
		}
		button.addEventListener("click", (event) => {
			this.callbacks.onClickDay(day.clone(), event.ctrlKey || event.metaKey);
		});
	}
}

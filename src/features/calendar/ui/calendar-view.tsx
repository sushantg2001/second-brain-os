import type { App, WorkspaceLeaf } from "obsidian";
import type { ReactNode } from "react";

import { toParts } from "../../../shared/kernel";
import { ReactItemView, ReactModal } from "../../../shared/react";
import { Calendar } from "./calendar";
import { JumpToDate } from "./jump-to-date";
import { CalendarContext, type CalendarServices } from "./services";

export const VIEW_TYPE_CALENDAR = "sbos-calendar";

export class CalendarView extends ReactItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private readonly services: CalendarServices,
	) {
		super(leaf);
	}

	override getViewType(): string {
		return VIEW_TYPE_CALENDAR;
	}

	override getDisplayText(): string {
		return "Calendar";
	}

	override getIcon(): string {
		return "calendar-days";
	}

	protected override renderContent(): ReactNode {
		return (
			<CalendarContext.Provider value={this.services}>
				<Calendar />
			</CalendarContext.Provider>
		);
	}
}

export class JumpToDateModal extends ReactModal {
	constructor(
		app: App,
		private readonly services: CalendarServices,
	) {
		super(app, "Jump to date");
	}

	protected override renderContent(): ReactNode {
		const { year, month } = toParts(this.services.state.snapshot.get().focused);
		return (
			<JumpToDate
				dates={this.services.dates}
				initialYear={year}
				currentMonth={month}
				onPick={(pickedYear, pickedMonth) => {
					this.services.state.showMonth(pickedYear, pickedMonth);
					this.close();
				}}
			/>
		);
	}
}

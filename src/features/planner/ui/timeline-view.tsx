import type { App, WorkspaceLeaf } from "obsidian";
import type { ReactNode } from "react";

import type { IsoDate, Minutes } from "../../../shared/kernel";
import { ReactItemView, ReactModal } from "../../../shared/react";
import { NewBlockForm } from "./new-block";
import { PlannerContext, type PlannerServices } from "./services";
import { Timeline, TimelineState } from "./timeline";

export const VIEW_TYPE_TIMELINE = "sbos-timeline";

export class TimelineView extends ReactItemView {
	readonly state: TimelineState;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly services: PlannerServices,
		days: number,
	) {
		super(leaf);
		this.state = new TimelineState({ date: services.now.get().date, days });
	}

	override getViewType(): string {
		return VIEW_TYPE_TIMELINE;
	}

	override getDisplayText(): string {
		return this.state.get().days === 1 ? "Day planner" : "Multi-day planner";
	}

	override getIcon(): string {
		return "calendar-clock";
	}

	override getState(): Record<string, unknown> {
		return { ...this.state.get() };
	}

	override async setState(
		state: unknown,
		result: Parameters<ReactItemView["setState"]>[1],
	): Promise<void> {
		const days = (state as { days?: unknown } | null)?.days;
		if (typeof days === "number" && days >= 1 && days <= 7) {
			this.state.update((current) => ({ ...current, days }));
		}
		await super.setState(state, result);
	}

	protected override renderContent(): ReactNode {
		return (
			<PlannerContext.Provider value={this.services}>
				<Timeline state={this.state} />
			</PlannerContext.Provider>
		);
	}
}

export class NewBlockModal extends ReactModal {
	constructor(
		app: App,
		private readonly services: PlannerServices,
		private readonly date: IsoDate,
		private readonly start: Minutes,
		private readonly end: Minutes,
	) {
		super(app, `New block on ${services.dates.format(date, "dddd, MMMM D")}`);
	}

	protected override renderContent(): ReactNode {
		return (
			<NewBlockForm
				start={this.start}
				end={this.end}
				onCancel={() => this.close()}
				onSubmit={async (title, start, end) => {
					const result = await this.services.planner.createBlock(
						this.date,
						title,
						start,
						end,
					);
					if (!result.ok) {
						return result.error.message;
					}
					this.close();
					return null;
				}}
			/>
		);
	}
}

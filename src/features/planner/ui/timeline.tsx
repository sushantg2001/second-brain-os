import { useEffect, useRef, type ReactNode } from "react";

import { addDays, formatDuration, formatTime, Store, type IsoDate } from "../../../shared/kernel";
import { Icon, useStore } from "../../../shared/react";
import { PlannerContext } from "./services";
import { TASK_DRAG_TYPE, TimelineDay } from "./timeline-day";

export interface TimelineRange {
	/** First day shown. */
	readonly date: IsoDate;
	readonly days: number;
}

export class TimelineState extends Store<TimelineRange> {
	shift(days: number): void {
		this.update((range) => ({ ...range, date: addDays(range.date, days) }));
	}
}

export function Timeline({ state }: { readonly state: TimelineState }): ReactNode {
	const services = PlannerContext.useService();
	const { planner, dates } = services;
	useStore(services.version);
	const range = useStore(state);
	const now = useStore(services.now);
	const settings = useStore(planner.settingsStore);
	const scrollRef = useRef<HTMLDivElement>(null);
	const days = Array.from({ length: range.days }, (_, index) => addDays(range.date, index));
	const firstPlan = planner.plan(range.date);

	// Scroll so the current time, or the first block, is in view when the view opens.
	useEffect(() => {
		const scroller = scrollRef.current;
		if (!scroller) {
			return;
		}
		const focus = days.includes(now.date)
			? now.minutes
			: (firstPlan.blocks[0]?.start ?? settings.startHour * 60);
		scroller.scrollTop = Math.max(
			0,
			((focus - settings.startHour * 60) / 60 - 1) * settings.hourHeight,
		);
		// Only on open and when the range changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps -- see above
	}, [range.date, range.days]);

	const addBlock = (): void => {
		const date = days.includes(now.date) ? now.date : range.date;
		const start = planner.freeSlot(date) ?? settings.startHour * 60;
		services.newBlock(date, start, start + settings.defaultDuration);
	};

	const title =
		range.days === 1
			? dates.format(range.date, "dddd, MMMM D")
			: `${dates.format(range.date, "MMM D")} – ${dates.format(addDays(range.date, range.days - 1), "MMM D")}`;
	const hours = Array.from(
		{ length: settings.endHour - settings.startHour },
		(_, index) => settings.startHour + index,
	);

	return (
		<div className="sbos-timeline">
			<div className="sbos-timeline__toolbar">
				<h3 className="sbos-timeline__title">{title}</h3>
				<div className="sbos-timeline__nav">
					<button
						type="button"
						aria-label={range.days === 1 ? "Previous day" : "Previous days"}
						onClick={() => state.shift(-range.days)}
					>
						<Icon name="chevron-left" />
					</button>
					<button
						type="button"
						onClick={() => state.update((current) => ({ ...current, date: now.date }))}
					>
						Today
					</button>
					<button
						type="button"
						aria-label={range.days === 1 ? "Next day" : "Next days"}
						onClick={() => state.shift(range.days)}
					>
						<Icon name="chevron-right" />
					</button>
					<button type="button" aria-label="Add time block" onClick={addBlock}>
						<Icon name="plus" />
					</button>
				</div>
			</div>
			{range.days === 1 && (
				<p className="sbos-timeline__summary">
					Planned {formatDuration(firstPlan.plannedMinutes)}
					{services.clocks &&
						` · Clocked ${formatDuration(services.clocks.minutesOn(range.date))}`}
				</p>
			)}
			{range.days > 1 && (
				<div className="sbos-timeline__day-headers">
					<div className="sbos-timeline__gutter" />
					{days.map((date) => (
						<div
							key={date}
							className={`sbos-timeline__day-header${date === now.date ? " is-today" : ""}`}
						>
							{dates.format(date, "ddd D")}
							<span className="sbos-timeline__total">
								{formatDuration(planner.plan(date).plannedMinutes)}
							</span>
						</div>
					))}
				</div>
			)}
			<div ref={scrollRef} className="sbos-timeline__scroll">
				<div className="sbos-timeline__body">
					<div className="sbos-timeline__gutter" aria-hidden="true">
						{hours.map((hour) => (
							<div
								key={hour}
								className="sbos-timeline__label"
								style={{ height: `${settings.hourHeight}px` }}
							>
								{formatTime(hour * 60)}
							</div>
						))}
					</div>
					{days.map((date) => (
						<section
							key={date}
							className="sbos-timeline__day"
							aria-label={`Timeline for ${dates.format(date, "dddd, MMMM D")}`}
						>
							<TimelineDay date={date} />
						</section>
					))}
				</div>
			</div>
			<Unscheduled date={days.includes(now.date) ? now.date : range.date} />
		</div>
	);
}

function Unscheduled({ date }: { readonly date: IsoDate }): ReactNode {
	const services = PlannerContext.useService();
	const { planner } = services;
	useStore(services.version);
	const tasks = planner.plan(date).unscheduled;
	if (tasks.length === 0) {
		return null;
	}
	return (
		<section className="sbos-unscheduled" aria-labelledby="sbos-unscheduled-title">
			<h4 id="sbos-unscheduled-title">Unscheduled</h4>
			<ul>
				{tasks.map((task) => (
					<li
						key={task.id}
						draggable
						onDragStart={(event) => {
							event.dataTransfer.setData(TASK_DRAG_TYPE, task.id);
							event.dataTransfer.effectAllowed = "move";
						}}
					>
						<button
							type="button"
							className="sbos-unscheduled__title"
							onClick={() => services.openTask(task)}
						>
							{task.title}
						</button>
						<button
							type="button"
							aria-label={`Schedule ${task.title}`}
							onClick={() =>
								void planner.schedule(task, date).then((result) => {
									if (!result.ok) {
										services.report(result.error);
									}
								})
							}
						>
							<Icon name="calendar-plus" />
						</button>
					</li>
				))}
			</ul>
		</section>
	);
}

import { useEffect, useRef, type MouseEventHandler, type ReactNode } from "react";

import { addDays, formatDuration, Store, type IsoDate } from "../../../shared/kernel";
import { Icon, useStore } from "../../../shared/react";
import { Calendar, CalendarContext, type CalendarServices } from "../../calendar";
import { PlannerContext } from "./services";
import { TASK_DRAG_TYPE, TimelineDay } from "./timeline-day";
import { WeekPicker } from "./week-picker";

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

/**
 * Keeps a single-day timeline and the calendar on the same day: picking a day in the calendar
 * shows its plan, and moving the timeline moves the calendar.
 */
function useLinkedCalendar(
	state: TimelineState,
	calendar: CalendarServices | undefined,
	active: boolean,
): void {
	useEffect(() => {
		if (!calendar || !active) {
			return;
		}
		const fromCalendar = (): void => {
			const focused = calendar.state.snapshot.get().focused;
			if (state.get().date !== focused) {
				state.update((range) => ({ ...range, date: focused }));
			}
		};
		const fromTimeline = (): void => {
			const { date } = state.get();
			if (calendar.state.snapshot.get().focused !== date) {
				calendar.state.show(date);
			}
		};
		fromTimeline();
		const offCalendar = calendar.state.snapshot.subscribe(fromCalendar);
		const offTimeline = state.subscribe(fromTimeline);
		return () => {
			offCalendar();
			offTimeline();
		};
	}, [state, calendar, active]);
}

interface ControlProps {
	readonly label: string;
	readonly onClick: MouseEventHandler<HTMLButtonElement>;
	readonly children: ReactNode;
	readonly className?: string;
	readonly active?: boolean;
	readonly expanded?: boolean;
}

/** An icon or text button in the controls row, styled like the day planner's. */
function Control(props: ControlProps): ReactNode {
	return (
		<button
			type="button"
			className={`sbos-control${props.className ? ` ${props.className}` : ""}${props.active ? " is-active" : ""}`}
			aria-label={props.label}
			{...(props.expanded === undefined ? {} : { "aria-expanded": props.expanded })}
			onClick={props.onClick}
		>
			{props.children}
		</button>
	);
}

export function Timeline({ state }: { readonly state: TimelineState }): ReactNode {
	const services = PlannerContext.useService();
	const { planner, dates } = services;
	useStore(services.version);
	const range = useStore(state);
	const now = useStore(services.now);
	const settings = useStore(planner.settingsStore);
	const scrollRef = useRef<HTMLDivElement>(null);
	const rulerRef = useRef<HTMLDivElement>(null);
	const rootRef = useRef<HTMLDivElement>(null);
	const days = Array.from({ length: range.days }, (_, index) => addDays(range.date, index));
	const firstPlan = planner.plan(range.date);
	const single = range.days === 1;
	const linked = single && services.calendar !== undefined;
	const showMonth = linked && settings.showCalendar;
	useLinkedCalendar(state, services.calendar, linked);
	const dayTitle = (date: IsoDate, text: string, className: string): ReactNode =>
		services.openDay ? (
			<button
				type="button"
				className={`sbos-link ${className}`}
				aria-label={`Open daily note for ${dates.format(date, "dddd, MMMM D")}`}
				onClick={(event) => services.openDay?.(date, event.ctrlKey || event.metaKey)}
			>
				{text}
			</button>
		) : (
			text
		);

	// The ruler scrolls in step with the timeline, so it has to end with a strip as tall as the
	// timeline's own horizontal scrollbar, or it stops short of the last hour. Only the browser
	// knows how tall that is, and it differs by platform.
	useEffect(() => {
		const scroller = scrollRef.current;
		const root = rootRef.current;
		if (scroller && root) {
			const scrollbar = scroller.offsetHeight - scroller.clientHeight;
			root.style.setProperty("--sbos-scrollbar-width", `${scrollbar}px`);
		}
	});

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

	const step = single ? 7 : range.days;
	const period = single
		? dates.format(range.date, "MMM YYYY")
		: `${dates.format(range.date, "MMM D")} – ${dates.format(addDays(range.date, range.days - 1), "MMM D")}`;
	const hours = Array.from(
		{ length: settings.endHour - settings.startHour },
		(_, index) => settings.startHour + index,
	);
	const pickDay = (date: IsoDate, split: boolean): void => {
		if (date === range.date) {
			services.openDay?.(date, split);
		} else {
			state.update((current) => ({ ...current, date }));
		}
	};

	return (
		<div ref={rootRef} className={`sbos-timeline${single ? "" : " is-multi"}`}>
			{showMonth && services.calendar && (
				<div className="sbos-timeline__calendar">
					<CalendarContext.Provider value={services.calendar}>
						<Calendar embedded />
					</CalendarContext.Provider>
				</div>
			)}
			<div className="sbos-timeline__controls">
				<div className="sbos-timeline__header">
					<div className="sbos-timeline__buttons">
						<Control
							label={single ? "Previous week" : "Previous days"}
							onClick={() => state.shift(-step)}
						>
							<Icon name="chevron-left" />
						</Control>
						<Control
							label="Today"
							className="sbos-timeline__today"
							onClick={() =>
								state.update((current) => ({ ...current, date: now.date }))
							}
						>
							Today
						</Control>
						<Control
							label={single ? "Next week" : "Next days"}
							onClick={() => state.shift(step)}
						>
							<Icon name="chevron-right" />
						</Control>
					</div>
					<div className="sbos-timeline__period">{period}</div>
					<div className="sbos-timeline__buttons is-right">
						{linked && (
							<Control
								label={settings.showCalendar ? "Hide calendar" : "Show calendar"}
								active={settings.showCalendar}
								expanded={settings.showCalendar}
								onClick={() => services.setShowCalendar?.(!settings.showCalendar)}
							>
								<Icon name="calendar-days" />
							</Control>
						)}
						<Control label="Add time block" onClick={addBlock}>
							<Icon name="plus" />
						</Control>
					</div>
				</div>
				{single && !showMonth && (
					<WeekPicker
						week={planner.weekOf(range.date)}
						selected={range.date}
						today={now.date}
						dates={dates}
						onPick={pickDay}
					/>
				)}
				{single && (
					<div className="sbos-timeline__day-title">
						<h3 className="sbos-timeline__title">
							{dayTitle(
								range.date,
								dates.format(range.date, "dddd, MMMM D"),
								"sbos-timeline__title-button",
							)}
						</h3>
						<p className="sbos-timeline__summary">
							Planned {formatDuration(firstPlan.plannedMinutes)}
							{services.clocks &&
								` · Clocked ${formatDuration(services.clocks.minutesOn(range.date))}`}
						</p>
					</div>
				)}
			</div>
			{!single && (
				<div className="sbos-timeline__dates">
					{days.map((date) => (
						<div
							key={date}
							className={`sbos-timeline__date${date === now.date ? " is-today" : ""}`}
						>
							<span className="sbos-timeline__weekday">
								{dates.format(date, "ddd")}
							</span>
							{dayTitle(date, dates.format(date, "D"), "sbos-timeline__date-number")}
							<span className="sbos-timeline__total">
								{formatDuration(planner.plan(date).plannedMinutes)}
							</span>
						</div>
					))}
				</div>
			)}
			<div className="sbos-timeline__corner" />
			<Unscheduled date={days.includes(now.date) ? now.date : range.date} />
			<div ref={rulerRef} className="sbos-timeline__ruler" aria-hidden="true">
				<div className="sbos-timeline__hours">
					{hours.map((hour) => (
						<div
							key={hour}
							className="sbos-timeline__label"
							style={{ flexBasis: `${settings.hourHeight}px` }}
						>
							{hour}
						</div>
					))}
				</div>
				<div className="sbos-timeline__scrollbar-filler" />
			</div>
			<div
				ref={scrollRef}
				className="sbos-timeline__scroll"
				onScroll={(event) => {
					if (rulerRef.current) {
						rulerRef.current.scrollTop = event.currentTarget.scrollTop;
					}
				}}
			>
				<div className="sbos-timeline__body">
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
		</div>
	);
}

function Unscheduled({ date }: { readonly date: IsoDate }): ReactNode {
	const services = PlannerContext.useService();
	const { planner } = services;
	useStore(services.version);
	const tasks = planner.plan(date).unscheduled;
	return (
		<section className="sbos-timeline__all-day" aria-labelledby="sbos-unscheduled-title">
			<h4 id="sbos-unscheduled-title" className="sbos-unscheduled__heading">
				Unscheduled
			</h4>
			{tasks.length === 0 ? (
				<p className="sbos-unscheduled__empty">No unscheduled tasks</p>
			) : (
				<ul className="sbos-unscheduled__list">
					{tasks.map((task) => (
						<li
							key={task.id}
							className="sbos-unscheduled__item"
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
								className="sbos-unscheduled__schedule"
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
			)}
		</section>
	);
}

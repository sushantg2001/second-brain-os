import {
	useEffect,
	useMemo,
	useRef,
	type KeyboardEvent,
	type MouseEvent,
	type ReactNode,
} from "react";

import { dayOfWeek, Store, toParts, type IsoDate } from "../../../shared/kernel";
import { Icon, useStore } from "../../../shared/react";
import { monthGrid, type Granularity } from "../../periodic";
import { CalendarContext, type DayBadge } from "./services";

const NO_BADGES = new Store<ReadonlyMap<IsoDate, readonly DayBadge[]>>(new Map());
const NO_TICK = new Store<unknown>(null);

const KEY_MOVES: Readonly<Record<string, number>> = {
	ArrowLeft: -1,
	ArrowRight: 1,
	ArrowUp: -7,
	ArrowDown: 7,
};

function isSplitClick(event: MouseEvent): boolean {
	return event.ctrlKey || event.metaKey;
}

export interface CalendarProps {
	/** Inside another view that has its own "Today" button, such as the day planner. */
	readonly embedded?: boolean;
}

export function Calendar({ embedded = false }: CalendarProps): ReactNode {
	const services = CalendarContext.useService();
	const { periodic, dates, state, activate, openJumpToDate } = services;
	const snapshot = useStore(state.snapshot);
	const index = useStore(periodic.index);
	const settings = useStore(periodic.settingsStore);
	const activePath = useStore(services.activePath);
	const badges = useStore(services.badges ?? NO_BADGES);
	useStore(services.tick ?? NO_TICK);
	const gridRef = useRef<HTMLTableElement>(null);
	// Set by keyboard navigation. The old day's button may unmount when the month changes, so
	// DOM focus alone cannot tell us to move focus to the new day.
	const keyboardMove = useRef(false);

	const today = periodic.today();
	const weekStart = periodic.weekStart();
	const { year, month } = toParts(snapshot.month);
	const weeks = useMemo(() => monthGrid(year, month, weekStart), [year, month, weekStart]);
	const activeDate = activePath ? periodic.dateOf("day", activePath) : null;
	const weekNumberFormat = weekStart === 1 ? "W" : "w";

	// Keep DOM focus on the focused day while the user navigates with the keyboard.
	useEffect(() => {
		const grid = gridRef.current;
		if (grid && (keyboardMove.current || grid.contains(document.activeElement))) {
			grid.querySelector<HTMLButtonElement>(`[data-date="${snapshot.focused}"]`)?.focus();
		}
		keyboardMove.current = false;
	}, [snapshot.focused]);

	const open = (granularity: Granularity, date: IsoDate, event: MouseEvent): void => {
		if (granularity === "day") {
			state.show(date);
		}
		activate(granularity, date, isSplitClick(event));
	};

	const onKeyDown = (event: KeyboardEvent): void => {
		const move = KEY_MOVES[event.key];
		const column = (dayOfWeek(snapshot.focused) - weekStart + 7) % 7;
		if (move !== undefined) {
			state.moveFocus(move);
		} else if (event.key === "Home") {
			state.moveFocus(-column);
		} else if (event.key === "End") {
			state.moveFocus(6 - column);
		} else if (event.key === "PageUp" || event.key === "PageDown") {
			const direction = event.key === "PageUp" ? -1 : 1;
			state.moveMonths(event.shiftKey ? direction * 12 : direction);
		} else {
			return;
		}
		keyboardMove.current = true;
		event.preventDefault();
	};

	const monthLabel = dates.format(snapshot.month, "MMMM");
	const yearLabel = dates.format(snapshot.month, "YYYY");
	const headerButton = (granularity: Granularity, text: string, label: string): ReactNode =>
		settings.notes[granularity].enabled ? (
			<button
				type="button"
				className="sbos-calendar__title-button"
				aria-label={label}
				onClick={(event) => open(granularity, snapshot.month, event)}
			>
				{text}
			</button>
		) : (
			<span>{text}</span>
		);

	return (
		<div className="sbos-calendar">
			<div className="sbos-calendar__header">
				<h3 className="sbos-calendar__title">
					{headerButton("month", monthLabel, `Open ${monthLabel} ${yearLabel} note`)}{" "}
					{headerButton("year", yearLabel, `Open ${yearLabel} note`)}
				</h3>
				<div className="sbos-calendar__nav">
					<button
						type="button"
						aria-label="Previous month"
						onClick={() => state.moveMonths(-1)}
					>
						<Icon name="chevron-left" />
					</button>
					{!embedded && (
						<button type="button" onClick={() => state.show(today)}>
							Today
						</button>
					)}
					<button
						type="button"
						aria-label="Next month"
						onClick={() => state.moveMonths(1)}
					>
						<Icon name="chevron-right" />
					</button>
					<button type="button" aria-label="Jump to date" onClick={openJumpToDate}>
						<Icon name="calendar-search" />
					</button>
				</div>
			</div>
			<table
				ref={gridRef}
				role="grid"
				aria-label={`${monthLabel} ${yearLabel}`}
				className="sbos-calendar__grid"
				onKeyDown={onKeyDown}
			>
				<thead>
					<tr>
						{settings.showWeekNumbers && (
							<th scope="col" className="sbos-calendar__week-header">
								<abbr title="Week">W</abbr>
							</th>
						)}
						{Array.from({ length: 7 }, (_, column) => {
							const day = (weekStart + column) % 7;
							return (
								<th key={day} scope="col">
									{dates.weekdayShort(day)}
								</th>
							);
						})}
					</tr>
				</thead>
				<tbody>
					{weeks.map((week) => {
						const first = week[0] ?? snapshot.month;
						const weekNumber = dates.format(first, weekNumberFormat);
						return (
							<tr key={first}>
								{settings.showWeekNumbers && (
									<th scope="row" className="sbos-calendar__week">
										{settings.notes.week.enabled ? (
											<button
												type="button"
												tabIndex={-1}
												aria-label={`Open week ${weekNumber} note`}
												className={
													index.week.has(periodic.periodOf("week", first))
														? "sbos-calendar__week-button has-note"
														: "sbos-calendar__week-button"
												}
												onClick={(event) => open("week", first, event)}
											>
												{weekNumber}
											</button>
										) : (
											weekNumber
										)}
									</th>
								)}
								{week.map((date) => (
									<Day
										key={date}
										date={date}
										label={dates.format(date, "dddd, MMMM D, YYYY")}
										inMonth={toParts(date).month === month}
										isToday={date === today}
										isActive={date === activeDate}
										isFocused={date === snapshot.focused}
										hasNote={index.day.has(date)}
										badges={badges.get(date) ?? []}
										onOpen={(event) => open("day", date, event)}
									/>
								))}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

interface DayProps {
	readonly date: IsoDate;
	readonly label: string;
	readonly inMonth: boolean;
	readonly isToday: boolean;
	readonly isActive: boolean;
	readonly isFocused: boolean;
	readonly hasNote: boolean;
	readonly badges: readonly DayBadge[];
	readonly onOpen: (event: MouseEvent) => void;
}

function Day(props: DayProps): ReactNode {
	const classes = [
		"sbos-calendar__day",
		props.inMonth ? "" : "is-other-month",
		props.isToday ? "is-today" : "",
		props.isActive ? "is-active" : "",
		props.hasNote ? "has-note" : "",
	]
		.filter(Boolean)
		.join(" ");
	const details = [props.hasNote ? "has note" : "", ...props.badges.map((badge) => badge.label)]
		.filter(Boolean)
		.join(", ");
	return (
		<td aria-selected={props.isActive}>
			<button
				type="button"
				className={classes}
				data-date={props.date}
				tabIndex={props.isFocused ? 0 : -1}
				aria-label={details ? `${props.label}, ${details}` : props.label}
				{...(props.isToday ? { "aria-current": "date" as const } : {})}
				onClick={props.onOpen}
			>
				<span className="sbos-calendar__number">{toParts(props.date).day}</span>
				<span className="sbos-calendar__marks" aria-hidden="true">
					{props.hasNote && <span className="sbos-calendar__dot" />}
					{props.badges.map((badge) => (
						<span key={badge.label} className="sbos-calendar__badge">
							{badge.text}
						</span>
					))}
				</span>
			</button>
		</td>
	);
}

import {
	useEffect,
	useMemo,
	useRef,
	type KeyboardEvent,
	type MouseEvent,
	type ReactNode,
} from "react";

import { addDays, dayOfWeek, Store, toParts, type IsoDate } from "../../../shared/kernel";
import { Icon, useStore } from "../../../shared/react";
import { LABELS, monthGrid, type Granularity } from "../../periodic";
import { ModeTabs } from "./mode-tabs";
import { decadeStart, PeriodGrid, type GridGranularity } from "./period-grid";
import { CalendarContext, type DayBadge } from "./services";

/** Weeks in the grid. The month always fills them, so the calendar does not change height. */
const GRID_WEEKS = 6;

/** Font Awesome's chevron, as the Calendar plugin draws its arrows. */
const ARROW_PATH =
	"M34.52 239.03L228.87 44.69c9.37-9.37 24.57-9.37 33.94 0l22.67 22.67c9.36 9.36 9.37 24.52.04 33.9L131.49 256l154.02 154.75c9.34 9.38 9.32 24.54-.04 33.9l-22.67 22.67c-9.37 9.37-24.57 9.37-33.94 0L34.52 272.97c-9.37-9.37-9.37-24.57 0-33.94z";

function Dot({ filled = true, className }: { filled?: boolean; className?: string }): ReactNode {
	return (
		<svg
			className={className ? `sbos-calendar__dot ${className}` : "sbos-calendar__dot"}
			viewBox="0 0 6 6"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<circle
				cx="3"
				cy="3"
				r="2"
				fill={filled ? "currentColor" : "none"}
				stroke={filled ? "none" : "currentColor"}
			/>
		</svg>
	);
}

function Arrow({
	direction,
	label,
	onClick,
}: {
	direction: "left" | "right";
	label: string;
	onClick: () => void;
}): ReactNode {
	return (
		<button
			type="button"
			className={`sbos-calendar__arrow is-${direction}`}
			aria-label={label}
			onClick={onClick}
		>
			<svg focusable="false" viewBox="0 0 320 512" xmlns="http://www.w3.org/2000/svg">
				<path fill="currentColor" d={ARROW_PATH} />
			</svg>
		</button>
	);
}

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
	const pickedMode = useStore(state.mode);
	useStore(services.tick ?? NO_TICK);
	const gridRef = useRef<HTMLTableElement>(null);
	// Set by keyboard navigation. The old day's button may unmount when the month changes, so
	// DOM focus alone cannot tell us to move focus to the new day.
	const keyboardMove = useRef(false);

	// The day planner shows only the day grid: it has its own controls for the rest.
	const mode: Granularity = embedded ? "day" : pickedMode;
	const grid: GridGranularity | null =
		mode === "month" || mode === "quarter" || mode === "year" ? mode : null;
	const offMode = mode !== "day" && !settings.notes[mode].enabled ? mode : null;
	const today = periodic.today();
	const weekStart = periodic.weekStart();
	const { year, month } = toParts(snapshot.month);
	const weeks = useMemo(() => {
		const grid = monthGrid(year, month, weekStart);
		while (grid.length < GRID_WEEKS) {
			const last = grid[grid.length - 1] ?? [];
			const first = addDays(last[0] ?? snapshot.month, 7);
			grid.push(Array.from({ length: 7 }, (_, offset) => addDays(first, offset)));
		}
		return grid;
	}, [year, month, weekStart, snapshot.month]);
	const active = activePath ? periodic.identify(activePath) : null;
	const weekNumberFormat = weekStart === 1 ? "W" : "w";
	const weekMode = mode === "week";
	const showWeekNumbers = settings.showWeekNumbers || weekMode;
	const showingToday = snapshot.month === periodic.periodOf("month", today);

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
	const quarterLabel = dates.format(snapshot.month, "[Q]Q");
	const hasNote = (granularity: Granularity): boolean =>
		index[granularity].has(periodic.periodOf(granularity, snapshot.month));
	const titlePart = (
		granularity: Granularity,
		className: string,
		text: string,
		label: string,
	): ReactNode =>
		settings.notes[granularity].enabled ? (
			<button
				type="button"
				className={`sbos-calendar__title-button ${className}${hasNote(granularity) ? " has-note" : ""}`}
				aria-label={label}
				onClick={(event) => open(granularity, snapshot.month, event)}
			>
				{text}
			</button>
		) : (
			<span className={className}>{text}</span>
		);

	const shownYear = toParts(snapshot.month).year;
	const stepMonths = grid === "year" ? 120 : grid ? 12 : 1;
	const previousLabel = grid
		? grid === "year"
			? "Previous decade"
			: "Previous year"
		: "Previous month";
	const nextLabel = grid ? (grid === "year" ? "Next decade" : "Next year") : "Next month";
	const showingCurrent = grid
		? grid === "year"
			? decadeStart(shownYear) === decadeStart(toParts(today).year)
			: shownYear === toParts(today).year
		: showingToday;
	const activeOf = (granularity: Granularity): IsoDate | null =>
		active?.granularity === granularity ? active.date : null;

	return (
		<div className="sbos-calendar">
			{!embedded && (
				<ModeTabs
					mode={mode}
					enabled={(granularity) =>
						granularity === "day" || settings.notes[granularity].enabled
					}
					onSelect={(granularity) => state.setMode(granularity)}
					onOpenCurrent={(granularity) => {
						state.setMode(granularity);
						if (settings.notes[granularity].enabled) {
							activate(granularity, today, false);
						}
					}}
				/>
			)}
			<div className="sbos-calendar__nav">
				<h3 className="sbos-calendar__title">
					{grid ? (
						<span className="sbos-calendar__year">
							{grid === "year"
								? `${decadeStart(shownYear)} – ${decadeStart(shownYear) + 9}`
								: yearLabel}
						</span>
					) : (
						<>
							{titlePart(
								"month",
								"sbos-calendar__month",
								dates.format(snapshot.month, "MMM"),
								`Open ${monthLabel} ${yearLabel} note`,
							)}
							{titlePart(
								"year",
								"sbos-calendar__year",
								yearLabel,
								`Open ${yearLabel} note`,
							)}
							{settings.notes.quarter.enabled &&
								titlePart(
									"quarter",
									"sbos-calendar__quarter",
									quarterLabel,
									`Open ${quarterLabel} ${yearLabel} note`,
								)}
						</>
					)}
				</h3>
				<div className="sbos-calendar__right-nav">
					<Arrow
						direction="left"
						label={previousLabel}
						onClick={() => state.moveMonths(-stepMonths)}
					/>
					{!embedded && (
						<button
							type="button"
							className={`sbos-calendar__reset${showingCurrent ? "" : " is-active"}`}
							aria-label="Today"
							title={showingCurrent ? undefined : "Reset to today"}
							onClick={() => state.show(today)}
						>
							<Dot />
						</button>
					)}
					<Arrow
						direction="right"
						label={nextLabel}
						onClick={() => state.moveMonths(stepMonths)}
					/>
					<button
						type="button"
						className="sbos-calendar__jump"
						aria-label="Jump to date"
						onClick={openJumpToDate}
					>
						<Icon name="calendar-search" />
					</button>
				</div>
			</div>
			{offMode ? (
				<div className="sbos-calendar__off">
					<p>{capitalize(LABELS[offMode].periodicity)} notes are off.</p>
					{services.enableGranularity ? (
						<button
							type="button"
							className="mod-cta"
							onClick={() => services.enableGranularity?.(offMode)}
						>
							Turn on {LABELS[offMode].periodicity} notes
						</button>
					) : (
						<p className="sbos-calendar__off-hint">
							Turn them on in the plugin settings.
						</p>
					)}
				</div>
			) : grid ? (
				<PeriodGrid
					granularity={grid}
					shown={snapshot.month}
					today={today}
					dates={dates}
					existing={new Set(index[grid].keys())}
					active={activeOf(grid)}
					onOpen={open}
				/>
			) : (
				<table
					ref={gridRef}
					role="grid"
					aria-label={`${monthLabel} ${yearLabel}`}
					className="sbos-calendar__grid"
					onKeyDown={onKeyDown}
				>
					<thead>
						<tr>
							{showWeekNumbers && (
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
							const weekStartDate = periodic.periodOf("week", first);
							const weekHasNote = index.week.has(weekStartDate);
							return (
								<tr key={first} className={weekMode ? "is-pickable" : undefined}>
									{showWeekNumbers && (
										<th scope="row" className="sbos-calendar__week">
											{settings.notes.week.enabled ? (
												<button
													type="button"
													tabIndex={-1}
													aria-label={`Open week ${weekNumber} note`}
													className={`sbos-calendar__week-button${weekHasNote ? " has-note" : ""}${
														active?.granularity === "week" &&
														active.date === weekStartDate
															? " is-active"
															: ""
													}`}
													onClick={(event) => open("week", first, event)}
												>
													{weekNumber}
													<span
														className="sbos-calendar__marks"
														aria-hidden="true"
													>
														{weekHasNote && <Dot />}
													</span>
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
											label={
												weekMode
													? `Week ${weekNumber}, ${dates.format(date, "dddd, MMMM D, YYYY")}`
													: dates.format(date, "dddd, MMMM D, YYYY")
											}
											inMonth={toParts(date).month === month}
											isToday={date === today}
											isActive={
												active?.granularity === "day" &&
												date === active.date
											}
											isFocused={date === snapshot.focused}
											hasNote={index.day.has(date)}
											badges={badges.get(date) ?? []}
											onOpen={(event) =>
												open(weekMode ? "week" : "day", date, event)
											}
										/>
									))}
								</tr>
							);
						})}
					</tbody>
				</table>
			)}
		</div>
	);
}

function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
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
				title={details || undefined}
				{...(props.isToday ? { "aria-current": "date" as const } : {})}
				onClick={props.onOpen}
			>
				{toParts(props.date).day}
				<span className="sbos-calendar__marks" aria-hidden="true">
					{props.hasNote && <Dot />}
					{props.badges.map((badge) => (
						<Dot key={badge.label} className="is-badge" />
					))}
				</span>
				{props.badges.map((badge) => (
					<span key={badge.label} className="sbos-visually-hidden">
						{badge.text}
					</span>
				))}
			</button>
		</td>
	);
}

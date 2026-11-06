import {
	addDays,
	addMonths,
	daysInMonth,
	fromParts,
	Store,
	toParts,
	type IsoDate,
	type ReadableStore,
} from "../../../shared/kernel";
import type { Granularity } from "../../periodic";

export interface CalendarSnapshot {
	/** First day of the displayed month. */
	readonly month: IsoDate;
	/** The day that holds keyboard focus. Always inside the displayed month. */
	readonly focused: IsoDate;
}

function firstOfMonth(date: IsoDate): IsoDate {
	const { year, month } = toParts(date);
	return fromParts(year, month, 1);
}

function snapshotFor(date: IsoDate): CalendarSnapshot {
	return { month: firstOfMonth(date), focused: date };
}

/** Which month the calendar shows and which day has focus. Shared by the view and commands. */
export class CalendarState {
	readonly #store: Store<CalendarSnapshot>;
	readonly #mode = new Store<Granularity>("day");

	constructor(today: IsoDate) {
		this.#store = new Store(snapshotFor(today));
	}

	/** Which kind of note the calendar picks: days, weeks, months, quarters or years. */
	get mode(): ReadableStore<Granularity> {
		return this.#mode;
	}

	setMode(mode: Granularity): void {
		this.#mode.set(mode);
	}

	get snapshot(): ReadableStore<CalendarSnapshot> {
		return this.#store;
	}

	/** Shows the month that contains `date` and focuses it. */
	show(date: IsoDate): void {
		this.#store.set(snapshotFor(date));
	}

	/** Moves focus by days, following it into the next or previous month. */
	moveFocus(days: number): void {
		this.show(addDays(this.#store.get().focused, days));
	}

	/** Moves by whole months, keeping the focused day of the month where it exists. */
	moveMonths(months: number): void {
		this.show(addMonths(this.#store.get().focused, months));
	}

	showMonth(year: number, month: number): void {
		const { day } = toParts(this.#store.get().focused);
		this.show(fromParts(year, month, Math.min(day, daysInMonth(year, month))));
	}
}

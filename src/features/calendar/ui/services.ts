import type { DateFormatter, IsoDate, ReadableStore } from "../../../shared/kernel";
import { createServiceContext } from "../../../shared/react";
import type { Granularity, PeriodicNotes } from "../../periodic";
import type { CalendarState } from "../application/calendar-state";

export interface DayBadge {
	/** Short text such as "3" or "2h". */
	readonly text: string;
	readonly label: string;
}

export interface CalendarServices {
	readonly periodic: PeriodicNotes;
	readonly dates: DateFormatter;
	readonly state: CalendarState;
	/** Path of the note in the active editor, to highlight its day. */
	readonly activePath: ReadableStore<string | null>;
	/** Optional extra information per day, such as planned time. */
	readonly badges?: ReadableStore<ReadonlyMap<IsoDate, readonly DayBadge[]>>;
	/** Ticks with the clock, so "today" moves at midnight. */
	readonly tick?: ReadableStore<unknown>;
	readonly activate: (granularity: Granularity, date: IsoDate, split: boolean) => void;
	readonly openJumpToDate: () => void;
}

export const CalendarContext = createServiceContext<CalendarServices>("CalendarServices");

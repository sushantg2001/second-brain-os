import { moment } from "obsidian";
import type { Moment } from "moment";

import type { WeekStart } from "../types";

const WEEKDAYS = [
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
];

export function resolveWeekStart(weekStart: WeekStart): number {
	if (weekStart === "locale") {
		return moment.localeData().firstDayOfWeek();
	}
	return WEEKDAYS.indexOf(weekStart);
}

export function getWeekdayNames(weekStart: WeekStart): string[] {
	const first = resolveWeekStart(weekStart);
	const names = moment.weekdaysShort();
	return names.slice(first).concat(names.slice(0, first));
}

export function getMonthGrid(
	displayedMonth: Moment,
	weekStart: WeekStart,
): Moment[][] {
	const first = resolveWeekStart(weekStart);
	const startOfMonth = displayedMonth.clone().startOf("month");
	const offset = (startOfMonth.day() - first + 7) % 7;
	const gridStart = startOfMonth.clone().subtract(offset, "days");

	const endOfMonth = displayedMonth.clone().endOf("month");
	const weeks: Moment[][] = [];
	const cursor = gridStart.clone();
	while (weeks.length === 0 || cursor.isSameOrBefore(endOfMonth, "day")) {
		const week: Moment[] = [];
		for (let i = 0; i < 7; i++) {
			week.push(cursor.clone());
			cursor.add(1, "day");
		}
		weeks.push(week);
	}
	return weeks;
}

export function findAdjacentDate(
	dates: Moment[],
	current: Moment,
	direction: "next" | "prev",
): Moment | null {
	const sorted = [...dates].sort((a, b) => a.valueOf() - b.valueOf());
	if (direction === "next") {
		return sorted.find((d) => d.isAfter(current)) ?? null;
	}
	return sorted.reverse().find((d) => d.isBefore(current)) ?? null;
}

import { compareDates, type IsoDate, type Minutes } from "../../../shared/kernel";

export interface DateRange {
	readonly from: IsoDate;
	readonly to: IsoDate;
}

export function inRange(date: IsoDate | null, range: DateRange): boolean {
	return (
		date !== null && compareDates(date, range.from) >= 0 && compareDates(date, range.to) <= 0
	);
}

export interface ReviewTask {
	readonly path: string;
	readonly line: number;
	readonly title: string;
	readonly done: IsoDate;
	readonly project: string | null;
}

export interface ReviewProject {
	readonly path: string;
	readonly title: string;
	readonly date: IsoDate;
}

export interface PeriodReview {
	readonly range: DateRange;
	readonly completed: readonly ReviewTask[];
	/** Clocked minutes per pillar title; "" collects time not linked to a pillar. */
	readonly clockedByPillar: ReadonlyMap<string, Minutes>;
	readonly clockedTotal: Minutes;
	readonly projectsFinished: readonly ReviewProject[];
	readonly projectsStarted: readonly ReviewProject[];
}

/** Adds minutes to a per-key total. */
export function addTo(totals: Map<string, Minutes>, key: string, minutes: Minutes): void {
	if (minutes > 0) {
		totals.set(key, (totals.get(key) ?? 0) + minutes);
	}
}

/** Pillars sorted by time, most first, with unassigned time last. */
export function sortedPillarTimes(times: ReadonlyMap<string, Minutes>): [string, Minutes][] {
	return [...times].sort(([a, minutesA], [b, minutesB]) => {
		if (a === "" || b === "") {
			return a === "" ? 1 : -1;
		}
		return minutesB - minutesA || a.localeCompare(b);
	});
}

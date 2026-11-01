import type { Clock, IsoDate } from "../../src/shared/kernel";

/** A clock that only moves when the test moves it. */
export class FixedClock implements Clock {
	constructor(
		public date: IsoDate = "2026-10-29",
		public minutes = 9 * 60,
	) {}

	today(): IsoDate {
		return this.date;
	}

	nowMinutes(): number {
		return this.minutes;
	}

	now(): number {
		const [year, month, day] = this.date.split("-").map(Number) as [number, number, number];
		return new Date(
			year,
			month - 1,
			day,
			Math.floor(this.minutes / 60),
			this.minutes % 60,
		).getTime();
	}
}

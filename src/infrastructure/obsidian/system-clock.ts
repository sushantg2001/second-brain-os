import type { Clock, IsoDate } from "../../shared/kernel";

/** Local wall-clock time. */
export class SystemClock implements Clock {
	now(): number {
		return Date.now();
	}

	today(): IsoDate {
		const now = new Date();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		const day = String(now.getDate()).padStart(2, "0");
		return `${now.getFullYear()}-${month}-${day}`;
	}

	nowMinutes(): number {
		const now = new Date();
		return now.getHours() * 60 + now.getMinutes();
	}
}

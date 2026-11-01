import type { IsoDate } from "./date";
import type { Clock } from "./ports";
import { Store } from "./store";
import type { Minutes } from "./time";

export interface NowSnapshot {
	readonly date: IsoDate;
	readonly minutes: Minutes;
}

/** The current date and minute as a store. Something outside calls `tick` on a timer. */
export class NowTicker extends Store<NowSnapshot> {
	constructor(private readonly clock: Clock) {
		super({ date: clock.today(), minutes: clock.nowMinutes() });
	}

	/** Reads the clock and notifies subscribers when the minute or date changed. */
	tick(): void {
		const date = this.clock.today();
		const minutes = this.clock.nowMinutes();
		const current = this.get();
		if (date !== current.date || minutes !== current.minutes) {
			this.set({ date, minutes });
		}
	}
}

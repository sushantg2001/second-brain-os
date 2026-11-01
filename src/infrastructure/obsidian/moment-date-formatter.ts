import type { moment as Moment } from "obsidian";

import type { DateFormatter, IsoDate } from "../../shared/kernel";

const ISO = "YYYY-MM-DD";

/** Formats and parses with the moment instance Obsidian ships, so locale settings apply. */
export class MomentDateFormatter implements DateFormatter {
	constructor(private readonly moment: typeof Moment) {}

	format(date: IsoDate, format: string): string {
		return this.moment(date, ISO).format(format);
	}

	parse(text: string, format: string): IsoDate | null {
		const parsed = this.moment(text, format, true);
		return parsed.isValid() ? parsed.format(ISO) : null;
	}

	formatNow(format: string): string {
		return this.moment().format(format);
	}

	localeWeekStart(): number {
		return this.moment.localeData().firstDayOfWeek();
	}

	weekdayShort(day: number): string {
		return this.moment.weekdaysShort()[day] ?? "";
	}
}

import type { ReactNode } from "react";

import type { DateFormatter, IsoDate } from "../../../shared/kernel";
import { toParts } from "../../../shared/kernel";

export interface WeekPickerProps {
	readonly week: readonly IsoDate[];
	readonly selected: IsoDate;
	readonly today: IsoDate;
	readonly dates: DateFormatter;
	/** Called with the clicked day. */
	readonly onPick: (date: IsoDate, split: boolean) => void;
}

/** The seven days of the selected day's week. Picking one shows its plan. */
export function WeekPicker({ week, selected, today, dates, onPick }: WeekPickerProps): ReactNode {
	const selectedMonth = toParts(selected).month;
	return (
		<div className="sbos-week-picker">
			{week.map((date) => {
				const isSelected = date === selected;
				const parts = toParts(date);
				return (
					<div key={date} className="sbos-week-picker__column">
						<span className="sbos-week-picker__weekday" aria-hidden="true">
							{dates.format(date, "ddd")}
						</span>
						<button
							type="button"
							className={`sbos-control sbos-week-picker__day${isSelected ? " is-active" : ""}`}
							aria-label={dates.format(date, "dddd, MMMM D")}
							aria-pressed={isSelected}
							onClick={(event) => onPick(date, event.ctrlKey || event.metaKey)}
						>
							<span
								className={`sbos-week-picker__number${
									parts.month === selectedMonth ? "" : " is-outside-month"
								}${date === today ? " is-today" : ""}${isSelected ? " is-selected" : ""}`}
							>
								{parts.day}
							</span>
						</button>
					</div>
				);
			})}
		</div>
	);
}

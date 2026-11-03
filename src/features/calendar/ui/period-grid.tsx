import type { MouseEvent, ReactNode } from "react";

import { fromParts, toParts, type DateFormatter, type IsoDate } from "../../../shared/kernel";
import type { Granularity } from "../../periodic";

export type GridGranularity = "month" | "quarter" | "year";

interface Cell {
	readonly date: IsoDate;
	readonly label: string;
	readonly hint?: string;
	readonly outside?: boolean;
}

export interface PeriodGridProps {
	readonly granularity: GridGranularity;
	/** Any date in the year (or decade) on show. */
	readonly shown: IsoDate;
	readonly today: IsoDate;
	readonly dates: DateFormatter;
	/** Period starts that already have a note. */
	readonly existing: ReadonlySet<IsoDate>;
	/** Period start of the note open in the editor, if it is of this granularity. */
	readonly active: IsoDate | null;
	readonly onOpen: (granularity: Granularity, date: IsoDate, event: MouseEvent) => void;
}

/** First year of the decade that holds `year`, as the year picker shows it. */
export function decadeStart(year: number): number {
	return Math.floor(year / 10) * 10;
}

function cellsFor(granularity: GridGranularity, shown: IsoDate, dates: DateFormatter): Cell[] {
	const { year } = toParts(shown);
	if (granularity === "month") {
		return Array.from({ length: 12 }, (_, index) => {
			const date = fromParts(year, index + 1, 1);
			return { date, label: dates.format(date, "MMM") };
		});
	}
	if (granularity === "quarter") {
		return Array.from({ length: 4 }, (_, index) => {
			const date = fromParts(year, index * 3 + 1, 1);
			const last = fromParts(year, index * 3 + 3, 1);
			return {
				date,
				label: `Q${index + 1}`,
				hint: `${dates.format(date, "MMM")} – ${dates.format(last, "MMM")}`,
			};
		});
	}
	const first = decadeStart(year) - 1;
	return Array.from({ length: 12 }, (_, index) => ({
		date: fromParts(first + index, 1, 1),
		label: String(first + index),
		outside: index === 0 || index === 11,
	}));
}

/** The months of a year, its quarters, or the years of a decade, as buttons that open notes. */
export function PeriodGrid(props: PeriodGridProps): ReactNode {
	const { granularity, today, existing, active } = props;
	const cells = cellsFor(granularity, props.shown, props.dates);
	const current = (date: IsoDate): boolean => {
		const a = toParts(date);
		const b = toParts(today);
		if (granularity === "year") {
			return a.year === b.year;
		}
		if (granularity === "month") {
			return a.year === b.year && a.month === b.month;
		}
		return a.year === b.year && Math.ceil(a.month / 3) === Math.ceil(b.month / 3);
	};
	return (
		<div
			className={`sbos-period-grid is-${granularity}`}
			role="group"
			aria-label={`Pick a ${granularity}`}
		>
			{cells.map((cell) => {
				const classes = [
					"sbos-period-grid__cell",
					cell.outside ? "is-other-month" : "",
					current(cell.date) ? "is-today" : "",
					active === cell.date ? "is-active" : "",
					existing.has(cell.date) ? "has-note" : "",
				]
					.filter(Boolean)
					.join(" ");
				const name = cell.hint ? `${cell.label} ${toParts(cell.date).year}` : cell.label;
				return (
					<button
						key={cell.date}
						type="button"
						className={classes}
						aria-label={`${name}${existing.has(cell.date) ? ", has note" : ""}`}
						aria-current={current(cell.date) ? "date" : undefined}
						onClick={(event) => props.onOpen(granularity, cell.date, event)}
					>
						<span className="sbos-period-grid__label">{cell.label}</span>
						{cell.hint && <span className="sbos-period-grid__hint">{cell.hint}</span>}
						<span className="sbos-calendar__marks" aria-hidden="true">
							{existing.has(cell.date) && (
								<svg
									className="sbos-calendar__dot"
									viewBox="0 0 6 6"
									xmlns="http://www.w3.org/2000/svg"
								>
									<circle cx="3" cy="3" r="2" fill="currentColor" />
								</svg>
							)}
						</span>
					</button>
				);
			})}
		</div>
	);
}

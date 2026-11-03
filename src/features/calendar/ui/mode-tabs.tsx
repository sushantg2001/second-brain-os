import type { ReactNode } from "react";

import { GRANULARITIES, LABELS, type Granularity } from "../../periodic";

const TAB_LABELS: Readonly<Record<Granularity, string>> = {
	day: "Day",
	week: "Week",
	month: "Month",
	quarter: "Quarter",
	year: "Year",
};

export interface ModeTabsProps {
	readonly mode: Granularity;
	readonly enabled: (granularity: Granularity) => boolean;
	readonly onSelect: (granularity: Granularity) => void;
	/** Double-click: open the note for the current period. */
	readonly onOpenCurrent: (granularity: Granularity) => void;
}

/** Day, week, month, quarter and year tabs. Tabs for notes that are off stay visible. */
export function ModeTabs(props: ModeTabsProps): ReactNode {
	return (
		<div className="sbos-calendar__tabs" role="tablist" aria-label="Kind of note">
			{GRANULARITIES.map((granularity) => (
				<button
					key={granularity}
					type="button"
					role="tab"
					className={`sbos-calendar__tab${props.enabled(granularity) ? "" : " is-off"}`}
					aria-selected={props.mode === granularity}
					title={`${TAB_LABELS[granularity]} notes. Double-click to open ${LABELS[granularity].noun === "day" ? "today's" : `this ${LABELS[granularity].noun}'s`} note.`}
					onClick={() => props.onSelect(granularity)}
					onDoubleClick={() => props.onOpenCurrent(granularity)}
				>
					{TAB_LABELS[granularity]}
				</button>
			))}
		</div>
	);
}

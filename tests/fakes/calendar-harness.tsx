import { render } from "@testing-library/react";

import {
	Calendar,
	CalendarContext,
	CalendarState,
	type CalendarServices,
	type DayBadge,
} from "../../src/features/calendar";
import type { Granularity } from "../../src/features/periodic";
import { Store, type IsoDate } from "../../src/shared/kernel";
import { createPeriodicHarness, dates, type SettingsPatch } from "./periodic-harness";

export interface ActivateCall {
	readonly granularity: Granularity;
	readonly date: IsoDate;
	readonly split: boolean;
}

export async function renderCalendar(
	options: {
		files?: Record<string, string>;
		settings?: SettingsPatch;
		today?: string;
		activePath?: string;
	} = {},
) {
	const harness = await createPeriodicHarness(options);
	const calls: ActivateCall[] = [];
	let jumps = 0;
	const badges = new Store<ReadonlyMap<IsoDate, readonly DayBadge[]>>(new Map());
	const services: CalendarServices = {
		periodic: harness.periodic,
		dates,
		state: new CalendarState(harness.periodic.today()),
		activePath: new Store<string | null>(options.activePath ?? null),
		badges,
		activate: (granularity, date, split) => calls.push({ granularity, date, split }),
		openJumpToDate: () => {
			jumps++;
		},
	};
	const view = render(
		<CalendarContext.Provider value={services}>
			<Calendar />
		</CalendarContext.Provider>,
	);
	return { ...harness, ...view, services, calls, badges, jumps: () => jumps };
}

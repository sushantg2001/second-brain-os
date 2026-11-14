export {
	Clocks,
	taskTitle,
	type ClockedRange,
	type ClocksDeps,
	type RunningClock,
} from "./application/clocks";
export {
	datesOf,
	entryMinutes,
	formatClockEntry,
	formatClockValue,
	formatMoment,
	minutesBetween,
	minutesOnDate,
	momentNow,
	parseClockValue,
	rangeOnDate,
	type ClockEntry,
	type Moment,
} from "./domain/clock-entry";
export {
	clocksOf,
	closeClockIn,
	closedClockValue,
	findClockLine,
	openClockLine,
	previewClosedClock,
	type ClockLine,
	type ClockSpot,
} from "./domain/task-clocks";
export { clockStatusText, registerClocks, taskAtLine, type ClocksModuleDeps } from "./ui/module";

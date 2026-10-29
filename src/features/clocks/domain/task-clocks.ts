import { err, ok, type Result, type YamlCodec } from "../../../shared/kernel";
import { parseListLine, type ListItem, type Task } from "../../tasks";
import { formatClockEntry, parseClockEntry, type ClockEntry, type Moment } from "./clock-entry";
import {
	canHoldLog,
	formatLogTime,
	isRecordEntry,
	logOf,
	parseLogTime,
	withLog,
	yamlBlock,
} from "./planner-log";

/** Where a clock entry is written. */
export type ClockSource =
	| { readonly kind: "yaml"; readonly index: number }
	/** The older `[clock::start--end]` list item, read for compatibility. */
	| { readonly kind: "legacy"; readonly line: number; readonly raw: string };

export interface TaskClock extends ClockEntry {
	readonly source: ClockSource;
	/** The line to show for this entry: the yaml block or the legacy item. */
	readonly line: number;
}

function yamlClocks(task: Task): TaskClock[] {
	const props = task.props;
	if (!props?.valid) {
		return [];
	}
	return logOf(props.data).flatMap((entry, index) => {
		if (!isRecordEntry(entry)) {
			return [];
		}
		const start = parseLogTime(entry.start);
		const end = entry.end === undefined || entry.end === null ? null : parseLogTime(entry.end);
		if (!start || (entry.end !== undefined && entry.end !== null && !end)) {
			return [];
		}
		return [{ start, end, source: { kind: "yaml" as const, index }, line: props.startLine }];
	});
}

function legacyClocks(task: Task): TaskClock[] {
	return task.children.flatMap((child: ListItem) => {
		const entry = parseClockEntry(child.text);
		return entry
			? [
					{
						...entry,
						source: { kind: "legacy" as const, line: child.line, raw: child.raw },
						line: child.line,
					},
				]
			: [];
	});
}

/** Every clock entry of a task: the yaml log first, then legacy items. */
export function clocksOf(task: Task): TaskClock[] {
	return [...yamlClocks(task), ...legacyClocks(task)];
}

/** Where a task's yaml block goes: the existing one's indentation, or two spaces past the task. */
function blockIndent(task: Task): string {
	return task.props?.indent ?? `${parseListLine(task.raw)?.indent ?? ""}  `;
}

function unreadable(): Error {
	return new Error("The task's yaml block could not be read. Fix it, then try again.");
}

/** Writes new block lines over the task's block, or inserts them after the task line. */
function writeBlock(lines: string[], task: Task, block: readonly string[]): void {
	if (task.props) {
		lines.splice(task.props.startLine, task.props.endLine - task.props.startLine + 1, ...block);
	} else {
		lines.splice(task.line + 1, 0, ...block);
	}
}

/** Adds an open entry to the task's log. The task must have no running clock. */
export function startClock(
	lines: readonly string[],
	task: Task,
	now: Moment,
	yaml: YamlCodec,
): Result<string[], Error> {
	if (clocksOf(task).some((clock) => clock.end === null)) {
		return err(new Error("A clock is already running on this task."));
	}
	if (task.props && (!task.props.valid || !canHoldLog(task.props.data))) {
		return err(unreadable());
	}
	const data = task.props?.data ?? null;
	const next = [...lines];
	writeBlock(
		next,
		task,
		yamlBlock(
			blockIndent(task),
			withLog(data, [...logOf(data), { start: formatLogTime(now) }]),
			yaml,
		),
	);
	return ok(next);
}

/** Closes the task's running entries at `now`, in the yaml log and in legacy items. */
export function stopClock(
	lines: readonly string[],
	task: Task,
	now: Moment,
	yaml: YamlCodec,
): Result<string[], Error> {
	const running = clocksOf(task).filter((clock) => clock.end === null);
	if (running.length === 0) {
		return err(new Error("That clock is not running."));
	}
	const next = [...lines];
	// Legacy items sit below the yaml block, so closing them first keeps block lines in place.
	for (const clock of running) {
		if (clock.source.kind === "legacy") {
			next[clock.source.line] = closeClockLine(clock.source.raw, now) ?? clock.source.raw;
		}
	}
	if (running.some((clock) => clock.source.kind === "yaml") && task.props) {
		const log = logOf(task.props.data).map((entry) =>
			isRecordEntry(entry) &&
			(entry.end === undefined || entry.end === null) &&
			parseLogTime(entry.start)
				? { ...entry, end: formatLogTime(now) }
				: entry,
		);
		writeBlock(next, task, yamlBlock(blockIndent(task), withLog(task.props.data, log), yaml));
	}
	return ok(next);
}

/** Moves legacy `[clock::]` items into the task's yaml log. Null when there is nothing to move. */
export function convertLegacy(
	lines: readonly string[],
	task: Task,
	yaml: YamlCodec,
): Result<string[], Error> | null {
	const legacy = legacyClocks(task);
	if (legacy.length === 0) {
		return null;
	}
	if (task.props && (!task.props.valid || !canHoldLog(task.props.data))) {
		return err(unreadable());
	}
	const data = task.props?.data ?? null;
	const moved = legacy.map((clock) => ({
		start: formatLogTime(clock.start),
		...(clock.end ? { end: formatLogTime(clock.end) } : {}),
	}));
	const next = [...lines];
	for (const clock of [...legacy].sort((a, b) => b.line - a.line)) {
		next.splice(clock.line, 1);
	}
	writeBlock(
		next,
		task,
		yamlBlock(blockIndent(task), withLog(data, [...logOf(data), ...moved]), yaml),
	);
	return ok(next);
}

/** What stopping a clock adds, for previews: "start … → end …". */
export function describeStop(clock: ClockEntry, now: Moment): { before: string; after: string } {
	return {
		before: `start: ${formatLogTime(clock.start)}`,
		after: `start: ${formatLogTime(clock.start)}, end: ${formatLogTime(now)}`,
	};
}

/** Closes a legacy running clock line at `end`, keeping its indentation and any text around it. */
export function closeClockLine(raw: string, end: Moment): string | null {
	const entry = parseClockEntry(raw);
	if (!entry || entry.end !== null) {
		return null;
	}
	return raw.replace(/\[clock::[^\]]*\]/i, formatClockEntry({ start: entry.start, end }));
}

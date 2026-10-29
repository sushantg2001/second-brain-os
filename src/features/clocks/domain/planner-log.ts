import { formatTime, isIsoDate, type YamlCodec } from "../../../shared/kernel";
import type { Moment } from "./clock-entry";

/**
 * Day Planner 0.29+ keeps clocks in a yaml block under the task:
 *
 *     - [ ] Write the spec
 *       ```yaml
 *       planner:
 *         log:
 *           - start: 2026-10-29 09:05:00
 *             end: 2026-10-29 09:50:00
 *       ```
 */
const LOG_TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;

type Data = Record<string, unknown>;

function isRecord(value: unknown): value is Data {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		!(value instanceof Date)
	);
}

/** Reads "2026-10-29 09:05:00" (or a YAML timestamp, which has no zone and so reads as UTC). */
export function parseLogTime(value: unknown): Moment | null {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return {
			date: value.toISOString().slice(0, 10),
			minutes: value.getUTCHours() * 60 + value.getUTCMinutes(),
		};
	}
	const match = typeof value === "string" ? LOG_TIME.exec(value.trim()) : null;
	if (!match) {
		return null;
	}
	const [date = "", hours = 0, minutes = 0] = [match[1], Number(match[2]), Number(match[3])];
	return isIsoDate(date) && hours < 24 && minutes < 60
		? { date, minutes: hours * 60 + minutes }
		: null;
}

export function formatLogTime(value: Moment): string {
	return `${value.date} ${formatTime(value.minutes)}:00`;
}

/** The `planner.log` list, or an empty list. Entries are kept as written. */
export function logOf(data: unknown): unknown[] {
	const planner = isRecord(data) ? data.planner : undefined;
	const log = isRecord(planner) ? planner.log : undefined;
	return Array.isArray(log) ? log : [];
}

/** Can a yaml block's data hold a planner log? Empty blocks and mappings can. */
export function canHoldLog(data: unknown): boolean {
	return data === null || data === undefined || isRecord(data);
}

/** Returns data with `planner.log` replaced, keeping every other key. */
export function withLog(data: unknown, log: readonly unknown[]): Data {
	const base = isRecord(data) ? data : {};
	const planner = isRecord(base.planner) ? base.planner : {};
	return { ...base, planner: { ...planner, log: [...log] } };
}

/** The fenced block lines for some data, indented to sit under a task. */
export function yamlBlock(indent: string, data: unknown, yaml: YamlCodec): string[] {
	const body = yaml
		.stringify(data)
		.replace(/\n$/, "")
		.split("\n")
		.map((line) => `${indent}${line}`);
	return [`${indent}\`\`\`yaml`, ...body, `${indent}\`\`\``];
}

export function isRecordEntry(value: unknown): value is Data {
	return isRecord(value);
}

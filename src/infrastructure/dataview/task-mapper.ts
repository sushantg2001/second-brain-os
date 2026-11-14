import { isIsoDate, type IsoDate } from "../../shared/kernel";
import { parseTimeBlock, stateOf, type Task, type TaskFields } from "../../features/tasks";

import type { DataviewDate, DataviewListItem } from "./api";

/** A field holds one value, or an array when it was written more than once. */
function valuesOf(value: unknown): unknown[] {
	return value === undefined || value === null ? [] : [value].flat();
}

/** Dataview reads a date as a Luxon DateTime, and a date it cannot read stays a string. */
function dateOf(value: unknown): IsoDate | null {
	const first = valuesOf(value)[0];
	const text =
		typeof first === "string"
			? first.slice(0, 10)
			: typeof (first as Partial<DataviewDate> | undefined)?.toISODate === "function"
				? (first as DataviewDate).toISODate()
				: null;
	return text && isIsoDate(text) ? text : null;
}

function fieldsOf(item: DataviewListItem): TaskFields {
	return {
		scheduled: dateOf(item["scheduled"]),
		due: dateOf(item["due"]),
		start: dateOf(item["start"]),
		done: dateOf(item["completion"]),
		links: item.outlinks.map((link) => link.path),
	};
}

/** The `clock` fields of an item, which can sit on any line of it. */
function clocksOf(item: DataviewListItem): string[] {
	return valuesOf(item["clock"])
		.filter((value): value is string => typeof value === "string")
		.map((value) => value.trim());
}

/** An item's own clocks, and those of plain list items under it (a task's own clocks). */
function ownClocksOf(item: DataviewListItem): string[] {
	return [
		...clocksOf(item),
		...item.children.filter((child) => !child.task).flatMap(ownClocksOf),
	];
}

function lastLineOf(item: DataviewListItem): number {
	return Math.max(item.line + item.lineCount - 1, ...item.children.map(lastLineOf));
}

/** Every task in a note, from the list items Dataview indexed for it. */
export function tasksFromLists(path: string, lists: readonly DataviewListItem[]): Task[] {
	const byLine = new Map(lists.map((item) => [item.line, item]));
	const parentTaskOf = (item: DataviewListItem): number | null => {
		for (let up = item.parent; up !== undefined; up = byLine.get(up)?.parent) {
			const parent = byLine.get(up);
			if (!parent) {
				return null;
			}
			if (parent.task) {
				return parent.line;
			}
		}
		return null;
	};
	return lists.flatMap((entry) => {
		if (!entry.task) {
			return [];
		}
		// Lines after the first one belong to the task, so the title is the first line only.
		const text = entry.text.split("\n", 1)[0] ?? "";
		return [
			{
				path,
				line: entry.line,
				lineCount: entry.lineCount,
				lastLine: lastLineOf(entry),
				text,
				status: entry.status ?? " ",
				state: stateOf(entry.status ?? " "),
				fields: fieldsOf(entry),
				block: parseTimeBlock(text),
				clocks: ownClocksOf(entry),
				parentLine: parentTaskOf(entry),
				heading: entry.section.subpath ?? null,
			},
		];
	});
}

import { indentWidth, parseListLine } from "./list-line";
import { parseFields, type TaskFields } from "./fields";
import { stateOf, type TaskState } from "./status";
import { parseTimeBlock, type TimeBlock } from "./time-block";

export interface ListItem {
	/** 0-based line number in the note. */
	readonly line: number;
	/** The full line as written, used to check a line is unchanged before editing it. */
	readonly raw: string;
	readonly text: string;
}

export interface Task extends ListItem {
	readonly path: string;
	readonly status: string;
	readonly state: TaskState;
	readonly fields: TaskFields;
	readonly block: TimeBlock | null;
	/**
	 * Nested list items, tasks and indented continuation lines (such as a clock line written
	 * without a bullet) directly or indirectly under this task.
	 */
	readonly children: readonly ListItem[];
	/** The lines of `children` that belong to this task itself, not to a task nested under it. */
	readonly own: readonly ListItem[];
	/** Line of the closest task this one is nested under, or null. */
	readonly parentLine: number | null;
	/** The closest heading above the task, or null. */
	readonly heading: string | null;
}

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const LEADING_SPACE = /^[ \t]*/;

type OpenTask = Task & { children: ListItem[]; own: ListItem[] };

/** Length of the front matter block in lines, or 0. */
export function frontmatterLines(lines: readonly string[]): number {
	if (lines[0]?.trim() !== "---") {
		return 0;
	}
	const end = lines.findIndex(
		(line, index) => index > 0 && (line.trim() === "---" || line.trim() === "..."),
	);
	return end === -1 ? 0 : end + 1;
}

/** Every task in a note, skipping front matter and code blocks. */
export function parseTasks(path: string, content: string): Task[] {
	const lines = content.split(/\r?\n/);
	const tasks: Task[] = [];
	const open: { task: OpenTask; width: number }[] = [];
	let fence: string | null = null;
	let heading: string | null = null;

	for (let index = frontmatterLines(lines); index < lines.length; index++) {
		const raw = lines[index] ?? "";
		const fenceMatch = FENCE.exec(raw);
		if (fenceMatch) {
			const marker = fenceMatch[1] ?? "";
			fence = fence === null ? marker : fence === marker ? null : fence;
			continue;
		}
		if (fence !== null) {
			continue;
		}
		const headingMatch = HEADING.exec(raw);
		if (headingMatch) {
			heading = headingMatch[2] ?? null;
			open.length = 0;
			continue;
		}
		const item = parseListLine(raw);
		if (!item) {
			if (raw.trim() === "") {
				continue;
			}
			// Text indented deeper than a task continues that task, like a clock line written
			// under it. Anything else ends the open list.
			const width = indentWidth(LEADING_SPACE.exec(raw)?.[0] ?? "");
			const hosts = open.filter((entry) => entry.width < width);
			open.length = hosts.length;
			const host = hosts.at(-1);
			if (host) {
				const continuation: ListItem = { line: index, raw, text: raw.trim() };
				for (const entry of hosts) {
					entry.task.children.push(continuation);
				}
				host.task.own.push(continuation);
			}
			continue;
		}
		const width = indentWidth(item.indent);
		while (open.length > 0 && (open.at(-1)?.width ?? 0) >= width) {
			open.pop();
		}
		const listItem: ListItem = { line: index, raw, text: item.text };
		for (const ancestor of open) {
			ancestor.task.children.push(listItem);
		}
		const parent = open.at(-1)?.task;
		parent?.own.push(listItem);
		if (item.status !== null) {
			const task: OpenTask = {
				...listItem,
				path,
				status: item.status,
				state: stateOf(item.status),
				fields: parseFields(item.text),
				block: parseTimeBlock(item.text),
				children: [],
				own: [],
				parentLine: parent?.line ?? null,
				heading,
			};
			tasks.push(task);
			open.push({ task, width });
		}
	}
	return tasks;
}

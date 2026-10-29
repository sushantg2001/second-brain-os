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

/** A fenced yaml block directly under a task, as Day Planner 0.29 writes it. */
export interface TaskProps {
	/** Parsed YAML, or null when it could not be read. */
	readonly data: unknown;
	readonly valid: boolean;
	/** Lines of the opening and closing fences. */
	readonly startLine: number;
	readonly endLine: number;
	/** Indentation of the fence lines. */
	readonly indent: string;
}

export interface Task extends ListItem {
	readonly path: string;
	readonly status: string;
	readonly state: TaskState;
	readonly fields: TaskFields;
	readonly block: TimeBlock | null;
	/** Nested list items and tasks directly or indirectly under this task. */
	readonly children: readonly ListItem[];
	/** The closest heading above the task, or null. */
	readonly heading: string | null;
	/** The yaml block on the line after the task, or null. */
	readonly props: TaskProps | null;
}

const FENCE = /^\s*(```|~~~)/;
const YAML_FENCE = /^(\s*)```ya?ml\s*$/;

/** Reads a yaml block that starts on `start`, or null. */
function readProps(
	lines: readonly string[],
	start: number,
	parseYaml: ((text: string) => unknown) | undefined,
): TaskProps | null {
	const opening = YAML_FENCE.exec(lines[start] ?? "");
	if (!opening) {
		return null;
	}
	const indent = opening[1] ?? "";
	const end = lines.findIndex(
		(line, index) => index > start && line.trimStart().startsWith("```"),
	);
	if (end === -1) {
		return null;
	}
	const text = lines
		.slice(start + 1, end)
		.map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line.trimStart()))
		.join("\n");
	if (!parseYaml) {
		return { data: null, valid: false, startLine: start, endLine: end, indent };
	}
	try {
		return {
			data: parseYaml(text) ?? null,
			valid: true,
			startLine: start,
			endLine: end,
			indent,
		};
	} catch {
		return { data: null, valid: false, startLine: start, endLine: end, indent };
	}
}

/** The last line that belongs to a task: its yaml block or its deepest nested item. */
export function taskEndLine(task: Task): number {
	return Math.max(task.line, task.props?.endLine ?? -1, task.children.at(-1)?.line ?? -1);
}
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

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

/**
 * Every task in a note, skipping front matter and code blocks. With `parseYaml`, a yaml block on
 * the line after a task is read into `props`.
 */
export function parseTasks(
	path: string,
	content: string,
	parseYaml?: (text: string) => unknown,
): Task[] {
	const lines = content.split(/\r?\n/);
	const tasks: Task[] = [];
	const open: { task: Task & { children: ListItem[] }; width: number }[] = [];
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
			// A non-list, non-blank line ends any open list.
			if (raw.trim() !== "") {
				open.length = 0;
			}
			continue;
		}
		const width = indentWidth(item.indent);
		while (open.length > 0 && (open.at(-1)?.width ?? 0) >= width) {
			open.pop();
		}
		const listItem: ListItem = { line: index, raw, text: item.text };
		for (const parent of open) {
			parent.task.children.push(listItem);
		}
		if (item.status !== null) {
			const task = {
				...listItem,
				path,
				status: item.status,
				state: stateOf(item.status),
				fields: parseFields(item.text),
				block: parseTimeBlock(item.text),
				children: [] as ListItem[],
				heading,
				props: readProps(lines, index + 1, parseYaml),
			};
			tasks.push(task);
			open.push({ task, width });
		}
	}
	return tasks;
}

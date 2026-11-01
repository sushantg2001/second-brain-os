/** One Markdown list line, split into its parts so it can be rebuilt byte for byte. */
export interface ListLine {
	/** Leading whitespace as written. */
	readonly indent: string;
	/** "-", "*", "+", "1." or "1)". */
	readonly marker: string;
	/** Checkbox character for tasks (" ", "x", "/", ...), null for plain list items. */
	readonly status: string | null;
	/** Everything after the marker and checkbox. */
	readonly text: string;
}

const LIST = /^([ \t]*)([-*+]|\d+[.)])[ \t]+(?:\[(.)\][ \t]+)?(.*)$/;
const EMPTY_TASK = /^([ \t]*)([-*+]|\d+[.)])[ \t]+\[(.)\]$/;

export function parseListLine(line: string): ListLine | null {
	const empty = EMPTY_TASK.exec(line);
	if (empty) {
		return {
			indent: empty[1] ?? "",
			marker: empty[2] ?? "-",
			status: empty[3] ?? " ",
			text: "",
		};
	}
	const match = LIST.exec(line);
	if (!match) {
		return null;
	}
	return {
		indent: match[1] ?? "",
		marker: match[2] ?? "-",
		status: match[3] ?? null,
		text: match[4] ?? "",
	};
}

export function formatListLine(line: ListLine): string {
	const checkbox = line.status === null ? "" : `[${line.status}] `;
	return `${line.indent}${line.marker} ${checkbox}${line.text}`.trimEnd();
}

/** Indent width with tabs counted as four spaces. */
export function indentWidth(indent: string): number {
	let width = 0;
	for (const char of indent) {
		width += char === "\t" ? 4 : 1;
	}
	return width;
}

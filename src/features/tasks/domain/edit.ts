import { err, ok, type Result } from "../../../shared/kernel";
import { frontmatterLines } from "./parse-note";

/** A pointer to a line, with the text it had when it was read. */
export interface LineRef {
	readonly line: number;
	readonly raw: string;
}

export class StaleLineError extends Error {
	override readonly name = "StaleLineError";

	constructor() {
		super("The note changed since it was read. Try again.");
	}
}

function newline(content: string): string {
	return content.includes("\r\n") ? "\r\n" : "\n";
}

/**
 * Finds where a line is now: at its old index when unchanged, otherwise the only other line with
 * the same text. Fails when it is gone or ambiguous, so an edit never lands on the wrong line.
 */
export function locate(lines: readonly string[], ref: LineRef): Result<number, StaleLineError> {
	if (lines[ref.line] === ref.raw) {
		return ok(ref.line);
	}
	const matches = lines.flatMap((line, index) => (line === ref.raw ? [index] : []));
	return matches.length === 1 ? ok(matches[0] ?? 0) : err(new StaleLineError());
}

/** Replaces one line with zero or more lines. */
export function replaceLine(
	content: string,
	ref: LineRef,
	replacement: string | readonly string[],
): Result<string, StaleLineError> {
	const eol = newline(content);
	const lines = content.split(/\r?\n/);
	const index = locate(lines, ref);
	if (!index.ok) {
		return index;
	}
	lines.splice(
		index.value,
		1,
		...(typeof replacement === "string" ? [replacement] : replacement),
	);
	return ok(lines.join(eol));
}

/** Inserts lines directly after a referenced line. */
export function insertAfter(
	content: string,
	ref: LineRef,
	inserted: readonly string[],
): Result<string, StaleLineError> {
	const eol = newline(content);
	const lines = content.split(/\r?\n/);
	const index = locate(lines, ref);
	if (!index.ok) {
		return index;
	}
	lines.splice(index.value + 1, 0, ...inserted);
	return ok(lines.join(eol));
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

/**
 * Adds lines to the end of the section under `heading` (any level, matched case-insensitively),
 * after its last non-blank line. Creates the heading at the end of the note when missing.
 */
export function appendToSection(
	content: string,
	heading: string,
	added: readonly string[],
): string {
	const eol = newline(content);
	const lines = content === "" ? [] : content.split(/\r?\n/);
	const wanted = heading.trim().toLowerCase();
	const start = lines.findIndex(
		(line, index) =>
			index >= frontmatterLines(lines) &&
			HEADING.exec(line)?.[2]?.trim().toLowerCase() === wanted,
	);
	if (start === -1) {
		while (lines.length > 0 && lines.at(-1)?.trim() === "") {
			lines.pop();
		}
		const prefix = lines.length > 0 ? [...lines, ""] : [];
		return [...prefix, `## ${heading.trim()}`, ...added, ""].join(eol);
	}
	const level = HEADING.exec(lines[start] ?? "")?.[1]?.length ?? 2;
	let end = lines.length;
	for (let index = start + 1; index < lines.length; index++) {
		const match = HEADING.exec(lines[index] ?? "");
		if (match && (match[1]?.length ?? 0) <= level) {
			end = index;
			break;
		}
	}
	let insertAt = end;
	while (insertAt > start + 1 && (lines[insertAt - 1] ?? "").trim() === "") {
		insertAt--;
	}
	lines.splice(insertAt, 0, ...added);
	return lines.join(eol);
}

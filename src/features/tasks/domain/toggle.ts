import type { IsoDate } from "../../../shared/kernel";
import { formatListLine, parseListLine } from "./list-line";
import { stateOf } from "./status";

const DONE_DATE = /\s*✅️?\s*\d{4}-\d{2}-\d{2}/gu;

/**
 * Marks a task line done (adding a ✅ date) or, when it is done, back to todo. Used when the Tasks
 * plugin's API is unavailable. Returns null for lines that are not tasks.
 */
export function toggleDoneLine(raw: string, today: IsoDate): string | null {
	const line = parseListLine(raw);
	if (!line || line.status === null) {
		return null;
	}
	if (stateOf(line.status) === "done") {
		return formatListLine({ ...line, status: " ", text: line.text.replace(DONE_DATE, "") });
	}
	const text = line.text.replace(DONE_DATE, "");
	return formatListLine({ ...line, status: "x", text: `${text} ✅ ${today}`.trim() });
}

/** Sets the checkbox character, leaving the rest of the line alone. */
export function setStatusLine(raw: string, status: string): string | null {
	const line = parseListLine(raw);
	return line && line.status !== null ? formatListLine({ ...line, status }) : null;
}

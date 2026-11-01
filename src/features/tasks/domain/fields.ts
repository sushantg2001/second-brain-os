import { isIsoDate, type IsoDate } from "../../../shared/kernel";

export interface TaskFields {
	readonly scheduled: IsoDate | null;
	readonly due: IsoDate | null;
	readonly start: IsoDate | null;
	readonly done: IsoDate | null;
	readonly tags: readonly string[];
	/** Wikilink targets as written, without brackets or aliases. */
	readonly links: readonly string[];
}

const DATE = "(\\d{4}-\\d{2}-\\d{2})";

/** Tasks plugin emoji and Dataview inline field for each date. */
const DATE_FIELDS = {
	scheduled: ["⏳", "scheduled"],
	due: ["📅", "due"],
	start: ["🛫", "start"],
	done: ["✅", "completion"],
} as const;

function findDate(text: string, emoji: string, field: string): IsoDate | null {
	const emojiMatch = new RegExp(`${emoji}\\uFE0F?\\s*${DATE}`, "u").exec(text);
	const fieldMatch = new RegExp(`[[(]${field}::\\s*${DATE}\\s*[\\])]`, "i").exec(text);
	const value = emojiMatch?.[1] ?? fieldMatch?.[1] ?? null;
	return value && isIsoDate(value) ? value : null;
}

export function parseFields(text: string): TaskFields {
	const tags = [...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu)]
		.map((match) => match[1] ?? "")
		.filter((tag) => !/^\d+$/.test(tag));
	const links = [...text.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)].map((match) =>
		(match[1] ?? "").trim(),
	);
	return {
		scheduled: findDate(text, DATE_FIELDS.scheduled[0], DATE_FIELDS.scheduled[1]),
		due: findDate(text, DATE_FIELDS.due[0], DATE_FIELDS.due[1]),
		start: findDate(text, DATE_FIELDS.start[0], DATE_FIELDS.start[1]),
		done: findDate(text, DATE_FIELDS.done[0], DATE_FIELDS.done[1]),
		tags,
		links,
	};
}

/** Text for display: the task without Tasks emoji fields, inline fields or block ids. */
export function displayText(text: string): string {
	return text
		.replace(/\s*[⏳📅🛫✅➕❌]️?\s*\d{4}-\d{2}-\d{2}/gu, "")
		.replace(/\s*[⏫🔼🔽🔺⏬]️?/gu, "")
		.replace(/\s*🔁️?[^⏳📅🛫✅➕❌⏫🔼🔽🔺⏬]*/gu, "")
		.replace(/\s*[[(][\w-]+::[^\])]*[\])]/g, "")
		.replace(/\s*\^[\w-]+$/, "")
		.trim();
}

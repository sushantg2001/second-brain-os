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

const FIELD_START = /[[(][\w-]+::/y;

/**
 * Removes Dataview inline fields, `[key:: value]` and `(key:: value)`, with the space before them.
 * A value can hold brackets of its own, such as a link in `[reference::[[Note|Alias]]]`, so the
 * field ends at the bracket that closes the one it opened, not at the first one.
 */
function withoutInlineFields(text: string): string {
	let kept = "";
	let at = 0;
	while (at < text.length) {
		const open = text[at];
		if (open === "[" || open === "(") {
			FIELD_START.lastIndex = at;
			const close = open === "[" ? "]" : ")";
			if (FIELD_START.test(text)) {
				let depth = 0;
				let end = at;
				for (; end < text.length; end++) {
					if (text[end] === open) {
						depth++;
					} else if (text[end] === close && --depth === 0) {
						break;
					}
				}
				// With no closing bracket it is just text, so it is kept.
				if (end < text.length) {
					kept = kept.replace(/\s+$/, "");
					at = end + 1;
					continue;
				}
			}
		}
		kept += text[at];
		at++;
	}
	return kept;
}

/** Text for display: the task without Tasks emoji fields, inline fields or block ids. */
export function displayText(text: string): string {
	return withoutInlineFields(
		text
			.replace(/\s*[⏳📅🛫✅➕❌]️?\s*\d{4}-\d{2}-\d{2}/gu, "")
			.replace(/\s*[⏫🔼🔽🔺⏬]️?/gu, "")
			.replace(/\s*🔁️?[^⏳📅🛫✅➕❌⏫🔼🔽🔺⏬]*/gu, ""),
	)
		.replace(/\s*\^[\w-]+$/, "")
		.trim();
}

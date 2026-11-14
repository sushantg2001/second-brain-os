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

/**
 * Links as Obsidian shows them: `[[Note|Alias]]` is "Alias", `[[Note]]` is "Note", a link to a
 * heading is "Note > Heading" and one to a block is just the note. An embed reads the same, and
 * `[text](url)` is "text".
 */
function withLinksAsText(text: string): string {
	return text
		.replace(
			/!?\[\[([^\]|#]*)(?:#([^\]|]*))?(?:\|([^\]]*))?\]\]/g,
			(_, target: string, heading: string | undefined, alias: string | undefined) => {
				if (alias !== undefined) {
					return alias;
				}
				if (heading === undefined || heading.startsWith("^")) {
					return target;
				}
				return target ? `${target} > ${heading}` : heading;
			},
		)
		.replace(/\[([^\]]+)\]\((?:[^()\s]|\([^()\s]*\))*\)/g, "$1");
}

/**
 * Text for display: the task without Tasks emoji fields, inline fields or block ids, and with
 * its links shown by their text. Dataview reports a task's text as written, so this is what
 * turns it into a title.
 */
export function displayText(text: string): string {
	return withLinksAsText(
		withoutInlineFields(
			text
				.replace(/\s*[⏳📅🛫✅➕❌]️?\s*\d{4}-\d{2}-\d{2}/gu, "")
				.replace(/\s*[⏫🔼🔽🔺⏬]️?/gu, "")
				.replace(/\s*🔁️?[^⏳📅🛫✅➕❌⏫🔼🔽🔺⏬]*/gu, ""),
		),
	)
		.replace(/\s*\^[\w-]+$/, "")
		.trim();
}

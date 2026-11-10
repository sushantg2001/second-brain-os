/** How much a selector weighs when two rules set the same property: ids, classes, then types. */
export type Specificity = readonly [ids: number, classes: number, types: number];

const NONE: Specificity = [0, 0, 0];

export function compareSpecificity(a: Specificity, b: Specificity): number {
	return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

const add = (a: Specificity, b: Specificity): Specificity => [
	a[0] + b[0],
	a[1] + b[1],
	a[2] + b[2],
];

const heaviest = (all: readonly Specificity[]): Specificity =>
	all.reduce((most, next) => (compareSpecificity(next, most) > 0 ? next : most), NONE);

/** Splits on commas that are not inside brackets or parentheses. */
export function splitSelectorList(list: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let start = 0;
	for (let at = 0; at < list.length; at++) {
		const char = list[at];
		if (char === "(" || char === "[") {
			depth++;
		} else if (char === ")" || char === "]") {
			depth--;
		} else if (char === "," && depth === 0) {
			parts.push(list.slice(start, at).trim());
			start = at + 1;
		}
	}
	parts.push(list.slice(start).trim());
	return parts.filter((part) => part !== "");
}

/**
 * The specificity of one complex selector. `:is`, `:not` and `:has` weigh as their heaviest
 * argument, `:where` as nothing, and a pseudo-element as a type.
 */
export function specificityOf(selector: string): Specificity {
	let total: Specificity = NONE;
	let at = 0;
	const text = selector.trim();
	while (at < text.length) {
		const char = text[at] ?? "";
		if (char === "#") {
			total = add(total, [1, 0, 0]);
			at += 1 + identifierLength(text, at + 1);
		} else if (char === ".") {
			total = add(total, [0, 1, 0]);
			at += 1 + identifierLength(text, at + 1);
		} else if (char === "[") {
			total = add(total, [0, 1, 0]);
			at = text.indexOf("]", at) + 1 || text.length;
		} else if (char === ":") {
			const element = text[at + 1] === ":";
			const start = at + (element ? 2 : 1);
			const length = identifierLength(text, start);
			const name = text.slice(start, start + length).toLowerCase();
			at = start + length;
			if (text[at] === "(") {
				const close = matching(text, at);
				const args = splitSelectorList(text.slice(at + 1, close));
				at = close + 1;
				if (name === "where") {
					continue;
				}
				if (name === "is" || name === "not" || name === "has") {
					total = add(total, heaviest(args.map(specificityOf)));
					continue;
				}
			}
			total = add(total, element ? [0, 0, 1] : [0, 1, 0]);
		} else if (/[a-z]/i.test(char)) {
			total = add(total, [0, 0, 1]);
			at += identifierLength(text, at);
		} else {
			// Combinators, whitespace and the universal selector weigh nothing.
			at += 1;
		}
	}
	return total;
}

function identifierLength(text: string, from: number): number {
	let length = 0;
	while (/[\w-]/.test(text[from + length] ?? "")) {
		length++;
	}
	return length;
}

function matching(text: string, open: number): number {
	let depth = 0;
	for (let at = open; at < text.length; at++) {
		if (text[at] === "(") {
			depth++;
		} else if (text[at] === ")" && --depth === 0) {
			return at;
		}
	}
	return text.length;
}

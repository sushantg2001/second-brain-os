import { readFileSync } from "node:fs";

/** The plugin's stylesheet, as shipped. */
export const STYLESHEET = readFileSync("src/styles/index.css", "utf8");

export interface Declaration {
	readonly selector: string;
	readonly property: string;
	readonly value: string;
}

/** Every declaration in the sheet, with the selector it belongs to. Comments are dropped. */
export function declarations(css: string): Declaration[] {
	const found: Declaration[] = [];
	const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
	for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const [, selector = "", body = ""] = match;
		const name = selector.trim().replace(/\s+/g, " ");
		for (const line of body.split(";")) {
			const at = line.indexOf(":");
			if (at === -1) {
				continue;
			}
			found.push({
				selector: name,
				property: line.slice(0, at).trim(),
				value: line.slice(at + 1).trim(),
			});
		}
	}
	return found;
}

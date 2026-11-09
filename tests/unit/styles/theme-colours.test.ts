import { describe, expect, it } from "bun:test";

import { declarations, STYLESHEET } from "./stylesheet";

/**
 * Obsidian themes replace the colour variables, so a literal colour in the plugin's stylesheet
 * is a colour the theme cannot reach. Shadows are the usual way one slips back in.
 */
describe("theme colours", () => {
	const LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i;

	it("leaves every colour to the theme", () => {
		const literals = declarations(STYLESHEET)
			.filter(({ value }) => LITERAL.test(value))
			.map(({ selector, property, value }) => `${selector} { ${property}: ${value} }`);
		expect(literals).toEqual([]);
	});

	it("takes the time block's border and shadow from the theme", () => {
		const timeline = declarations(STYLESHEET).filter(
			({ selector }) => selector === ".sbos-timeline",
		);
		const value = (name: string) =>
			timeline.find((rule) => rule.property === name)?.value ?? "";
		expect(value("--sbos-block-border")).toBe("var(--background-modifier-border)");
		expect(value("--sbos-block-shadow")).toContain("var(--background-modifier-box-shadow)");
	});
});

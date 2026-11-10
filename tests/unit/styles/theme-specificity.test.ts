import { describe, expect, it } from "bun:test";

import { compareSpecificity, specificityOf, splitSelectorList } from "./specificity";
import { declarations, STYLESHEET } from "./stylesheet";

/**
 * Selectors, in Obsidian itself and in the community themes the plugin is checked against, that
 * set the padding, background, shadow, colour or outline of a plain `<button>` inside a view. They
 * were found by scanning each stylesheet, leaving out rules that only apply inside a dialog, the
 * settings, the ribbon and the like. When a theme or Obsidian is upgraded, scan again and add what
 * is new: a rule heavier than the plugin's reset would draw plugin buttons as raised controls.
 */
const RULES_REACHING_PLAIN_BUTTONS = [
	{ source: "Obsidian 1.15 app.css", selector: "button" },
	{ source: "Obsidian 1.15 app.css", selector: "button:not(.clickable-icon)" },
	{ source: "Obsidian 1.15 app.css", selector: ".is-tablet button:not(.clickable-icon)" },
	{ source: "Material 3 1.9.1", selector: "body.theme-dark button:not(.clickable-icon)" },
	{ source: "Material 3 1.9.1", selector: "body.theme-light button:not(.clickable-icon)" },
] as const;

/** The selectors of the reset that takes chrome off the plugin's plain buttons. */
function resetSelectors(): string[] {
	const reset = declarations(STYLESHEET).filter(({ selector }) =>
		selector.includes("button:not(.mod-cta):not(.mod-warning)"),
	);
	return [...new Set(reset.map(({ selector }) => selector))].flatMap(splitSelectorList);
}

describe("the button reset against Obsidian and the themes", () => {
	it("covers the plugin's plain buttons with more than one selector", () => {
		const selectors = resetSelectors();
		expect(selectors.length).toBeGreaterThanOrEqual(2);
		expect(selectors.some((selector) => selector.includes(".sbos-control"))).toBe(true);
		expect(selectors.some((selector) => selector.includes(".sbos-calendar button"))).toBe(true);
	});

	for (const { source, selector } of RULES_REACHING_PLAIN_BUTTONS) {
		it(`outweighs \`${selector}\` (${source})`, () => {
			const theirs = specificityOf(selector);
			for (const ours of resetSelectors()) {
				expect(
					compareSpecificity(specificityOf(ours), theirs),
					`${ours} must outweigh ${selector}`,
				).toBeGreaterThan(0);
			}
		});
	}

	it("beats a theme rule one class heavier than any seen, and not two", () => {
		// The headroom: Material 3 weighs (0,2,2) and the reset (0,3,1), so one more class in a
		// theme would win. This pins what the margin is, so a change to it is a decision.
		const weakest = resetSelectors()
			.map(specificityOf)
			.reduce((least, next) => (compareSpecificity(next, least) < 0 ? next : least));
		expect(weakest).toEqual([0, 3, 1]);
	});
});

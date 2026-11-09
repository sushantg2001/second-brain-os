import { describe, expect, it } from "bun:test";

import { declarations, STYLESHEET } from "./stylesheet";

/**
 * Obsidian paints `button:not(.clickable-icon)` as a raised control and themes repeat that with
 * more weight, so the plugin's plain buttons carry one reset that outweighs both. Anything the
 * reset sets has to reach a button through a custom property; a plain declaration would lose.
 */
describe("plain buttons", () => {
	/** The classes the plugin renders as a bare `<button>`. Mirrors the reset's own list. */
	const BUTTONS = [
		"sbos-control",
		"sbos-link",
		"sbos-icon-button",
		"sbos-unscheduled__title",
		"sbos-unscheduled__schedule",
		"sbos-block__title",
		"sbos-block__clock",
		"sbos-calendar__arrow",
		"sbos-calendar__reset",
		"sbos-calendar__jump",
		"sbos-calendar__day",
		"sbos-calendar__week-button",
		"sbos-calendar__tab",
		"sbos-calendar__title-button",
		"sbos-calendar__quarter",
		"sbos-calendar__year",
		"sbos-period-grid__cell",
		"sbos-week-picker__day",
		"sbos-timeline__title-button",
		"sbos-timeline__today",
	];

	/** What the reset takes over, and the custom property each one reads. */
	const RESET: Readonly<Record<string, string>> = {
		padding: "--sbos-button-padding",
		"background-color": "--sbos-button-background",
		color: "--sbos-button-color",
		"box-shadow": "--sbos-button-shadow",
		outline: "--sbos-button-outline",
	};

	/** The last compound selector: the element the rule is actually about. */
	const subject = (selector: string): string =>
		selector
			.split(",")[0]
			?.split(/[\s>+~]+/)
			.at(-1) ?? "";

	/** The reset itself, which is the rule every other one has to work through. */
	const isReset = (selector: string): boolean =>
		selector.includes("button:not(.mod-cta):not(.mod-warning)");

	const isButtonRule = (selector: string): boolean =>
		!isReset(selector) &&
		selector
			.split(",")
			.some(
				(one) =>
					!one.includes(".mod-cta") &&
					BUTTONS.some((name) => subject(one.trim()).includes(`.${name}`)),
			);

	it("sets what the reset owns through a custom property", () => {
		const direct = declarations(STYLESHEET)
			.filter(
				({ selector, property, value }) =>
					RESET[property] !== undefined &&
					isButtonRule(selector) &&
					!declarations(STYLESHEET).some(
						(other) =>
							other.selector === selector && other.property === RESET[property],
					) &&
					value !== "",
			)
			.map(({ selector, property }) => `${selector} { ${property} }`);
		expect(direct).toEqual([]);
	});

	it("keeps a reset that outweighs Obsidian and the themes", () => {
		const reset = declarations(STYLESHEET).filter(({ selector }) =>
			selector.includes("button:not(.mod-cta):not(.mod-warning)"),
		);
		expect(reset.length).toBeGreaterThan(0);
		for (const property of Object.keys(RESET)) {
			const rule = reset.find((one) => one.property === property);
			expect(rule?.value).toContain(`var(${RESET[property]}`);
		}
	});
});

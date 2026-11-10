import { describe, expect, it } from "bun:test";

import { declarations, STYLESHEET } from "./stylesheet";

/**
 * A clocked block sits over the day, which turns a press on empty space into a new planned block.
 * The lane lets presses through, so the block's own button has to cover all of it, or pressing
 * the body of a tall block would start drawing one underneath instead of opening its task.
 */
describe("clocked blocks", () => {
	const rules = (selector: string) =>
		declarations(STYLESHEET).filter((rule) => rule.selector === selector);

	it("has a title button that fills the block, edge to edge", () => {
		const title = rules(".sbos-clock__title");
		const value = (property: string) => title.find((rule) => rule.property === property)?.value;
		expect(value("--sbos-button-height")).toBe("100%");
		expect(value("width")).toBe("100%");
		// The padding is the button's own, so none of the block is left out of it.
		expect(rules(".sbos-clock").some((rule) => rule.property === "padding")).toBe(false);
		expect(value("--sbos-button-padding")).toBeDefined();
	});

	it("lets presses through the lane but not through the buttons in it", () => {
		const events = (selector: string) =>
			rules(selector).find((rule) => rule.property === "pointer-events")?.value;
		expect(events(".sbos-clocks")).toBe("none");
		expect(events(".sbos-clock__title")).toBe("auto");
	});
});

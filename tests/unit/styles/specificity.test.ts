import { describe, expect, it } from "bun:test";

import { compareSpecificity, specificityOf, splitSelectorList } from "./specificity";

describe("specificityOf", () => {
	it("counts ids, classes and types", () => {
		expect(specificityOf("button")).toEqual([0, 0, 1]);
		expect(specificityOf(".a.b")).toEqual([0, 2, 0]);
		expect(specificityOf("#a .b c")).toEqual([1, 1, 1]);
		expect(specificityOf("body.theme-dark button")).toEqual([0, 1, 2]);
		expect(specificityOf("a[href].b:hover")).toEqual([0, 3, 1]);
	});

	it("weighs :not, :is and :has as their heaviest argument and :where as nothing", () => {
		expect(specificityOf("button:not(.clickable-icon)")).toEqual([0, 1, 1]);
		expect(specificityOf("button:not(.a, #b)")).toEqual([1, 0, 1]);
		expect(specificityOf("a:is(.x, .y z)")).toEqual([0, 1, 2]);
		expect(specificityOf(":where(.sbos-calendar) button")).toEqual([0, 0, 1]);
		expect(specificityOf("li:has(> .a)")).toEqual([0, 1, 1]);
	});

	it("weighs a pseudo-element as a type and ignores combinators", () => {
		expect(specificityOf("p::before")).toEqual([0, 0, 2]);
		expect(specificityOf(".a > .b + .c ~ *")).toEqual([0, 3, 0]);
	});
});

describe("splitSelectorList and compareSpecificity", () => {
	it("splits only at the top level", () => {
		expect(splitSelectorList("a, b:is(.c, .d), [x='1,2'] e")).toEqual([
			"a",
			"b:is(.c, .d)",
			"[x='1,2'] e",
		]);
	});

	it("orders by ids, then classes, then types", () => {
		expect(compareSpecificity([0, 3, 1], [0, 2, 9])).toBeGreaterThan(0);
		expect(compareSpecificity([1, 0, 0], [0, 99, 99])).toBeGreaterThan(0);
		expect(compareSpecificity([0, 1, 1], [0, 1, 1])).toBe(0);
	});
});

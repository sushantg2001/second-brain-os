import { describe, expect, it } from "bun:test";

import { displayText } from "../../../src/features/tasks";

describe("displayText: inline fields", () => {
	it("drops a field whose value is a link", () => {
		expect(
			displayText(
				"Weekly job sweep 15 [level::story] [reference::[[2026-10#^jobs-part4|Job search - Part 4]]]  [completion:: 2026-11-03] ^job-sweep-15-w44",
			),
		).toBe("Weekly job sweep 15");
	});

	it("drops a field with nested brackets and one with nested parentheses", () => {
		expect(displayText("Plan [reference::[[ai-workflow|ai workflow]]] ^epic")).toBe("Plan");
		expect(displayText("Plan (note:: first (second) third) now")).toBe("Plan now");
	});

	it("keeps the words either side of fields", () => {
		expect(displayText("Write [a::1] the [b::[[B]]] spec [c::3]")).toBe("Write the spec");
	});

	it("keeps text that only looks like the start of a field", () => {
		expect(displayText("Fix the [type::log bug")).toBe("Fix the [type::log bug");
		expect(displayText("Use a [note] and (a remark)")).toBe("Use a [note] and (a remark)");
	});
});

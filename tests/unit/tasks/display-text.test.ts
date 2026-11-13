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

describe("displayText: links", () => {
	it("shows a wiki link by its alias", () => {
		expect(
			displayText("create story for [[2025-10#^d97457|dataview properties in tasks plugin]]"),
		).toBe("create story for dataview properties in tasks plugin");
	});

	it("shows a wiki link without an alias by its target", () => {
		expect(displayText("Create the initial [[Data-Science]] resources")).toBe(
			"Create the initial Data-Science resources",
		);
		expect(displayText("Review ([[2025-10]] to [[2025-12]])")).toBe(
			"Review (2025-10 to 2025-12)",
		);
	});

	it("shows a link to a heading as the note and the heading, and one to a block as the note", () => {
		expect(displayText("See [[Plan#Timeline]]")).toBe("See Plan > Timeline");
		expect(displayText("See [[Plan#^abc123]]")).toBe("See Plan");
		expect(displayText("See [[#Timeline]]")).toBe("See Timeline");
	});

	it("shows an embed and a markdown link by their text", () => {
		expect(displayText("Read ![[Notes]] and [the docs](https://example.com/a_(b))")).toBe(
			"Read Notes and the docs",
		);
	});

	it("leaves a task with no links or fields alone", () => {
		expect(displayText("Buy milk")).toBe("Buy milk");
		expect(displayText("")).toBe("");
	});
});

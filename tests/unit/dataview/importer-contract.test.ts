import { describe, expect, it } from "bun:test";

import golden from "../../fixtures/dataview/importer-0.5.68.json";
import { readLists } from "../../fakes/fake-dataview";

/** The properties of a list item that are not inline fields. */
const NOT_FIELDS = new Set([
	"symbol",
	"link",
	"section",
	"text",
	"tags",
	"line",
	"lineCount",
	"list",
	"outlinks",
	"path",
	"children",
	"task",
	"annotated",
	"position",
	"subtasks",
	"real",
	"header",
	"parent",
	"blockId",
	"status",
	"checked",
	"completed",
	"fullyCompleted",
]);

function plain(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(plain);
	}
	const date = (value as { toISODate?: () => string } | null)?.toISODate;
	if (typeof date === "function") {
		return date.call(value);
	}
	return typeof value === "object" && value !== null && "path" in value ? value.path : value;
}

describe("the fake Dataview", () => {
	it("reads the sample notes as Dataview 0.5.68's own importer does", () => {
		expect(golden.dataview).toBe("0.5.68");
		for (const note of golden.notes) {
			const read = readLists(note.content).map((item) => ({
				line: item.line,
				lineCount: item.lineCount,
				parent: item.parent ?? null,
				task: item.task,
				status: item.status ?? null,
				text: item.text,
				section: item.section.subpath ?? null,
				children: item.children.map((child) => child.line),
				outlinks: item.outlinks.map((link) => link.path),
				fields: Object.fromEntries(
					Object.entries(item)
						.filter(([key]) => !NOT_FIELDS.has(key))
						.map(([key, value]) => [key, plain(value)]),
				),
			}));
			const expected = note.items.map(({ tags: _tags, ...item }) => item);
			expect({ note: note.name, items: read }).toEqual({ note: note.name, items: expected });
		}
	});
});

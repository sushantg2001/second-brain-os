import { describe, expect, it } from "bun:test";

import {
	basename,
	formatOf,
	joinPath,
	normalizeVaultPath,
	notePath,
	parentFolder,
	renderTemplate,
	withMarkdownExtension,
	DEFAULT_PERIODIC_SETTINGS,
} from "../../../src/features/periodic";

describe("vault paths", () => {
	it("normalizes slashes and empty segments", () => {
		expect(normalizeVaultPath("/Journal//Daily/")).toBe("Journal/Daily");
		expect(normalizeVaultPath("a\\b/./c")).toBe("a/b/c");
		expect(normalizeVaultPath("")).toBe("");
	});

	it("builds note paths", () => {
		expect(notePath("", "2026-10-29")).toBe("2026-10-29.md");
		expect(notePath("/Journal/", "2026/10/29")).toBe("Journal/2026/10/29.md");
		expect(joinPath("a", "b.md")).toBe("a/b.md");
	});

	it("splits paths", () => {
		expect(parentFolder("a/b/c.md")).toBe("a/b");
		expect(parentFolder("c.md")).toBe("");
		expect(basename("a/b/c.md")).toBe("c");
		expect(withMarkdownExtension("Templates/Daily")).toBe("Templates/Daily.md");
		expect(withMarkdownExtension("Templates/Daily.MD")).toBe("Templates/Daily.MD");
	});
});

describe("formatOf", () => {
	it("falls back to the default format when blank", () => {
		const settings = {
			...DEFAULT_PERIODIC_SETTINGS,
			notes: {
				...DEFAULT_PERIODIC_SETTINGS.notes,
				day: { ...DEFAULT_PERIODIC_SETTINGS.notes.day, format: "  " },
			},
		};
		expect(formatOf(settings, "day")).toBe("YYYY-MM-DD");
	});
});

describe("renderTemplate", () => {
	const context = {
		title: "2026-10-29",
		formatDate: (format: string) => `date(${format})`,
		formatNow: (format: string) => `now(${format})`,
	};

	it("replaces every placeholder", () => {
		expect(
			renderTemplate("# {{title}}\n{{date}} {{date:dddd}} {{ time }} {{time:HH}}", context),
		).toBe("# 2026-10-29\ndate(YYYY-MM-DD) date(dddd) now(HH:mm) now(HH)");
	});

	it("is case-insensitive and leaves Templater syntax alone", () => {
		expect(renderTemplate("{{TITLE}} <% tp.date.now() %>", context)).toBe(
			"2026-10-29 <% tp.date.now() %>",
		);
	});

	it("does not treat $ in the title as a replacement pattern", () => {
		expect(renderTemplate("{{title}}", { ...context, title: "$& cost" })).toBe("$& cost");
	});
});

import { describe, expect, it } from "bun:test";
import fc from "fast-check";

import {
	appendToSection,
	insertAfter,
	locate,
	replaceLine,
	setStatusLine,
	toggleDoneLine,
} from "../../../src/features/tasks";

describe("locate", () => {
	it("prefers the original index, then a unique match", () => {
		expect(locate(["a", "b"], { line: 1, raw: "b" })).toEqual({ ok: true, value: 1 });
		expect(locate(["x", "a", "b"], { line: 1, raw: "b" })).toEqual({ ok: true, value: 2 });
		expect(locate(["b", "b"], { line: 5, raw: "b" }).ok).toBe(false);
		expect(locate(["a"], { line: 0, raw: "z" }).ok).toBe(false);
	});
});

describe("replaceLine and insertAfter", () => {
	it("replaces and inserts while keeping line endings", () => {
		const content = "a\r\nb\r\nc";
		const replaced = replaceLine(content, { line: 1, raw: "b" }, ["B1", "B2"]);
		expect(replaced.ok && replaced.value).toBe("a\r\nB1\r\nB2\r\nc");
		const inserted = insertAfter("a\nb", { line: 0, raw: "a" }, ["x"]);
		expect(inserted.ok && inserted.value).toBe("a\nx\nb");
		expect(insertAfter("a", { line: 0, raw: "q" }, ["x"]).ok).toBe(false);
	});

	it("never touches other lines", () => {
		fc.assert(
			fc.property(
				fc.array(fc.stringMatching(/^[a-z ]{0,8}$/), { minLength: 1, maxLength: 20 }),
				fc.nat(),
				fc.stringMatching(/^[A-Z]{1,5}$/),
				(lines, pick, replacement) => {
					const index = pick % lines.length;
					const content = lines.join("\n");
					const result = replaceLine(
						content,
						{ line: index, raw: lines[index] ?? "" },
						replacement,
					);
					expect(result.ok).toBe(true);
					if (result.ok) {
						const next = result.value.split("\n");
						expect(next[index]).toBe(replacement);
						expect(next.filter((_, i) => i !== index)).toEqual(
							lines.filter((_, i) => i !== index),
						);
					}
				},
			),
		);
	});
});

describe("appendToSection", () => {
	it("appends after the section's last line", () => {
		const content = "# Day\n## Day planner\n- [ ] 09:00 - 10:00 A\n\n## Notes\nhello";
		expect(appendToSection(content, "Day planner", ["- [ ] 11:00 - 12:00 B"])).toBe(
			"# Day\n## Day planner\n- [ ] 09:00 - 10:00 A\n- [ ] 11:00 - 12:00 B\n\n## Notes\nhello",
		);
	});

	it("matches the heading case-insensitively at any level and runs to the end", () => {
		expect(appendToSection("### day PLANNER\n- a", "Day planner", ["- b"])).toBe(
			"### day PLANNER\n- a\n- b",
		);
		expect(appendToSection("## Day planner\n", "Day planner", ["- b"])).toBe(
			"## Day planner\n- b\n",
		);
	});

	it("adds the heading when missing", () => {
		expect(appendToSection("", "Day planner", ["- b"])).toBe("## Day planner\n- b\n");
		expect(appendToSection("# Title\n\n", "Day planner", ["- b"])).toBe(
			"# Title\n\n## Day planner\n- b\n",
		);
	});

	it("ignores a matching heading inside front matter", () => {
		expect(appendToSection("---\n# Day planner\n---\nBody", "Day planner", ["- b"])).toBe(
			"---\n# Day planner\n---\nBody\n\n## Day planner\n- b\n",
		);
	});
});

describe("toggleDoneLine", () => {
	it("completes with a date and reopens", () => {
		const done = toggleDoneLine("- [ ] Pay rent 📅 2026-11-01", "2026-10-29");
		expect(done).toBe("- [x] Pay rent 📅 2026-11-01 ✅ 2026-10-29");
		expect(toggleDoneLine(done ?? "", "2026-10-30")).toBe("- [ ] Pay rent 📅 2026-11-01");
		expect(toggleDoneLine("- note", "2026-10-29")).toBeNull();
	});

	it("sets a status symbol", () => {
		expect(setStatusLine("\t- [ ] A", "/")).toBe("\t- [/] A");
		expect(setStatusLine("- A", "/")).toBeNull();
	});
});

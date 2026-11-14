import { describe, expect, it } from "bun:test";
import fc from "fast-check";

import {
	appendToSection,
	editLine,
	insertAfter,
	locate,
	replaceLine,
	setStatusLine,
	toggleDoneLine,
} from "../../../src/features/tasks";

/** A reference to the task `- [ ] <text>`. */
const task = (line: number, text: string, status = " ") => ({ line, status, text });

describe("locate", () => {
	it("prefers the original index, then a unique match", () => {
		expect(locate(["- [ ] a", "- [ ] b"], task(1, "b"))).toEqual({ ok: true, value: 1 });
		expect(locate(["x", "- [ ] a", "- [ ] b"], task(1, "b"))).toEqual({ ok: true, value: 2 });
		expect(locate(["- [ ] b", "- [ ] b"], task(5, "b")).ok).toBe(false);
		expect(locate(["- [ ] a"], task(0, "z")).ok).toBe(false);
	});

	it("matches the checkbox and the text, not the spacing or the bullet", () => {
		expect(locate(["\t* [ ]   spaced  "], task(0, "spaced"))).toEqual({ ok: true, value: 0 });
		expect(locate(["> - [ ] quoted"], task(0, "quoted"))).toEqual({ ok: true, value: 0 });
		expect(locate(["- [x] a"], task(0, "a", " ")).ok).toBe(false);
		expect(locate(["- a"], task(0, "a")).ok).toBe(false);
	});
});

describe("editLine", () => {
	it("gives the edit the line as it is now", () => {
		const seen: string[] = [];
		const result = editLine("x\n\t- [ ] a", task(0, "a"), (line) => {
			seen.push(line);
			return line.replace("[ ]", "[x]");
		});
		expect(seen).toEqual(["\t- [ ] a"]);
		expect(result.ok && result.value).toBe("x\n\t- [x] a");
	});

	it("fails when the edit refuses the line or the task moved", () => {
		const refused = editLine("- [ ] a", task(0, "a"), () => null);
		expect(!refused.ok && refused.error.message).toBe("That line is not a task.");
		expect(editLine("- [ ] b", task(0, "a"), (line) => line).ok).toBe(false);
	});
});

describe("replaceLine and insertAfter", () => {
	it("replaces and inserts while keeping line endings", () => {
		const content = "- [ ] a\r\n- [ ] b\r\n- [ ] c";
		const replaced = replaceLine(content, task(1, "b"), ["B1", "B2"]);
		expect(replaced.ok && replaced.value).toBe("- [ ] a\r\nB1\r\nB2\r\n- [ ] c");
		const inserted = insertAfter("- [ ] a\n- [ ] b", task(0, "a"), ["x"]);
		expect(inserted.ok && inserted.value).toBe("- [ ] a\nx\n- [ ] b");
		expect(insertAfter("- [ ] a", task(0, "q"), ["x"]).ok).toBe(false);
	});

	it("never touches other lines", () => {
		fc.assert(
			fc.property(
				fc.array(fc.stringMatching(/^[a-z]{1,8}$/), { minLength: 1, maxLength: 20 }),
				fc.nat(),
				fc.stringMatching(/^[A-Z]{1,5}$/),
				(texts, pick, replacement) => {
					const lines = texts.map((text, i) => `- [ ] ${text}${i}`);
					const index = pick % lines.length;
					const result = replaceLine(
						lines.join("\n"),
						task(index, `${texts[index]}${index}`),
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

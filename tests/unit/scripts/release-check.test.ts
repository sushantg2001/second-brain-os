import { describe, expect, it } from "bun:test";

import { changelogSection, versionProblems } from "../../../scripts/release-check";

describe("versionProblems", () => {
	const files = {
		pkg: { version: "2.0.0" },
		manifest: { version: "2.0.0", minAppVersion: "1.7.2" },
		versions: { "1.0.0": "1.5.0", "2.0.0": "1.7.2" },
	};

	it("accepts a tag that every version file agrees with", () => {
		expect(versionProblems("2.0.0", files)).toEqual([]);
	});

	it("names each file that disagrees with the tag", () => {
		const problems = versionProblems("2.1.0", files);
		expect(problems).toHaveLength(3);
		expect(problems[0]).toContain("package.json says 2.0.0");
		expect(problems[1]).toContain("manifest.json says 2.0.0");
		expect(problems[2]).toContain("versions.json");
	});

	it("requires the versions.json entry to carry the manifest's minAppVersion", () => {
		const stale = { ...files, versions: { "2.0.0": "1.0.0" } };
		expect(versionProblems("2.0.0", stale)).toHaveLength(1);
	});
});

describe("changelogSection", () => {
	const changelog = [
		"# Changelog",
		"",
		"## [Unreleased]",
		"",
		"## [2.0.0] - 2026-10-30",
		"",
		"### Features",
		"",
		"- planner",
		"",
		"## [1.0.0] - 2026-01-01",
		"",
		"- first",
		"",
	].join("\n");

	it("returns the text between this version's heading and the next", () => {
		expect(changelogSection(changelog, "2.0.0")).toBe("### Features\n\n- planner");
	});

	it("reads the last section to the end of the file", () => {
		expect(changelogSection(changelog, "1.0.0")).toBe("- first");
	});

	it("returns null when the version has no section", () => {
		expect(changelogSection(changelog, "3.0.0")).toBeNull();
	});

	it("does not treat the dots in a version as wildcards", () => {
		expect(changelogSection("## [2x0x0]\n\ntext\n", "2.0.0")).toBeNull();
	});

	it("returns an empty string for a heading with no body", () => {
		expect(changelogSection("## [2.0.0] - 2026-10-30\n", "2.0.0")).toBe("");
	});
});

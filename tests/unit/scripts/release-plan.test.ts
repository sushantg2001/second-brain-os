import { describe, expect, it } from "bun:test";

import {
	largestBump,
	parseCommit,
	planRelease,
	releaseNotes,
	updateChangelog,
} from "../../../scripts/release-plan";

describe("parseCommit", () => {
	it("reads type, scope and description", () => {
		expect(parseCommit("feat(planner): drag blocks")).toEqual({
			type: "feat",
			scope: "planner",
			description: "drag blocks",
			bump: "major",
		});
		expect(parseCommit("fix!: crash")?.bump).toBe("minor");
		expect(parseCommit("Refactor: tidy")?.bump).toBe("patch");
	});

	it("ignores non-conventional and release commits", () => {
		expect(parseCommit("Merge pull request #4 from x/y")).toBeNull();
		expect(parseCommit("chore(release): 2.0.0")).toBeNull();
		expect(parseCommit("wip: something")?.bump).toBe("none");
	});
});

describe("planRelease", () => {
	it("maps feat to major, fix to minor, chore and refactor to patch", () => {
		expect(planRelease("1.4.2", ["feat: a", "fix: b", "chore: c"]).version).toBe("2.0.0");
		expect(planRelease("1.4.2", ["fix: b", "refactor: c"]).version).toBe("1.5.0");
		expect(planRelease("1.4.2", ["chore: c"]).version).toBe("1.4.3");
		expect(planRelease("1.4.2", ["refactor: c"]).version).toBe("1.4.3");
	});

	it("does not release for docs, test and ci", () => {
		const plan = planRelease("1.4.2", [
			"docs: a",
			"test: b",
			"ci: c",
			"perf: d",
			"build: e",
			"Merge branch 'x'",
		]);
		expect(plan).toEqual({ bump: "none", current: "1.4.2", version: null, notes: "" });
		expect(planRelease("1.4.2", []).version).toBeNull();
	});

	it("takes an explicit bump", () => {
		expect(planRelease("1.4.2", ["docs: a"], "patch").version).toBe("1.4.3");
		expect(planRelease("1.4.2", ["feat: a"], "minor").version).toBe("1.5.0");
	});

	it("largest bump wins in any order", () => {
		expect(largestBump(["patch", "major", "minor"])).toBe("major");
		expect(largestBump([])).toBe("none");
	});
});

describe("release notes", () => {
	it("groups by type and leaves out docs, tests and ci", () => {
		const notes = releaseNotes(
			[
				"feat(ppv): dashboard",
				"fix: crash",
				"perf: faster",
				"chore: deps",
				"docs: guide",
				"ci: cache",
			]
				.map(parseCommit)
				.filter((commit) => commit !== null),
		);
		expect(notes).toBe(
			[
				"### Features",
				"",
				"- **ppv:** dashboard",
				"",
				"### Fixes",
				"",
				"- crash",
				"",
				"### Maintenance",
				"",
				"- deps",
			].join("\n"),
		);
	});
});

describe("updateChangelog", () => {
	it("turns the Unreleased heading into the release and keeps its text", () => {
		const changelog =
			"# Changelog\n\nIntro.\n\n## [Unreleased] — 2.0.0\n\nHand-written.\n\n## [1.0.0]\n";
		expect(updateChangelog(changelog, "2.0.0", "2026-10-29", "### Features\n\n- a")).toBe(
			"# Changelog\n\nIntro.\n\n## [Unreleased]\n\n## [2.0.0] - 2026-10-29\n\n### Features\n\n- a\n\nHand-written.\n\n## [1.0.0]\n",
		);
	});

	it("adds a section above the latest release, or at the end", () => {
		expect(updateChangelog("# C\n\n## [1.0.0]\n", "1.0.1", "2026-10-29", "")).toBe(
			"# C\n\n## [1.0.1] - 2026-10-29\n\n## [1.0.0]\n",
		);
		expect(updateChangelog("# C\n", "1.0.1", "2026-10-29", "- x")).toBe(
			"# C\n\n## [1.0.1] - 2026-10-29\n\n- x\n",
		);
	});
});

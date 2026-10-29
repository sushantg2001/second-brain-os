/**
 * Decides the next release from Conventional Commit subjects since the last version tag.
 *
 *   feat            -> major   (1.4.2 -> 2.0.0)
 *   fix             -> minor   (1.4.2 -> 1.5.0)
 *   chore, refactor, perf, build, style, revert -> patch (1.4.2 -> 1.4.3)
 *   docs, test, ci  -> no release
 *
 * The largest bump wins. "chore(release):" commits made by the pipeline are ignored.
 *
 * Usage: bun scripts/release-plan.ts [--bump auto|major|minor|patch] [--changelog]
 * Prints the plan as JSON and, on GitHub Actions, writes `release`, `version`, `tag` and
 * `bump` outputs plus RELEASE_NOTES.md. With --changelog it also updates CHANGELOG.md.
 */
import { appendFile, readFile, writeFile } from "node:fs/promises";

import { nextVersion } from "./version";

export type Bump = "major" | "minor" | "patch" | "none";

export const BUMP_BY_TYPE: Readonly<Record<string, Bump>> = {
	feat: "major",
	fix: "minor",
	chore: "patch",
	refactor: "patch",
	perf: "patch",
	build: "patch",
	style: "patch",
	revert: "patch",
	docs: "none",
	test: "none",
	ci: "none",
};

const ORDER: readonly Bump[] = ["none", "patch", "minor", "major"];
const SUBJECT = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;

export interface ParsedCommit {
	readonly type: string;
	readonly scope: string | null;
	readonly description: string;
	readonly bump: Bump;
}

/** Reads a Conventional Commit subject. Anything else (such as merge commits) bumps nothing. */
export function parseCommit(subject: string): ParsedCommit | null {
	const match = SUBJECT.exec(subject.trim());
	if (!match) {
		return null;
	}
	const type = (match[1] ?? "").toLowerCase();
	const scope = match[2] ?? null;
	if (type === "chore" && scope === "release") {
		return null;
	}
	return { type, scope, description: match[4] ?? "", bump: BUMP_BY_TYPE[type] ?? "none" };
}

export function largestBump(bumps: Iterable<Bump>): Bump {
	let largest: Bump = "none";
	for (const bump of bumps) {
		if (ORDER.indexOf(bump) > ORDER.indexOf(largest)) {
			largest = bump;
		}
	}
	return largest;
}

export interface ReleasePlan {
	readonly bump: Bump;
	readonly current: string;
	readonly version: string | null;
	readonly notes: string;
}

const SECTIONS: readonly [string, readonly string[]][] = [
	["Features", ["feat"]],
	["Fixes", ["fix"]],
	["Performance", ["perf"]],
	["Maintenance", ["refactor", "chore", "build", "style", "revert"]],
];

/** Release notes grouped by type. Types that do not release are left out. */
export function releaseNotes(commits: readonly ParsedCommit[]): string {
	const sections: string[] = [];
	for (const [title, types] of SECTIONS) {
		const lines = commits
			.filter((commit) => types.includes(commit.type))
			.map(
				(commit) => `- ${commit.scope ? `**${commit.scope}:** ` : ""}${commit.description}`,
			);
		if (lines.length > 0) {
			sections.push(`### ${title}\n\n${lines.join("\n")}`);
		}
	}
	return sections.join("\n\n");
}

export function planRelease(
	current: string,
	subjects: readonly string[],
	override: Bump | "auto" = "auto",
): ReleasePlan {
	const commits = subjects
		.map(parseCommit)
		.filter((commit): commit is ParsedCommit => commit !== null);
	const bump = override === "auto" ? largestBump(commits.map((commit) => commit.bump)) : override;
	return {
		bump,
		current,
		version: bump === "none" ? null : nextVersion(current, bump),
		notes: releaseNotes(commits),
	};
}

/** Puts a release section into the changelog: under "## [Unreleased]" when present, else on top. */
export function updateChangelog(
	changelog: string,
	version: string,
	date: string,
	notes: string,
): string {
	const heading = `## [${version}] - ${date}`;
	const body = notes ? `${heading}\n\n${notes}\n` : `${heading}\n`;
	const unreleased = /^## \[Unreleased\][^\n]*\n/m;
	if (unreleased.test(changelog)) {
		return changelog.replace(unreleased, `## [Unreleased]\n\n${body}`);
	}
	const firstRelease = changelog.search(/^## /m);
	return firstRelease === -1
		? `${changelog.trimEnd()}\n\n${body}`
		: `${changelog.slice(0, firstRelease)}${body}\n${changelog.slice(firstRelease)}`;
}

async function git(...args: string[]): Promise<string> {
	const process = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe" });
	const output = await new Response(process.stdout).text();
	return (await process.exited) === 0 ? output.trim() : "";
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const bumpIndex = args.indexOf("--bump");
	const override = (bumpIndex === -1 ? "auto" : args[bumpIndex + 1]) as Bump | "auto";
	if (!["auto", "major", "minor", "patch"].includes(override)) {
		throw new Error(`--bump must be auto, major, minor or patch, not "${override}".`);
	}
	const manifest = JSON.parse(await readFile("manifest.json", "utf8")) as { version: string };
	const lastTag = await git(
		"describe",
		"--tags",
		"--abbrev=0",
		"--match",
		"[0-9]*.[0-9]*.[0-9]*",
	);
	const range = lastTag ? `${lastTag}..HEAD` : "HEAD";
	const subjects = (await git("log", range, "--format=%s")).split("\n").filter(Boolean);
	const plan = planRelease(lastTag || manifest.version, subjects, override);
	console.info(
		JSON.stringify({ lastTag: lastTag || null, commits: subjects.length, ...plan }, null, 2),
	);

	if (plan.version && args.includes("--changelog")) {
		const date = new Date().toISOString().slice(0, 10);
		const changelog = await readFile("CHANGELOG.md", "utf8").catch(() => "# Changelog\n");
		await writeFile("CHANGELOG.md", updateChangelog(changelog, plan.version, date, plan.notes));
	}
	await writeFile("RELEASE_NOTES.md", `${plan.notes || "Maintenance release."}\n`);
	const output = process.env.GITHUB_OUTPUT;
	if (output) {
		await appendFile(
			output,
			[
				`release=${plan.version ? "true" : "false"}`,
				`version=${plan.version ?? ""}`,
				`tag=${plan.version ?? ""}`,
				`bump=${plan.bump}`,
				"",
			].join("\n"),
		);
	}
}

if (import.meta.main) {
	await main();
}

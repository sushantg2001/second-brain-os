/**
 * Checks that a pushed tag is a release the pipeline may publish, and writes RELEASE_NOTES.md.
 *
 * The version files and CHANGELOG.md are committed by `make release` on a maintainer's machine,
 * so the tag must agree with what is in the tree it points at. The release notes are that
 * version's CHANGELOG.md section.
 *
 * Usage: bun scripts/release-check.ts <tag>
 */
import { readFile, writeFile } from "node:fs/promises";

export interface VersionFiles {
	readonly pkg: { readonly version?: unknown };
	readonly manifest: { readonly version?: unknown; readonly minAppVersion?: unknown };
	readonly versions: Readonly<Record<string, unknown>>;
}

/** What is wrong between the tag and the version files. Empty means they agree. */
export function versionProblems(tag: string, files: VersionFiles): string[] {
	const problems: string[] = [];
	if (files.pkg.version !== tag) {
		problems.push(`package.json says ${String(files.pkg.version)}`);
	}
	if (files.manifest.version !== tag) {
		problems.push(`manifest.json says ${String(files.manifest.version)}`);
	}
	if (files.versions[tag] !== files.manifest.minAppVersion) {
		problems.push(
			`versions.json has no "${tag}": "${String(files.manifest.minAppVersion)}" entry`,
		);
	}
	return problems;
}

/** The text under "## [version]" up to the next "## " heading, or null when there is none. */
export function changelogSection(changelog: string, version: string): string | null {
	const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const heading = new RegExp(`^## \\[${escaped}\\][^\\n]*\\n`, "m").exec(changelog);
	if (!heading) {
		return null;
	}
	const rest = changelog.slice(heading.index + heading[0].length);
	const next = rest.search(/^## /m);
	return (next === -1 ? rest : rest.slice(0, next)).trim();
}

async function readJson<T>(path: string): Promise<T> {
	return JSON.parse(await readFile(path, "utf8")) as T;
}

async function main(): Promise<void> {
	const tag = process.argv[2] ?? "";
	if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(tag)) {
		throw new Error(`Expected a tag like 2.0.0 or 2.0.0-alpha.1, got "${tag}".`);
	}
	const [pkg, manifest, versions] = await Promise.all([
		readJson<VersionFiles["pkg"]>("package.json"),
		readJson<VersionFiles["manifest"]>("manifest.json"),
		readJson<VersionFiles["versions"]>("versions.json"),
	]);
	const problems = versionProblems(tag, { pkg, manifest, versions });
	const changelog = await readFile("CHANGELOG.md", "utf8").catch(() => "");
	const notes = changelogSection(changelog, tag);
	if (notes === null) {
		problems.push(`CHANGELOG.md has no "## [${tag}]" section`);
	}
	if (problems.length > 0) {
		throw new Error(
			`Tag ${tag} does not match its tree:\n- ${problems.join("\n- ")}\nRelease with \`make release\`, which writes all of these.`,
		);
	}
	await writeFile("RELEASE_NOTES.md", `${notes || "Maintenance release."}\n`);
	console.info(`Tag ${tag} matches the version files and the changelog.`);
}

if (import.meta.main) {
	await main();
}

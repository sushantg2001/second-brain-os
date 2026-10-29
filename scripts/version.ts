/**
 * Sets one release version in package.json, manifest.json and versions.json.
 * Usage: bun scripts/version.ts <major|minor|patch|x.y.z|x.y.z-pre.N>
 * A pre-release version must be given explicitly; bumps start from a plain x.y.z.
 */
import { readFile, writeFile } from "node:fs/promises";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const EXPLICIT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/;

export function nextVersion(current: string, bump: string): string {
	if (EXPLICIT.test(bump)) {
		return bump;
	}
	const match = SEMVER.exec(current);
	if (!match) {
		throw new Error(`Current version "${current}" is not x.y.z.`);
	}
	const [major, minor, patch] = match.slice(1).map(Number) as [number, number, number];
	switch (bump) {
		case "major":
			return `${major + 1}.0.0`;
		case "minor":
			return `${major}.${minor + 1}.0`;
		case "patch":
			return `${major}.${minor}.${patch + 1}`;
		default:
			throw new Error(`Expected major, minor, patch or x.y.z, got "${bump}".`);
	}
}

async function readJson(path: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

async function writeJson(path: string, data: unknown): Promise<void> {
	await writeFile(path, `${JSON.stringify(data, null, "\t")}\n`);
}

if (import.meta.main) {
	const bump = process.argv[2] ?? "";
	const [pkg, manifest, versions] = await Promise.all([
		readJson("package.json"),
		readJson("manifest.json"),
		readJson("versions.json"),
	]);
	const version = nextVersion(String(manifest.version), bump);
	pkg.version = version;
	manifest.version = version;
	versions[version] = manifest.minAppVersion;
	await Promise.all([
		writeJson("package.json", pkg),
		writeJson("manifest.json", manifest),
		writeJson("versions.json", versions),
	]);
	console.info(version);
}

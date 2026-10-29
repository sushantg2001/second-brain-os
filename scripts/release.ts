/**
 * Cuts a release on your machine: version files, changelog, a signed commit and a signed tag.
 *
 * `main` and every tag only accept hardware-key signatures, so the pipeline cannot make the
 * version commit or the tag. You do, then push both; the release workflow publishes that tag.
 *
 * Usage: bun scripts/release.ts [auto|major|minor|patch]
 *
 * The version comes from the Conventional Commits since the last tag (see release-plan.ts).
 * It stops, changing nothing, unless you are on a clean `main` that matches origin and the
 * gates pass. Nothing is pushed.
 */
import { rm } from "node:fs/promises";

const FILES = ["package.json", "manifest.json", "versions.json", "CHANGELOG.md"];
const BUMPS = ["auto", "major", "minor", "patch"];

function fail(message: string): never {
	console.error(`release: ${message}`);
	process.exit(1);
}

/** Runs a command with the terminal attached, so a key touch prompt reaches you. */
async function run(command: string[]): Promise<void> {
	const process = Bun.spawn(command, { stdout: "inherit", stderr: "inherit", stdin: "inherit" });
	if ((await process.exited) !== 0) {
		throw new Error(`${command.join(" ")} failed`);
	}
}

async function capture(command: string[]): Promise<string> {
	const process = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
	const output = await new Response(process.stdout).text();
	if ((await process.exited) !== 0) {
		throw new Error(`${command.join(" ")} failed`);
	}
	return output.trim();
}

async function main(): Promise<void> {
	const bump = process.argv[2] ?? "auto";
	if (!BUMPS.includes(bump)) {
		fail(`bump must be one of ${BUMPS.join(", ")}, not "${bump}".`);
	}

	const branch = await capture(["git", "branch", "--show-current"]);
	if (branch !== "main") {
		fail(`releases are cut on main, you are on "${branch}".`);
	}
	if (await capture(["git", "status", "--porcelain"])) {
		fail("the working tree has changes. Commit or stash them first.");
	}
	await run(["git", "fetch", "--quiet", "origin", "main"]);
	if (
		(await capture(["git", "rev-parse", "HEAD"])) !==
		(await capture(["git", "rev-parse", "origin/main"]))
	) {
		fail("main differs from origin/main. Pull or push first.");
	}

	const plan = JSON.parse(await capture(["bun", "scripts/release-plan.ts", "--bump", bump])) as {
		version: string | null;
	};
	await rm("RELEASE_NOTES.md", { force: true });
	if (!plan.version) {
		console.info("No release: only docs, test or ci changes since the last tag.");
		return;
	}
	const { version } = plan;
	if (await capture(["git", "tag", "--list", version])) {
		fail(`tag ${version} already exists.`);
	}

	const pinned = (await Bun.file(".bun-version").text()).trim();
	if (Bun.version !== pinned) {
		console.warn(
			`release: CI runs Bun ${pinned} and this is ${Bun.version}. Gates can differ; install Bun ${pinned} if they fail.`,
		);
	}
	console.info(`Releasing ${version}. Running every gate first.`);
	await run(["make", "check"]);

	let committed = false;
	try {
		await run(["bun", "scripts/release-plan.ts", "--bump", bump, "--changelog"]);
		await run(["bun", "scripts/version.ts", version]);
		await run(["bunx", "prettier", "--write", ...FILES]);
		await run(["git", "add", ...FILES]);
		console.info("Signing the release commit, then the tag. Touch the key for each.");
		await run(["git", "commit", "-S", "-m", `chore(release): ${version}`]);
		committed = true;
		await run(["git", "tag", "-s", version, "-m", version]);
	} catch (error) {
		if (committed) {
			console.error(
				`The release commit exists but the tag does not. Tag it with \`git tag -s ${version} -m ${version}\`, or undo with \`git reset --hard origin/main\`.`,
			);
		} else {
			await run([
				"git",
				"restore",
				"--staged",
				"--worktree",
				"--source=HEAD",
				...FILES,
			]).catch(() => undefined);
		}
		throw error;
	} finally {
		await rm("RELEASE_NOTES.md", { force: true });
	}

	console.info(
		`\nReleased ${version} locally. Publish it with:\n\n  git push --atomic origin main ${version}\n`,
	);
}

await main().catch((error: unknown) =>
	fail(error instanceof Error ? error.message : String(error)),
);

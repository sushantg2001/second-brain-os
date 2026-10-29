/**
 * Verifies the production bundle in dist/ without running Obsidian:
 *  - main.js stays inside the size budget,
 *  - it evaluates as CommonJS and only requires modules Obsidian provides,
 *  - its default export is a Plugin subclass with an onload method,
 *  - styles.css exists and dist/manifest.json matches manifest.json.
 */
import { readFile, stat } from "node:fs/promises";
import { runInNewContext } from "node:vm";

import { EXTERNALS, OUT_DIR } from "./build";

export const MAX_MAIN_BYTES = 400 * 1024;

class StubPlugin {}

function fail(message: string): never {
	console.error(`check-bundle: ${message}`);
	process.exit(1);
}

/** A stand-in for every class the obsidian typings export, so module-level `extends` works. */
async function createObsidianStub(): Promise<Record<string, unknown>> {
	const typings = await readFile("node_modules/obsidian/obsidian.d.ts", "utf8");
	const stub: Record<string, unknown> = {};
	for (const [, name] of typings.matchAll(/^export (?:abstract )?class (\w+)/gm)) {
		if (name) {
			stub[name] = class {};
		}
	}
	stub.Plugin = StubPlugin;
	return stub;
}

async function main(): Promise<void> {
	const mainPath = `${OUT_DIR}/main.js`;
	const size = (await stat(mainPath).catch(() => fail(`${mainPath} is missing; run make build`)))
		.size;
	if (size > MAX_MAIN_BYTES) {
		fail(`${mainPath} is ${size} bytes, over the ${MAX_MAIN_BYTES} byte budget.`);
	}

	const obsidian = await createObsidianStub();
	const required = new Set<string>();
	const allowed = new Set(EXTERNALS);
	const module = { exports: {} as Record<string, unknown> };
	const require = (id: string): unknown => {
		required.add(id);
		if (!allowed.has(id)) {
			fail(`bundle requires "${id}", which Obsidian does not provide.`);
		}
		return id === "obsidian" ? obsidian : {};
	};
	runInNewContext(await readFile(mainPath, "utf8"), {
		module,
		exports: module.exports,
		require,
		console,
		setTimeout,
		clearTimeout,
		queueMicrotask,
		// No MessageChannel: React's scheduler would open a port at load and keep the process alive.
	});

	const pluginClass = module.exports.default;
	if (typeof pluginClass !== "function") {
		fail("main.js has no default export class.");
	}
	const prototype = (pluginClass as { prototype: unknown }).prototype;
	if (!(prototype instanceof StubPlugin)) {
		fail("the default export does not extend Plugin from obsidian.");
	}
	if (typeof (prototype as { onload?: unknown }).onload !== "function") {
		fail("the default export has no onload method.");
	}

	await stat(`${OUT_DIR}/styles.css`).catch(() => fail("styles.css is missing."));
	const [source, built] = await Promise.all([
		readFile("manifest.json", "utf8"),
		readFile(`${OUT_DIR}/manifest.json`, "utf8"),
	]);
	if (source !== built) {
		fail("dist/manifest.json differs from manifest.json; rebuild.");
	}

	const percent = Math.round((size / MAX_MAIN_BYTES) * 100);
	console.info(
		`check-bundle: main.js ${(size / 1024).toFixed(1)} KB (${percent}% of budget), requires: ${[...required].join(", ") || "nothing"}.`,
	);
}

await main();
process.exit(0);

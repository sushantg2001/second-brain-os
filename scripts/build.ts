/**
 * Builds the plugin into dist/: main.js (CommonJS, as Obsidian requires), styles.css and
 * manifest.json. Flags: --dev (unminified, inline source maps) and --watch (dev + rebuild).
 */
import { copyFile, mkdir, watch, writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";

export const OUT_DIR = "dist";

/** Modules Obsidian provides at runtime. They must stay `require` calls in the bundle. */
export const EXTERNALS = [
	"obsidian",
	"electron",
	"@codemirror/autocomplete",
	"@codemirror/collab",
	"@codemirror/commands",
	"@codemirror/language",
	"@codemirror/lint",
	"@codemirror/search",
	"@codemirror/state",
	"@codemirror/view",
	"@lezer/common",
	"@lezer/highlight",
	"@lezer/lr",
	...builtinModules,
	...builtinModules.map((name) => `node:${name}`),
];

const BANNER =
	"/* Second Brain OS: bundled file. Source: https://github.com/sushantg2001/second-brain-os */";

async function buildOnce(production: boolean): Promise<boolean> {
	await mkdir(OUT_DIR, { recursive: true });
	const [script, styles] = await Promise.all([
		Bun.build({
			entrypoints: ["src/main.ts"],
			outdir: OUT_DIR,
			naming: "main.js",
			target: "browser",
			format: "cjs",
			external: EXTERNALS,
			minify: production,
			sourcemap: production ? "none" : "inline",
			banner: BANNER,
			define: {
				"process.env.NODE_ENV": JSON.stringify(production ? "production" : "development"),
			},
		}),
		Bun.build({
			entrypoints: ["src/styles/index.css"],
			outdir: OUT_DIR,
			naming: "styles.css",
			minify: production,
		}),
	]);

	let success = true;
	for (const result of [script, styles]) {
		if (!result.success) {
			success = false;
			for (const log of result.logs) {
				console.error(log);
			}
		}
	}
	if (!success) {
		return false;
	}

	await copyFile("manifest.json", `${OUT_DIR}/manifest.json`);
	if (!production) {
		// Picked up by the Hot Reload community plugin in a dev vault.
		await writeFile(`${OUT_DIR}/.hotreload`, "");
	}
	return true;
}

async function watchAndRebuild(): Promise<never> {
	await buildOnce(false);
	console.info("Watching src/ and manifest.json for changes...");
	let timer: ReturnType<typeof setTimeout> | undefined;
	const schedule = (): void => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			void buildOnce(false).then((ok) => {
				console.info(ok ? `Rebuilt at ${new Date().toLocaleTimeString()}` : "Build failed");
			});
		}, 100);
	};
	void (async () => {
		for await (const _ of watch("manifest.json")) {
			schedule();
		}
	})();
	for await (const _ of watch("src", { recursive: true })) {
		schedule();
	}
	throw new Error("Watcher stopped unexpectedly.");
}

if (import.meta.main) {
	const args = new Set(process.argv.slice(2));
	if (args.has("--watch")) {
		await watchAndRebuild();
	}
	const ok = await buildOnce(!args.has("--dev"));
	process.exit(ok ? 0 : 1);
}

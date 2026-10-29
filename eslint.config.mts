import boundaries from "eslint-plugin-boundaries";
// @ts-expect-error -- jsx-a11y ships no type declarations.
import jsxA11y from "eslint-plugin-jsx-a11y";
import obsidianmd from "eslint-plugin-obsidianmd";
import reactHooks from "eslint-plugin-react-hooks";
import type { ESLint, Linter } from "eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

/** Layers, innermost first. docs/architecture.md explains each one. */
const ELEMENTS = [
	{ type: "app", pattern: "src/app" },
	{ type: "feature", pattern: "src/features/*", capture: ["feature"] },
	{ type: "infrastructure", pattern: "src/infrastructure/*", capture: ["adapter"] },
	{ type: "shared-react", pattern: "src/shared/react" },
	{ type: "kernel", pattern: "src/shared/kernel" },
];

// jsx-a11y ships no types.
const a11y = jsxA11y as unknown as ESLint.Plugin & {
	flatConfigs: { recommended: { rules: Linter.RulesRecord } };
};

type Pattern = { group: string[]; message: string };

/** Another element is reached only through its index.ts. Relative imports inside an element are fine. */
const PUBLIC_API_ONLY: Pattern = {
	group: ["**/shared/kernel/*", "**/shared/react/*", "**/infrastructure/*/*", "**/features/*/*"],
	message: "Import another module through its index.ts.",
};

const restrictImports = (...patterns: Pattern[]): Linter.RuleEntry => [
	"error",
	{ patterns: [PUBLIC_API_ONLY, ...patterns] },
];

const allowTo = (...types: string[]) => ({ to: { element: { types: { anyOf: types } } } });

export default defineConfig(
	globalIgnores(["node_modules", "dist", "coverage", "main.js", "package.json", "versions.json"]),
	{
		languageOptions: {
			globals: { ...globals.browser },
			parserOptions: {
				projectService: { allowDefaultProject: ["manifest.json"] },
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: [".json"],
			},
		},
	},
	...obsidianmd.configs.recommended,
	// TypeScript already checks globals such as Bun, process and expect.
	{ rules: { "no-undef": "off" } },
	{
		files: ["src/**/*.{ts,tsx}"],
		plugins: {
			boundaries,
			"react-hooks": reactHooks as unknown as ESLint.Plugin,
			"jsx-a11y": a11y,
		},
		settings: {
			"boundaries/elements": ELEMENTS,
			"boundaries/ignore": ["src/main.ts"],
			"import/resolver": { node: { extensions: [".ts", ".tsx"] } },
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			...a11y.flatConfigs.recommended.rules,
			"boundaries/no-unknown-files": "error",
			"obsidianmd/ui/sentence-case": [
				"warn",
				{ enforceCamelCaseLower: true, acronyms: ["PPV"] },
			],
			"@typescript-eslint/no-restricted-imports": restrictImports(),
			"boundaries/dependencies": [
				"error",
				{
					default: "disallow",
					policies: [
						{
							from: { element: { type: "app" } },
							allow: allowTo(
								"app",
								"feature",
								"infrastructure",
								"shared-react",
								"kernel",
							),
						},
						// Features talk to each other only through the other feature's index.ts.
						{
							from: { element: { type: "feature" } },
							allow: allowTo("feature", "shared-react", "kernel"),
						},
						// Adapters implement ports that features declare.
						{
							from: { element: { type: "infrastructure" } },
							allow: allowTo("infrastructure", "feature", "kernel"),
						},
						{
							from: { element: { type: "shared-react" } },
							allow: allowTo("shared-react", "kernel"),
						},
						{ from: { element: { type: "kernel" } }, allow: allowTo("kernel") },
					],
				},
			],
		},
	},
	{
		// Pure code: no host, no UI. This keeps it testable without the Obsidian mock.
		files: ["src/shared/kernel/**", "src/features/*/domain/**"],
		rules: {
			"@typescript-eslint/no-restricted-imports": restrictImports(
				{
					group: ["obsidian", "react", "react-dom", "react/*"],
					message: "Domain code must stay pure.",
				},
				{
					group: ["**/application", "**/application/*", "**/ui", "**/ui/*"],
					message: "Domain must not depend on outer layers.",
				},
			),
		},
	},
	{
		files: ["src/features/*/application/**"],
		rules: {
			"@typescript-eslint/no-restricted-imports": restrictImports(
				{
					group: ["obsidian", "react", "react-dom"],
					message: "Use a port; adapters live in infrastructure.",
				},
				{ group: ["**/ui", "**/ui/*"], message: "Application code must not depend on UI." },
			),
		},
	},
	{
		// The declarative settings API needs Obsidian 1.13; minAppVersion is 1.7.2, so the tab
		// must keep using display(). Revisit when minAppVersion reaches 1.13.
		files: ["src/app/settings-tab.ts"],
		rules: {
			"obsidianmd/settings-tab/prefer-setting-definitions": "off",
			"@typescript-eslint/no-deprecated": "off",
		},
	},
	{
		files: ["tests/**", "scripts/**", "eslint.config.mts"],
		rules: {
			"obsidianmd/prefer-create-el": "off",
			"obsidianmd/prefer-instanceof": "off",
			"obsidianmd/no-tfile-tfolder-cast": "off",
			"obsidianmd/no-nodejs-modules": "off",
			"obsidianmd/no-global-this": "off",
			"obsidianmd/rule-custom-message": "off",
			"@typescript-eslint/no-restricted-imports": "off",
			"obsidianmd/prefer-window-timers": "off",
			// Tests drive the mock vault directly.
			"obsidianmd/prefer-file-manager-trash-file": "off",
			"no-console": "off",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{ varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
			],
		},
	},
);

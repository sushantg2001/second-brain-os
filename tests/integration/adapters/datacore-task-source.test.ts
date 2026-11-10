import { describe, expect, it } from "bun:test";
import type { Plugin as ObsidianPlugin } from "obsidian";

import { createContainer } from "../../../src/app/container";
import { DatacoreTaskSource } from "../../../src/infrastructure/datacore";
import { asObsidianApp, createTestApp } from "../../fakes/fake-obsidian-app";
import { READY_PLUGINS } from "../../fakes/fake-plugin-registry";
import { FixedClock } from "../../fakes/fixed-clock";
import { sleep } from "../../fakes/plugin-harness";
import { Plugin, type App } from "../../mocks/obsidian";

interface FakeApi {
	readonly query: (query: string) => readonly { $file?: string }[];
	readonly core: { initialized: boolean };
}

/** An app with a Datacore whose `@task` query returns the given files. */
async function withDatacore(
	api: Partial<FakeApi> | undefined,
	files: Record<string, string> = {},
): Promise<App> {
	const app = await createTestApp({ files, plugins: READY_PLUGINS });
	if (api) {
		app.plugins.plugins["datacore"] = { api };
	}
	return app;
}

const FAST = { timeoutMs: 40, pollMs: 5 };

describe("DatacoreTaskSource", () => {
	it("names the notes Datacore lists tasks in, once each", async () => {
		const queries: string[] = [];
		const app = await withDatacore({
			core: { initialized: true },
			query: (query) => {
				queries.push(query);
				return [{ $file: "a.md" }, { $file: "b.md" }, { $file: "a.md" }, {}];
			},
		});
		const paths = await new DatacoreTaskSource(asObsidianApp(app), FAST).paths();
		expect(queries).toEqual(["@task"]);
		expect([...(paths ?? [])].sort()).toEqual(["a.md", "b.md"]);
	});

	it("says nothing when Datacore is not there or has no query", async () => {
		const missing = await withDatacore(undefined);
		expect(await new DatacoreTaskSource(asObsidianApp(missing), FAST).paths()).toBeNull();
		const noQuery = await withDatacore({ core: { initialized: true } });
		expect(await new DatacoreTaskSource(asObsidianApp(noQuery), FAST).paths()).toBeNull();
	});

	it("waits for Datacore to finish indexing", async () => {
		const core = { initialized: false };
		const app = await withDatacore({ core, query: () => [{ $file: "late.md" }] });
		setTimeout(() => {
			core.initialized = true;
		}, 15);
		const paths = await new DatacoreTaskSource(asObsidianApp(app), FAST).paths();
		expect([...(paths ?? [])]).toEqual(["late.md"]);
	});

	it("gives up when Datacore is still indexing after the timeout", async () => {
		const app = await withDatacore({ core: { initialized: false }, query: () => [] });
		expect(await new DatacoreTaskSource(asObsidianApp(app), FAST).paths()).toBeNull();
	});

	it("says nothing when the query fails", async () => {
		const app = await withDatacore({
			core: { initialized: true },
			query: () => {
				throw new Error("Failed to parse query");
			},
		});
		expect(await new DatacoreTaskSource(asObsidianApp(app), FAST).paths()).toBeNull();
	});
});

describe("the task index in the plugin", () => {
	const files = {
		"has-tasks.md": "- [ ] 09:00 - 10:00 Write spec",
		"also-tasks.md": "- [ ] Other",
		"plain.md": "No tasks here",
	};

	async function rebuild(api: Partial<FakeApi> | undefined) {
		const app = await withDatacore(api, files);
		const plugin = new Plugin(app) as unknown as ObsidianPlugin;
		const container = createContainer(plugin, { clock: new FixedClock("2026-10-29") });
		const read: string[] = [];
		const original = container.notes.read.bind(container.notes);
		(container.notes as { read: typeof container.notes.read }).read = (path) => {
			read.push(path);
			return original(path);
		};
		await container.tasks.rebuild();
		return { container, read };
	}

	it("asks Datacore which notes to read", async () => {
		const { container, read } = await rebuild({
			core: { initialized: true },
			query: () => [{ $file: "has-tasks.md" }],
		});
		expect(read).toEqual(["has-tasks.md"]);
		expect(container.tasks.tasksIn("has-tasks.md")).toHaveLength(1);
	});

	it("reads every note when Datacore cannot say", async () => {
		const { container, read } = await rebuild(undefined);
		await sleep(0);
		expect([...read].sort()).toEqual(["also-tasks.md", "has-tasks.md", "plain.md"]);
		expect(container.tasks.tasksIn("also-tasks.md")).toHaveLength(1);
	});
});

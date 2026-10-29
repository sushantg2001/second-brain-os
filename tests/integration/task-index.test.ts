import { describe, expect, it } from "bun:test";

import { TaskActions, TaskIndex } from "../../src/features/tasks";
import { VaultNoteStore } from "../../src/infrastructure/obsidian";
import { TasksPluginToggler } from "../../src/infrastructure/tasks";
import { asObsidianApp, createTestApp } from "../fakes/fake-obsidian-app";
import { FixedClock } from "../fakes/fixed-clock";
import { sleep } from "../fakes/plugin-harness";

async function setup(files: Record<string, string>) {
	const app = await createTestApp({ files });
	const notes = new VaultNoteStore(asObsidianApp(app));
	const index = new TaskIndex(notes);
	await index.rebuild();
	const detach = index.attach();
	return { app, notes, index, detach };
}

describe("TaskIndex", () => {
	it("indexes only notes with tasks", async () => {
		const { index } = await setup({
			"a.md": "- [ ] One ⏳ 2026-10-29\n- [x] Two",
			"b.md": "No tasks here\n- plain item",
			"c.md": "- [ ] Three ⏳ 2026-10-30",
		});
		expect([...index.snapshot.get().byPath.keys()].sort()).toEqual(["a.md", "c.md"]);
		expect(index.tasksIn("a.md").map((task) => task.text)).toEqual([
			"One ⏳ 2026-10-29",
			"Two",
		]);
		expect(index.tasksIn("b.md")).toEqual([]);
		expect(index.scheduledOn("2026-10-29").map((task) => task.path)).toEqual(["a.md"]);
	});

	it("follows creates, edits, renames and deletes", async () => {
		const { app, index, detach } = await setup({ "a.md": "- [ ] One" });
		const versions: number[] = [];
		index.snapshot.subscribe(() => versions.push(index.snapshot.get().version));

		await app.vault.create("new.md", "- [ ] Fresh");
		await sleep(0);
		expect(index.tasksIn("new.md")).toHaveLength(1);

		const file = app.vault.getFileByPath("a.md");
		if (!file) {
			throw new Error("missing");
		}
		await app.vault.modify(file, "- [ ] One\n- [ ] Two");
		await sleep(0);
		expect(index.tasksIn("a.md")).toHaveLength(2);

		await app.vault.rename(file, "moved.md");
		await sleep(0);
		expect(index.tasksIn("a.md")).toEqual([]);
		expect(index.tasksIn("moved.md")).toHaveLength(2);

		await app.vault.modify(file, "no more tasks");
		await sleep(0);
		expect(index.snapshot.get().byPath.has("moved.md")).toBe(false);

		await app.vault.delete(file);
		await sleep(0);
		detach();
		await app.vault.create("later.md", "- [ ] Ignored");
		await sleep(0);
		expect(index.tasksIn("later.md")).toEqual([]);
		expect(versions.length).toBeGreaterThan(3);
	});

	it("skips updates for notes that never had tasks", async () => {
		const { index } = await setup({ "a.md": "text" });
		const before = index.snapshot.get();
		await index.update("a.md");
		await index.update("gone.md");
		expect(index.snapshot.get()).toBe(before);
	});
});

describe("TaskActions", () => {
	it("toggles with the Tasks plugin when it is available", async () => {
		const { app, notes, index } = await setup({ "a.md": "- [ ] Water plants 🔁 every day" });
		const seen: string[] = [];
		app.plugins.plugins["obsidian-tasks-plugin"] = {
			apiV1: {
				executeToggleTaskDoneCommand: (line: string, path: string) => {
					seen.push(`${path}|${line}`);
					return "- [ ] Water plants 🔁 every day\n- [x] Water plants 🔁 every day ✅ 2026-10-29";
				},
			},
		};
		const actions = new TaskActions(
			notes,
			new FixedClock(),
			new TasksPluginToggler(asObsidianApp(app)),
		);
		const task = index.tasksIn("a.md")[0];
		if (!task) {
			throw new Error("missing");
		}
		expect((await actions.toggleDone(task)).ok).toBe(true);
		expect(seen).toEqual(["a.md|- [ ] Water plants 🔁 every day"]);
		expect(app.vault.contentOf("a.md")).toBe(
			"- [ ] Water plants 🔁 every day\n- [x] Water plants 🔁 every day ✅ 2026-10-29",
		);
	});

	it("falls back to its own toggle when Tasks is missing or fails", async () => {
		const { app, notes, index } = await setup({ "a.md": "- [ ] One\n- [ ] Two" });
		const toggler = new TasksPluginToggler(asObsidianApp(app));
		const actions = new TaskActions(notes, new FixedClock("2026-10-29"), toggler);
		const [one, two] = index.tasksIn("a.md");
		if (!one || !two) {
			throw new Error("missing");
		}
		await actions.toggleDone(one);
		app.plugins.plugins["obsidian-tasks-plugin"] = {
			apiV1: {
				executeToggleTaskDoneCommand: () => {
					throw new Error("boom");
				},
			},
		};
		await actions.toggleDone(two);
		expect(app.vault.contentOf("a.md")).toBe(
			"- [x] One ✅ 2026-10-29\n- [x] Two ✅ 2026-10-29",
		);
	});

	it("refuses to edit a line that is not a task", async () => {
		const { app, notes } = await setup({ "a.md": "- plain" });
		const actions = new TaskActions(notes, new FixedClock(), null);
		const result = await actions.toggleDone({ path: "a.md", line: 0, raw: "- plain" });
		expect(!result.ok && result.error.message).toBe("That line is not a task.");
		expect(app.vault.contentOf("a.md")).toBe("- plain");
	});
});

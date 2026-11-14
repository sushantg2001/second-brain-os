import { describe, expect, it } from "bun:test";

import { TaskActions } from "../../src/features/tasks";
import { DataviewTaskIndex } from "../../src/infrastructure/dataview";
import { VaultNoteStore } from "../../src/infrastructure/obsidian";
import { TasksPluginToggler } from "../../src/infrastructure/tasks";
import { installDataview } from "../fakes/fake-dataview";
import { asObsidianApp, createTestApp } from "../fakes/fake-obsidian-app";
import { FixedClock } from "../fakes/fixed-clock";
import { sleep } from "../fakes/plugin-harness";

async function setup(files: Record<string, string>, options: { dataview?: boolean } = {}) {
	const app = await createTestApp({ files, dataview: options.dataview ?? true });
	const notes = new VaultNoteStore(asObsidianApp(app));
	const index = new DataviewTaskIndex(asObsidianApp(app), { debounceMs: 0 });
	const detach = index.attach();
	return { app, notes, index, detach };
}

describe("DataviewTaskIndex", () => {
	it("reports the tasks Dataview indexed, and only for notes that have one", async () => {
		const { index } = await setup({
			"a.md": "- [ ] One ⏳ 2026-10-29\n- [x] Two",
			"b.md": "No tasks here\n- plain item",
			"c.md": "- [ ] Three ⏳ 2026-10-30",
		});
		await index.ready;
		expect([...index.all()].map((task) => task.path)).toEqual(["a.md", "a.md", "c.md"]);
		expect(index.tasksIn("a.md").map((task) => task.text)).toEqual([
			"One ⏳ 2026-10-29",
			"Two",
		]);
		expect(index.tasksIn("b.md")).toEqual([]);
		expect(index.scheduledOn("2026-10-29").map((task) => task.path)).toEqual(["a.md"]);
	});

	it("follows creates, edits, renames and deletes that Dataview reports", async () => {
		const { app, index, detach } = await setup({ "a.md": "- [ ] One" });
		const versions: number[] = [];
		index.snapshot.subscribe(() => versions.push(index.snapshot.get().version));

		await app.vault.create("new.md", "- [ ] Fresh");
		expect(index.tasksIn("new.md")).toHaveLength(1);

		const file = app.vault.getFileByPath("a.md");
		if (!file) {
			throw new Error("missing");
		}
		await app.vault.modify(file, "- [ ] One\n- [ ] Two");
		expect(index.tasksIn("a.md")).toHaveLength(2);

		await app.vault.rename(file, "moved.md");
		expect(index.tasksIn("a.md")).toEqual([]);
		expect(index.tasksIn("moved.md")).toHaveLength(2);

		await app.vault.modify(file, "no more tasks");
		expect(index.tasksIn("moved.md")).toEqual([]);
		expect([...index.all()].map((task) => task.path)).toEqual(["new.md"]);

		await app.vault.delete(file);
		detach();
		const before = versions.length;
		await app.vault.create("later.md", "- [ ] Ignored");
		expect(versions).toHaveLength(before);
		expect(versions.length).toBeGreaterThan(3);
	});

	it("announces a burst of changes once", async () => {
		const app = await createTestApp({ files: { "a.md": "- [ ] One" } });
		const index = new DataviewTaskIndex(asObsidianApp(app), { debounceMs: 10 });
		index.attach();
		await index.ready;
		const versions: number[] = [];
		index.snapshot.subscribe(() => versions.push(index.snapshot.get().version));
		for (const name of ["b.md", "c.md", "d.md"]) {
			await app.vault.create(name, "- [ ] New");
		}
		expect(versions).toEqual([]);
		await sleep(30);
		expect(versions).toHaveLength(1);
		expect(index.tasksIn("d.md")).toHaveLength(1);
	});

	it("stays empty until Dataview has indexed the vault, then catches up", async () => {
		const app = await createTestApp({ files: { "a.md": "- [ ] One" }, dataview: false });
		const index = new DataviewTaskIndex(asObsidianApp(app), { debounceMs: 0 });
		index.attach();
		expect(index.tasksIn("a.md")).toEqual([]);
		expect([...index.all()]).toEqual([]);
		let ready = false;
		void index.ready.then(() => {
			ready = true;
		});
		await sleep(0);
		expect(ready).toBe(false);

		installDataview(app);
		await index.ready;
		expect(index.tasksIn("a.md")).toHaveLength(1);
		expect(index.snapshot.get().version).toBeGreaterThan(0);
	});

	it("stays empty when Dataview is not there at all", async () => {
		const app = await createTestApp({ files: { "a.md": "- [ ] One" }, dataview: false });
		const index = new DataviewTaskIndex(asObsidianApp(app), { debounceMs: 0 });
		const detach = index.attach();
		expect(index.tasksIn("a.md")).toEqual([]);
		detach();
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

	it("refuses to edit a line that is no longer a task", async () => {
		const { app, notes } = await setup({ "a.md": "- plain" });
		const actions = new TaskActions(notes, new FixedClock(), null);
		const result = await actions.toggleDone({
			path: "a.md",
			line: 0,
			status: " ",
			text: "plain",
		});
		expect(!result.ok && result.error.message).toBe(
			"The note changed since it was read. Try again.",
		);
		expect(app.vault.contentOf("a.md")).toBe("- plain");
	});
});

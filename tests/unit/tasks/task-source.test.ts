import { describe, expect, it } from "bun:test";

import { TaskIndex, type TaskSource } from "../../../src/features/tasks";
import { VaultNoteStore } from "../../../src/infrastructure/obsidian";
import { asObsidianApp, createTestApp } from "../../fakes/fake-obsidian-app";

const FILES = {
	"a.md": "- [ ] One",
	"b.md": "- [ ] Two",
	"c.md": "No tasks",
};

async function build(source: TaskSource | undefined) {
	const app = await createTestApp({ files: FILES });
	const notes = new VaultNoteStore(asObsidianApp(app));
	const read: string[] = [];
	const spy = {
		list: () => notes.list(),
		exists: (path: string) => notes.exists(path),
		read: (path: string) => {
			read.push(path);
			return notes.read(path);
		},
		onChange: notes.onChange.bind(notes),
	} as unknown as VaultNoteStore;
	const index = new TaskIndex(spy, source);
	await index.rebuild();
	return { app, index, read };
}

describe("TaskIndex with a task source", () => {
	it("reads only the notes the source names", async () => {
		const { index, read } = await build({ paths: async () => new Set(["a.md"]) });
		expect(read).toEqual(["a.md"]);
		expect([...index.snapshot.get().byPath.keys()]).toEqual(["a.md"]);
	});

	it("reads every note when the source cannot say", async () => {
		const { read } = await build({ paths: async () => null });
		expect([...read].sort()).toEqual(["a.md", "b.md", "c.md"]);
	});

	it("reads every note when the source fails", async () => {
		const { read, index } = await build({
			paths: () => Promise.reject(new Error("Datacore went away")),
		});
		expect([...read].sort()).toEqual(["a.md", "b.md", "c.md"]);
		expect([...index.snapshot.get().byPath.keys()].sort()).toEqual(["a.md", "b.md"]);
	});

	it("picks up a note the source did not name when it changes", async () => {
		const { app, index } = await build({ paths: async () => new Set(["a.md"]) });
		const detach = index.attach();
		await app.vault.modify(
			app.vault.getAbstractFileByPath("b.md") as never,
			"- [ ] Two\n- [ ] More",
		);
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(index.tasksIn("b.md")).toHaveLength(2);
		detach();
	});

	it("builds the same index with or without a source that names every task note", async () => {
		const named = await build({ paths: async () => new Set(["a.md", "b.md"]) });
		const all = await build(undefined);
		expect(named.index.tasksIn("a.md")).toEqual(all.index.tasksIn("a.md"));
		expect(named.index.tasksIn("b.md")).toEqual(all.index.tasksIn("b.md"));
	});
});

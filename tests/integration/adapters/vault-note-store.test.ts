import { describe, expect, it } from "bun:test";

import { SystemClock, VaultNoteStore } from "../../../src/infrastructure/obsidian";
import type { NoteChange } from "../../../src/shared/kernel";
import { asObsidianApp, createTestApp } from "../../fakes/fake-obsidian-app";

async function setup(files: Record<string, string> = {}) {
	const app = await createTestApp({ files });
	return { app, store: new VaultNoteStore(asObsidianApp(app)) };
}

describe("VaultNoteStore", () => {
	it("lists, reads and checks Markdown notes", async () => {
		const { store } = await setup({ "a.md": "A", "folder/b.md": "B", "image.png": "" });
		expect(
			store
				.list()
				.map((note) => note.path)
				.sort(),
		).toEqual(["a.md", "folder/b.md"]);
		expect(store.list().find((note) => note.path === "folder/b.md")?.basename).toBe("b");
		expect(await store.read("folder/b.md")).toBe("B");
		expect(store.exists("a.md")).toBe(true);
		expect(store.exists("folder")).toBe(false);
		expect(() => store.read("missing.md")).toThrow("Note not found: missing.md");
	});

	it("creates nested folders as needed", async () => {
		const { app, store } = await setup({ "x/existing.md": "" });
		await store.create("x/y/z/new.md", "hi");
		expect(app.vault.contentOf("x/y/z/new.md")).toBe("hi");
		await store.create("root.md", "");
		expect(store.exists("root.md")).toBe(true);
	});

	it("edits atomically", async () => {
		const { store } = await setup({ "a.md": "one" });
		expect(await store.process("a.md", (content) => `${content} two`)).toBe("one two");
		expect(await store.read("a.md")).toBe("one two");
	});

	it("reads front matter from the metadata cache", async () => {
		const { store } = await setup({
			"a.md": "---\ntype: project\nstatus: active\n---\nBody",
			"b.md": "Body",
		});
		expect(store.frontmatter("a.md")).toEqual({ type: "project", status: "active" });
		expect(store.frontmatter("b.md")).toBeNull();
		expect(store.frontmatter("missing.md")).toBeNull();
	});

	it("resolves wikilinks", async () => {
		const { store } = await setup({ "Areas/Health.md": "", "a.md": "" });
		expect(store.resolveLink("[[Health]]", "a.md")).toBe("Areas/Health.md");
		expect(store.resolveLink("Health|alias", "a.md")).toBe("Areas/Health.md");
		expect(store.resolveLink("[[Health#Goals]]", "a.md")).toBe("Areas/Health.md");
		expect(store.resolveLink("[[Nowhere]]", "a.md")).toBeNull();
		expect(store.resolveLink("[[]]", "a.md")).toBeNull();
	});

	it("reports Markdown changes until unsubscribed", async () => {
		const { app, store } = await setup({ "a.md": "" });
		const changes: NoteChange[] = [];
		const unsubscribe = store.onChange((change) => changes.push(change));
		await app.vault.create("b.md", "");
		await app.vault.create("c.png", "");
		const file = app.vault.getFileByPath("b.md");
		if (!file) {
			throw new Error("missing");
		}
		await app.vault.modify(file, "changed");
		await app.vault.rename(file, "d.md");
		await app.vault.delete(file);
		unsubscribe();
		await app.vault.create("e.md", "");
		expect(
			changes.filter((change) => change.type !== "modify" || change.path.endsWith(".md")),
		).toEqual([
			{ type: "create", path: "b.md" },
			{ type: "modify", path: "b.md" },
			{ type: "modify", path: "b.md" },
			{ type: "rename", path: "d.md", oldPath: "b.md" },
			{ type: "modify", path: "d.md" },
			{ type: "delete", path: "d.md" },
		]);
	});
});

describe("SystemClock", () => {
	it("reports the local date and time", () => {
		const clock = new SystemClock();
		const now = new Date();
		expect(clock.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(Number(clock.today().slice(0, 4))).toBe(now.getFullYear());
		expect(clock.nowMinutes()).toBeGreaterThanOrEqual(0);
		expect(clock.nowMinutes()).toBeLessThan(1440);
		expect(Math.abs(clock.now() - Date.now())).toBeLessThan(1000);
	});
});

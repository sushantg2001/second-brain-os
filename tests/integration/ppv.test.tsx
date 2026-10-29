import { describe, expect, it } from "bun:test";
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Notice } from "../mocks/obsidian";
import { loadPlugin, sleep } from "../fakes/plugin-harness";

const VAULT = {
	"PPV/Pillars/Health.md": "---\ntype: pillar\n---\n# Health",
	"PPV/Pillars/Work.md": "# Work",
	"PPV/Goals/Run a marathon.md": '---\ntype: goal\nkind: outcome\npillar: "[[Health]]"\n---\n',
	"PPV/Projects/Training plan.md": [
		"---",
		"type: project",
		"status: active",
		'goal: "[[Run a marathon]]"',
		"due: 2026-11-15",
		"---",
		"## Next actions",
		"- [x] Buy shoes",
		"- [ ] Book physio",
		"- [/] Long run",
		"\t- [clock::2026-10-28T07:00--2026-10-28T08:30]",
	].join("\n"),
	"PPV/Projects/Old site.md": '---\ntype: project\nstatus: done\npillar: "[[Work]]"\n---\n',
	"2026-10-29.md": "- [ ] Stretch [[Training plan]]",
};

async function setup(files: Record<string, string> = VAULT) {
	const harness = await loadPlugin({ files, today: "2026-10-29", minutes: 9 * 60 });
	await act(() => sleep(10));
	const content = (path: string) => harness.app.vault.contentOf(path);
	return { ...harness, content };
}

async function openDashboard(harness: Awaited<ReturnType<typeof setup>>) {
	harness.plugin.runCommand("open-ppv-dashboard");
	await act(() => sleep(0));
	const view = harness.app.workspace.getLeavesOfType("sbos-ppv-dashboard")[0]?.view;
	if (!view) {
		throw new Error("No dashboard");
	}
	document.body.append(view.containerEl);
	await act(() => sleep(0));
	return within(view.contentEl);
}

describe("PPV service", () => {
	it("indexes the tree and finds project tasks, including linked ones", async () => {
		const { container } = await setup();
		const { tree } = container.ppvIndex.snapshot.get();
		expect(tree.pillars.map((pillar) => pillar.note.title)).toEqual(["Health", "Work"]);
		expect(tree.pillars[0]?.goals[0]?.projects.map((project) => project.title)).toEqual([
			"Training plan",
		]);
		const tasks = container.ppv
			.projectTasks("PPV/Projects/Training plan.md")
			.map((task) => task.text);
		expect(tasks).toEqual([
			"Buy shoes",
			"Book physio",
			"Long run",
			"Stretch [[Training plan]]",
		]);
		expect(
			container.ppv.nextActions("PPV/Projects/Training plan.md").map((task) => task.text),
		).toEqual(["Long run", "Book physio", "Stretch [[Training plan]]"]);
	});

	it("creates notes with links to their parent", async () => {
		const { container, content } = await setup();
		const created = await container.ppv.create(
			"project",
			"Race: day/plan",
			"PPV/Goals/Run a marathon.md",
			"backlog",
		);
		expect(created).toEqual({ ok: true, value: "PPV/Projects/Race day plan.md" });
		expect(content("PPV/Projects/Race day plan.md")).toContain('goal: "[[Run a marathon]]"');
		expect(content("PPV/Projects/Race day plan.md")).toContain("status: backlog");
		expect(container.ppvIndex.get("PPV/Projects/Race day plan.md")?.parent).toBe(
			"PPV/Goals/Run a marathon.md",
		);

		const underPillar = await container.ppv.create("project", "Gym", "PPV/Pillars/Health.md");
		expect(underPillar.ok && content(underPillar.value)).toContain('pillar: "[[Health]]"');
	});

	it("refuses duplicates, empty titles and impossible parents", async () => {
		const { container } = await setup();
		const message = async (promise: Promise<{ ok: boolean; error?: Error }>) =>
			(await promise).error?.message;
		expect(await message(container.ppv.create("pillar", "Health", null))).toBe(
			"PPV/Pillars/Health.md already exists.",
		);
		expect(await message(container.ppv.create("goal", " / ", null))).toBe("Enter a title.");
		expect(
			await message(container.ppv.create("goal", "X", "PPV/Projects/Training plan.md")),
		).toBe("That parent cannot hold this kind of note.");
	});

	it("uses a template and still sets type and parent", async () => {
		const { container, content } = await setup({
			...VAULT,
			"Templates/Project.md": "---\ntags: [project]\n---\n# {{title}}\nStarted {{date:YYYY}}",
		});
		await container.settings.section("ppv").update((settings) => ({
			...settings,
			templates: { ...settings.templates, project: "Templates/Project" },
		}));
		const created = await container.ppv.create("project", "Garden", "PPV/Pillars/Health.md");
		expect(created.ok).toBe(true);
		const text = content("PPV/Projects/Garden.md") ?? "";
		expect(text).toContain("# Garden\nStarted 2026");
		expect(text).toContain("type: project");
		expect(text).toContain("pillar: '[[Health]]'".replace(/'/g, '"'));
		expect(text).toContain("status: active");

		await container.settings.section("ppv").update((settings) => ({
			...settings,
			templates: { ...settings.templates, goal: "Templates/Missing" },
		}));
		const missing = await container.ppv.create("goal", "G", null);
		expect(!missing.ok && missing.error.message).toBe("Template not found: Templates/Missing");
	});

	it("archives finished projects and updates links to them", async () => {
		const { container, content } = await setup();
		const result = await container.ppv.setStatus("PPV/Projects/Training plan.md", "done");
		expect(result).toEqual({ ok: true, value: "PPV/Archive/Training plan.md" });
		expect(content("PPV/Archive/Training plan.md")).toContain("status: done");
		expect(content("PPV/Archive/Training plan.md")).toContain("completed: 2026-10-29");
		expect(content("2026-10-29.md")).toBe("- [ ] Stretch [[Training plan]]");

		const reopened = await container.ppv.setStatus("PPV/Archive/Training plan.md", "active");
		expect(reopened).toEqual({ ok: true, value: "PPV/Archive/Training plan.md" });
		expect(content("PPV/Archive/Training plan.md")).not.toContain("completed:");
		expect((await container.ppv.setStatus("PPV/Pillars/Health.md", "done")).ok).toBe(false);
	});

	it("keeps finished projects in place when archiving is off", async () => {
		const { container } = await setup();
		await container.settings
			.section("ppv")
			.update((settings) => ({ ...settings, archiveClosedProjects: false }));
		const result = await container.ppv.setStatus("PPV/Projects/Training plan.md", "dropped");
		expect(result).toEqual({ ok: true, value: "PPV/Projects/Training plan.md" });
	});

	it("captures to today's note or the inbox", async () => {
		const { container, content } = await setup();
		expect(await container.ppv.capture("  Call\n the bank ", true)).toEqual({
			ok: true,
			value: "2026-10-29.md",
		});
		expect(content("2026-10-29.md")).toBe(
			"- [ ] Stretch [[Training plan]]\n\n## Inbox\n- [ ] Call the bank\n",
		);
		await container.settings
			.section("ppv")
			.update((settings) => ({ ...settings, captureTarget: "inbox", inboxPath: "Inbox" }));
		await container.ppv.capture("An idea", false);
		await container.ppv.capture("Another", false);
		expect(content("Inbox.md")).toBe("## Inbox\n- An idea\n- Another\n");
		expect((await container.ppv.capture("   ", true)).ok).toBe(false);
	});

	it("sets up folders and an example pillar once", async () => {
		const { container, content } = await setup({});
		expect(await container.ppv.setUp()).toEqual([
			"PPV/Pillars",
			"PPV/Goals",
			"PPV/Projects",
			"PPV/Vault",
			"PPV/Archive",
			"PPV/Pillars/Health.md",
		]);
		expect(content("PPV/Pillars/Health.md")).toContain("type: pillar");
		expect(await container.ppv.setUp()).toEqual([]);
	});
});

describe("PPV commands", () => {
	it("cycles a task's stage from the editor", async () => {
		const { plugin, content } = await setup();
		expect(
			plugin.runEditorCommand("cycle-task-stage", "PPV/Projects/Training plan.md", 8),
		).toBe(true);
		await act(() => sleep(10));
		expect(content("PPV/Projects/Training plan.md")).toContain("- [/] Book physio");
		plugin.runEditorCommand("cycle-task-stage", "PPV/Projects/Training plan.md", 8);
		await act(() => sleep(10));
		expect(content("PPV/Projects/Training plan.md")).toContain("- [>] Book physio");
		expect(
			plugin.runEditorCommand("cycle-task-stage", "PPV/Projects/Training plan.md", 7),
		).toBe(false);
	});

	it("sets a project's status from a dialog", async () => {
		const { plugin, container, content } = await setup();
		expect(plugin.runCommand("set-project-status")).toBe(false);
		await container.workspace.open("PPV/Projects/Training plan.md");
		act(() => {
			plugin.runCommand("set-project-status");
		});
		expect(screen.getByRole("button", { name: "Active" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await userEvent.click(screen.getByRole("button", { name: "Paused" }));
		await act(() => sleep(10));
		expect(content("PPV/Projects/Training plan.md")).toContain("status: paused");
	});

	it("creates a project under the active goal and opens it", async () => {
		const { plugin, container, app } = await setup();
		await container.workspace.open("PPV/Goals/Run a marathon.md");
		act(() => {
			plugin.runCommand("new-project");
		});
		expect(screen.getByRole("combobox", { name: "Linked to" })).toHaveValue(
			"PPV/Goals/Run a marathon.md",
		);
		await userEvent.click(screen.getByRole("button", { name: "Create project" }));
		expect(screen.getByRole("alert")).toHaveTextContent("Enter a title.");
		await userEvent.type(screen.getByRole("textbox", { name: "Title" }), "Taper");
		await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status" }), "paused");
		await userEvent.click(screen.getByRole("button", { name: "Create project" }));
		await act(() => sleep(10));
		expect(app.workspace.getActiveFile()?.path).toBe("PPV/Projects/Taper.md");
		expect(container.ppvIndex.get("PPV/Projects/Taper.md")).toMatchObject({
			status: "paused",
			parent: "PPV/Goals/Run a marathon.md",
		});
	});

	it("captures from a dialog", async () => {
		const { plugin, content } = await setup();
		act(() => {
			plugin.runCommand("capture");
		});
		expect(screen.getByText("Goes to today's note, under Inbox.")).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Capture" }));
		expect(screen.getByRole("alert")).toHaveTextContent("Nothing to capture.");
		await userEvent.type(screen.getByRole("textbox", { name: "Capture" }), "Water plants");
		await userEvent.click(screen.getByRole("checkbox", { name: "As a task" }));
		await userEvent.keyboard("{Control>}{Enter}{/Control}");
		await userEvent.click(screen.getByRole("button", { name: "Capture" }));
		await act(() => sleep(10));
		expect(content("2026-10-29.md")).toContain("## Inbox\n- Water plants");
	});

	it("runs setup from the command", async () => {
		Notice.messages.length = 0;
		const { plugin } = await setup();
		plugin.runCommand("set-up-ppv");
		await act(() => sleep(10));
		expect(Notice.messages.at(-1)).toBe("Created PPV/Vault, PPV/Archive.");
	});
});

describe("PPV dashboard", () => {
	it("shows pillars, goals, projects, progress and next actions", async () => {
		const harness = await setup();
		const ui = await openDashboard(harness);
		const health = ui.getByRole("region", { name: "Health" });
		expect(within(health).getByRole("button", { name: "Run a marathon" })).toBeInTheDocument();
		expect(
			within(health).getByRole("progressbar", { name: "Training plan: 1 of 4 tasks done" }),
		).toHaveValue(25);
		expect(within(health).getByText("⏱ 1h 30m")).toBeInTheDocument();
		expect(within(health).getByText("Due 2026-11-15")).toBeInTheDocument();
		expect(within(health).getByRole("button", { name: "Long run" })).toBeInTheDocument();
		expect(ui.getByRole("region", { name: "Work" })).toHaveTextContent("No goals yet.");
		expect(ui.queryByText("Old site")).toBeNull();
	});

	it("filters by status and completes next actions", async () => {
		const harness = await setup();
		const ui = await openDashboard(harness);
		await userEvent.selectOptions(ui.getByRole("combobox", { name: "Show" }), "all");
		expect(ui.getByText("Old site")).toBeInTheDocument();
		await userEvent.click(ui.getByRole("checkbox", { name: "Complete next action: Long run" }));
		await act(() => sleep(10));
		expect(harness.content("PPV/Projects/Training plan.md")).toContain(
			"- [x] Long run ✅ 2026-10-29",
		);
	});

	it("starts new notes from the dashboard and offers setup when empty", async () => {
		Notice.messages.length = 0;
		const harness = await setup({});
		const ui = await openDashboard(harness);
		await userEvent.click(
			ui.getByRole("button", { name: "Set up folders and an example pillar" }),
		);
		await act(() => sleep(10));
		expect(ui.getByRole("region", { name: "Health" })).toBeInTheDocument();
		await userEvent.click(ui.getByRole("button", { name: "New goal for Health" }));
		expect(screen.getByRole("combobox", { name: "Linked to" })).toHaveValue(
			"PPV/Pillars/Health.md",
		);
	});

	it("lists notes not linked to a pillar", async () => {
		const harness = await setup({
			"PPV/Projects/Loose.md": "---\ntype: project\n---\n",
			"PPV/Goals/Lost.md": "---\ntype: goal\n---\n",
		});
		const ui = await openDashboard(harness);
		const loose = ui.getByRole("region", { name: "Not linked to a pillar" });
		expect(within(loose).getByText("Loose")).toBeInTheDocument();
		expect(within(loose).getByText("Lost")).toBeInTheDocument();
		fireEvent.click(within(loose).getByRole("button", { name: "New project for Lost" }));
		expect(screen.getByRole("button", { name: "Create project" })).toBeInTheDocument();
		expect(screen.getByRole("combobox", { name: "Linked to" })).toHaveValue(
			"PPV/Goals/Lost.md",
		);
	});
});

describe("sbos code block", () => {
	async function render(harness: Awaited<ReturnType<typeof setup>>, source: string) {
		const handler = harness.plugin.codeBlockProcessors.get("sbos");
		const el = document.createElement("div");
		document.body.append(el);
		const children: { load(): void }[] = [];
		await act(async () => {
			await handler?.(source, el, {
				sourcePath: "x.md",
				addChild: (child) => children.push(child),
			});
			for (const child of children) {
				child.load();
			}
			await sleep(0);
		});
		return { ui: within(el), el, children };
	}

	it("lists projects under a pillar", async () => {
		const harness = await setup();
		const { ui } = await render(harness, "pillar: Health");
		expect(ui.getByRole("button", { name: "Training plan" })).toBeInTheDocument();
		const work = await render(harness, "pillar: Work\nstatus: done");
		expect(work.ui.getByRole("button", { name: "Old site" })).toBeInTheDocument();
	});

	it("lists open tasks of matching projects", async () => {
		const harness = await setup();
		const { ui } = await render(harness, "view: tasks\nlimit: 2");
		expect(ui.getAllByRole("listitem")).toHaveLength(2);
		expect(ui.getAllByText("· Training plan", { exact: false })).toHaveLength(2);
		await userEvent.click(ui.getByRole("checkbox", { name: "Complete Long run" }));
		await act(() => sleep(10));
		expect(harness.content("PPV/Projects/Training plan.md")).toContain("- [x] Long run");
	});

	it("shows empty states and errors", async () => {
		const harness = await setup();
		expect(
			(await render(harness, "pillar: Nowhere")).ui.getByText("No matching projects."),
		).toBeInTheDocument();
		expect(
			(await render(harness, "view: tasks\npillar: Nowhere")).ui.getByText("No open tasks."),
		).toBeInTheDocument();
		const broken = await render(harness, "view: board");
		expect(broken.el.querySelector(".sbos-error")?.textContent).toBe(
			'Unknown view "board". Use projects or tasks.',
		);
	});
});

describe("PPV navigation", () => {
	it("opens pillars, goals, projects and next actions from the dashboard", async () => {
		const harness = await setup();
		const ui = await openDashboard(harness);
		const active = () => harness.app.workspace.getActiveFile()?.path;
		const click = async (name: string) => {
			await userEvent.click(ui.getByRole("button", { name }));
			await act(() => sleep(0));
		};
		await click("Health");
		expect(active()).toBe("PPV/Pillars/Health.md");
		await click("Run a marathon");
		expect(active()).toBe("PPV/Goals/Run a marathon.md");
		await click("Training plan");
		expect(active()).toBe("PPV/Projects/Training plan.md");
		await click("Long run");
		expect(harness.app.workspace.leaves.at(-1)?.openState).toMatchObject({
			eState: { line: 9 },
		});
		await userEvent.click(ui.getByRole("button", { name: "New pillar" }));
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await userEvent.click(ui.getByRole("button", { name: "New goal" }));
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await userEvent.click(ui.getByRole("button", { name: "New project" }));
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await userEvent.click(ui.getByRole("button", { name: "New project for Run a marathon" }));
		expect(screen.getByRole("combobox", { name: "Linked to" })).toHaveValue(
			"PPV/Goals/Run a marathon.md",
		);
	});

	it("opens tasks from a code block and unmounts it", async () => {
		const harness = await setup();
		const handler = harness.plugin.codeBlockProcessors.get("sbos");
		const el = document.createElement("div");
		document.body.append(el);
		const children: { load(): void; unload(): void }[] = [];
		await act(async () => {
			await handler?.("view: tasks", el, {
				sourcePath: "x.md",
				addChild: (child) => children.push(child),
			});
			children[0]?.load();
			await sleep(0);
		});
		await userEvent.click(within(el).getByRole("button", { name: "Book physio" }));
		await act(() => sleep(0));
		expect(harness.app.workspace.leaves.at(-1)?.openState).toMatchObject({
			eState: { line: 8 },
		});
		act(() => children[0]?.unload());
		expect(el).toBeEmptyDOMElement();
	});

	it("describes the dashboard view", async () => {
		const harness = await setup();
		await openDashboard(harness);
		const view = harness.app.workspace.getLeavesOfType("sbos-ppv-dashboard")[0]?.view;
		expect([view?.getViewType(), view?.getDisplayText(), view?.getIcon()]).toEqual([
			"sbos-ppv-dashboard",
			"PPV dashboard",
			"layout-dashboard",
		]);
		harness.plugin.runCommand("open-ppv-dashboard");
		await act(() => sleep(0));
		expect(harness.app.workspace.getLeavesOfType("sbos-ppv-dashboard")).toHaveLength(1);
	});

	it("closes the status dialog without changes", async () => {
		const { plugin, container, content } = await setup();
		await container.workspace.open("PPV/Projects/Training plan.md");
		act(() => {
			plugin.runCommand("set-project-status");
		});
		act(() => {
			plugin.runCommand("new-goal");
		});
		expect(content("PPV/Projects/Training plan.md")).toContain("status: active");
	});
});

describe("PPV settings", () => {
	it("edits folders, templates, archive and capture options", async () => {
		const harness = await setup();
		const tab = harness.plugin.settingTabs[0];
		if (!tab) {
			throw new Error("No settings tab");
		}
		document.body.append(tab.containerEl);
		tab.display();
		const ui = within(tab.containerEl);
		const input = (name: string, value: string) =>
			fireEvent.input(ui.getByRole("textbox", { name }), { target: { value } });
		input("Project folder", " Work/Projects ");
		input("Goal template", "Templates/Goal");
		input("Archive folder", "Archive");
		input("Inbox note", "Inbox/Main.md");
		input("Capture heading", "Captured");
		input("Capture heading", "  ");
		fireEvent.click(ui.getByRole("checkbox", { name: "Archive finished projects" }));
		fireEvent.change(ui.getByRole("combobox", { name: "Capture to" }), {
			target: { value: "inbox" },
		});
		await act(() => sleep(0));
		expect(harness.container.settings.section("ppv").store.get()).toMatchObject({
			folders: { project: "Work/Projects" },
			templates: { goal: "Templates/Goal" },
			archiveFolder: "Archive",
			archiveClosedProjects: false,
			captureTarget: "inbox",
			inboxPath: "Inbox/Main.md",
			captureHeading: "Captured",
		});
	});
});

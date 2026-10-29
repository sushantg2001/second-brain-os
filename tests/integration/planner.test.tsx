import { describe, expect, it } from "bun:test";
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { statusText, type TimelineView } from "../../src/features/planner";
import { loadPlugin, sleep } from "../fakes/plugin-harness";

const DAILY = [
	"# 2026-10-29",
	"## Day planner",
	"- [ ] 09:00 - 10:00 Write spec",
	"- [ ] 10:30 Standup",
	"- [ ] Buy milk",
	"",
	"## Notes",
	"Some text",
].join("\n");

async function setup(
	files: Record<string, string> = { "2026-10-29.md": DAILY },
	minutes = 9 * 60 + 10,
) {
	const harness = await loadPlugin({ files, today: "2026-10-29", minutes });
	await act(() => sleep(10));
	const leaf = harness.app.workspace.getLeavesOfType("sbos-timeline")[0];
	const view = leaf?.view as unknown as TimelineView | undefined;
	if (!view) {
		throw new Error("Timeline is not open");
	}
	document.body.append(view.containerEl);
	await act(() => sleep(0));
	const ui = within(view.contentEl);
	const content = (path = "2026-10-29.md") => harness.app.vault.contentOf(path);
	const settle = () => act(() => sleep(20));
	return { ...harness, view, ui, content, settle };
}

describe("day planner", () => {
	it("shows blocks, the unscheduled list and the planned total", async () => {
		const { ui, container } = await setup();
		expect(ui.getByRole("heading", { name: "Thursday, October 29" })).toBeInTheDocument();
		expect(ui.getByRole("button", { name: "09:00 to 10:00, Write spec" })).toBeInTheDocument();
		expect(ui.getByRole("button", { name: "10:30 to 11:00, Standup" })).toBeInTheDocument();
		const unscheduled = ui.getByRole("region", { name: "Unscheduled" });
		expect(within(unscheduled).getByRole("button", { name: "Buy milk" })).toBeInTheDocument();
		expect(container.planner.plannedByDate.get().get("2026-10-29")).toBe(90);
	});

	it("moves and resizes blocks with the keyboard", async () => {
		const { ui, content, settle } = await setup();
		const block = ui.getByRole("button", { name: "09:00 to 10:00, Write spec" });
		block.focus();
		await userEvent.keyboard("{ArrowDown}");
		await settle();
		expect(content()).toContain("- [ ] 09:15 - 10:15 Write spec");
		await userEvent.click(ui.getByRole("button", { name: "09:15 to 10:15, Write spec" }));
		ui.getByRole("button", { name: "09:15 to 10:15, Write spec" }).focus();
		await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}");
		await settle();
		expect(content()).toContain("- [ ] 09:15 - 10:30 Write spec");
		ui.getByRole("button", { name: "09:15 to 10:30, Write spec" }).focus();
		await userEvent.keyboard("{Delete}");
		await settle();
		expect(content()).toContain("- [ ] Write spec");
	});

	it("drags a block to move it, snapping to the step", async () => {
		const { ui, content, settle } = await setup();
		const title = ui.getByRole("button", { name: "09:00 to 10:00, Write spec" });
		const block = title.parentElement as HTMLElement;
		const column = block.parentElement as HTMLElement;
		fireEvent.pointerDown(block, { button: 0, clientY: 100, pointerId: 1 });
		fireEvent.pointerMove(column, { clientY: 160, pointerId: 1 });
		expect(block).toHaveClass("is-dragging");
		fireEvent.pointerUp(column, { clientY: 160, pointerId: 1 });
		fireEvent.click(title);
		await settle();
		expect(content()).toContain("- [ ] 10:00 - 11:00 Write spec");
	});

	it("drags the bottom edge to resize", async () => {
		const { ui, content, settle } = await setup();
		const block = ui.getByRole("button", { name: "09:00 to 10:00, Write spec" })
			.parentElement as HTMLElement;
		const handle = block.querySelector(".sbos-block__resize") as HTMLElement;
		const column = block.parentElement as HTMLElement;
		fireEvent.pointerDown(handle, { button: 0, clientY: 300, pointerId: 1 });
		fireEvent.pointerMove(column, { clientY: 330, pointerId: 1 });
		fireEvent.pointerUp(column, { clientY: 330, pointerId: 1 });
		await settle();
		expect(content()).toContain("- [ ] 09:00 - 10:30 Write spec");
	});

	it("opens the task when a block is clicked", async () => {
		const { ui, app } = await setup();
		await userEvent.click(ui.getByRole("button", { name: "10:30 to 11:00, Standup" }));
		await sleep(0);
		const leaf = app.workspace.leaves.find(
			(candidate) => candidate.file?.path === "2026-10-29.md",
		);
		expect(leaf?.openState).toMatchObject({ eState: { line: 3 } });
	});

	it("creates a block by dragging on empty time and naming it", async () => {
		const { ui, content, settle } = await setup();
		const column = ui.getByRole("region", { name: "Timeline for Thursday, October 29" })
			.firstElementChild as HTMLElement;
		// The column starts at 06:00 with 60px per hour, so y=420 is 13:00 and y=510 is 14:30.
		fireEvent.pointerDown(column, { button: 0, clientY: 427, pointerId: 1 });
		fireEvent.pointerMove(column, { clientY: 510, pointerId: 1 });
		fireEvent.pointerUp(column, { clientY: 510, pointerId: 1 });
		await settle();
		expect(screen.getByLabelText("Start")).toHaveValue("13:00");
		expect(screen.getByLabelText("End")).toHaveValue("14:30");
		await userEvent.type(screen.getByRole("textbox", { name: "Title" }), "Deep work");
		await userEvent.click(screen.getByRole("button", { name: "Add block" }));
		await settle();
		expect(content()).toBe(
			[
				"# 2026-10-29",
				"## Day planner",
				"- [ ] 09:00 - 10:00 Write spec",
				"- [ ] 10:30 Standup",
				"- [ ] Buy milk",
				"- [ ] 13:00 - 14:30 Deep work",
				"",
				"## Notes",
				"Some text",
			].join("\n"),
		);
		expect(ui.getByRole("button", { name: "13:00 to 14:30, Deep work" })).toBeInTheDocument();
	});

	it("validates the new block form", async () => {
		const { plugin } = await setup();
		act(() => {
			plugin.runCommand("add-time-block");
		});
		await userEvent.click(screen.getByRole("button", { name: "Add block" }));
		expect(screen.getByRole("alert")).toHaveTextContent("Enter a title.");
		await userEvent.type(screen.getByRole("textbox", { name: "Title" }), "X");
		const end = screen.getByLabelText("End");
		await userEvent.clear(end);
		await userEvent.type(end, "07:00");
		await userEvent.click(screen.getByRole("button", { name: "Add block" }));
		expect(screen.getByRole("alert")).toHaveTextContent("The end must be after the start.");
		await userEvent.clear(end);
		await userEvent.type(end, "7");
		await userEvent.click(screen.getByRole("button", { name: "Add block" }));
		expect(screen.getByRole("alert")).toHaveTextContent("Enter times as HH:mm.");
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("creates the daily note when adding a block on a day without one", async () => {
		const { plugin, content, settle } = await setup({}, 8 * 60);
		act(() => {
			plugin.runCommand("add-time-block");
		});
		expect(screen.getByLabelText("Start")).toHaveValue("08:00");
		await userEvent.type(screen.getByRole("textbox", { name: "Title" }), "Plan the day");
		await userEvent.click(screen.getByRole("button", { name: "Add block" }));
		await settle();
		expect(content()).toBe("## Day planner\n- [ ] 08:00 - 08:30 Plan the day\n");
	});

	it("schedules an unscheduled task in the next free slot", async () => {
		const { ui, content, settle } = await setup();
		await userEvent.click(ui.getByRole("button", { name: "Schedule Buy milk" }));
		await settle();
		// Now is 09:10: 09:15 is busy until 10:00, so the first free half hour is 10:00.
		expect(content()).toContain("- [ ] 10:00 - 10:30 Buy milk");
	});

	it("checks off a block through its checkbox", async () => {
		const { ui, content, settle } = await setup();
		await userEvent.click(ui.getByRole("checkbox", { name: "Done: Write spec" }));
		await settle();
		expect(content()).toContain("- [x] 09:00 - 10:00 Write spec ✅ 2026-10-29");
		expect(
			ui.getByRole("button", { name: "09:00 to 10:00, Write spec, done" }),
		).toBeInTheDocument();
	});

	it("shows tasks scheduled from other notes", async () => {
		const { ui } = await setup({
			"2026-10-29.md": "",
			"Projects/Site.md":
				"- [ ] 15:00 - 16:00 Review copy ⏳ 2026-10-29\n- [ ] Ship ⏳ 2026-10-29",
		});
		expect(
			ui.getByRole("button", { name: "15:00 to 16:00, Review copy" }).parentElement,
		).toHaveClass("is-scheduled");
		expect(ui.getByRole("button", { name: "Ship" })).toBeInTheDocument();
	});

	it("refuses to edit a line that changed since it was read", async () => {
		const { app, container, content } = await setup();
		const stale = container.planner.plan("2026-10-29").blocks[0];
		const file = app.vault.getFileByPath("2026-10-29.md");
		if (!stale || !file) {
			throw new Error("missing");
		}
		await app.vault.process(file, (text) => text.replace("Write spec", "Write the spec"));
		const result = await container.planner.moveBlock(stale, 600, 660);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.error.message).toBe(
			"The note changed since it was read. Try again.",
		);
		expect(content()).toContain("- [ ] 09:00 - 10:00 Write the spec");
	});

	it("navigates days and opens a multi-day view", async () => {
		const { ui, plugin, app } = await setup();
		await userEvent.click(ui.getByRole("button", { name: "Next day" }));
		expect(ui.getByRole("heading", { name: "Friday, October 30" })).toBeInTheDocument();
		await userEvent.click(ui.getByRole("button", { name: "Today" }));
		await userEvent.click(ui.getByRole("button", { name: "Previous day" }));
		expect(ui.getByRole("heading", { name: "Wednesday, October 28" })).toBeInTheDocument();

		plugin.runCommand("open-multi-day-planner");
		await act(() => sleep(0));
		const views = app.workspace
			.getLeavesOfType("sbos-timeline")
			.map((leaf) => leaf.view as unknown as TimelineView);
		const multi = views.find((view) => view.state.get().days === 3);
		expect(multi?.getDisplayText()).toBe("Multi-day planner");
		document.body.append(multi?.containerEl ?? document.createElement("div"));
		await act(() => sleep(0));
		const multiUi = within(multi?.contentEl ?? document.body);
		expect(multiUi.getAllByRole("region", { name: /^Timeline for/ })).toHaveLength(3);
		expect(multiUi.getByText("Thu 29")).toBeInTheDocument();
		await userEvent.click(multiUi.getByRole("button", { name: "Next days" }));
		expect(multiUi.getByText("Sun 1")).toBeInTheDocument();
	});
});

describe("timeline view", () => {
	it("describes itself and keeps its day count in view state", async () => {
		const { view } = await setup();
		expect(view.getViewType()).toBe("sbos-timeline");
		expect(view.getDisplayText()).toBe("Day planner");
		expect(view.getIcon()).toBe("calendar-clock");
		expect(view.getState()).toEqual({ date: "2026-10-29", days: 1 });
		await view.setState({ days: 9 }, { history: false });
		expect(view.getState()).toMatchObject({ days: 1 });
	});

	it("shows why a block could not be created", async () => {
		const { plugin, container } = await setup({});
		await container.settings.section("periodic").update((settings) => ({
			...settings,
			notes: { ...settings.notes, day: { ...settings.notes.day, template: "Missing" } },
		}));
		act(() => {
			plugin.runCommand("add-time-block");
		});
		await userEvent.type(screen.getByRole("textbox", { name: "Title" }), "Plan");
		await userEvent.click(screen.getByRole("button", { name: "Add block" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Template not found: Missing");
	});
});

describe("planner status and notifications", () => {
	it("shows the current or next block in the status bar", async () => {
		const harness = await setup();
		const status = harness.plugin.statusBarItems[0];
		expect(status?.textContent).toBe("▶ Write spec · 50m left");
		const now = { date: "2026-10-29", minutes: 10 * 60 + 5 };
		expect(statusText(harness.container.planner, now)).toBe("Next: Standup at 10:30");
		expect(statusText(harness.container.planner, { ...now, minutes: 20 * 60 })).toBe("");
	});

	it("hides the status bar when turned off", async () => {
		const harness = await setup();
		await harness.container.settings
			.section("planner")
			.update((settings) => ({ ...settings, showStatusBar: false }));
		const status = harness.plugin.statusBarItems[0];
		expect(status?.textContent).toBe("");
		expect(status?.hidden).toBe(true);
	});
});

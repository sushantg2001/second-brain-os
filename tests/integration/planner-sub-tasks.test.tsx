import { describe, expect, it } from "bun:test";
import { act, fireEvent, within } from "@testing-library/react";

import type { TimelineView } from "../../src/features/planner";
import { loadPlugin, sleep } from "../fakes/plugin-harness";

/** The shape of a day log: timed tasks with what was done in them listed below, untimed. */
const LOG = [
	"## Work",
	"- [x] 00:00 - 10:00 Late night  [type::log]",
	"\t- [x] brush before sleep",
	"\t- [x] sleep #health/sleep",
	"\t      [clock::2026-10-29T00:30:20--2026-10-29T09:55:29]",
	"- [ ] 10:00 - 12:00 Morning  [type::log]",
	"\t- [ ] bath",
	"\t\t- [ ] shampoo",
	"\t- a plain note, not a task",
	"- [ ] 13:00 - 13:20 Short block",
	"\t- [ ] too small to show",
].join("\n");

async function setup() {
	const harness = await loadPlugin({
		files: { "2026-10-29.md": LOG },
		today: "2026-10-29",
		minutes: 9 * 60,
	});
	await act(() => sleep(10));
	const view = harness.app.workspace.getLeavesOfType("sbos-timeline")[0]
		?.view as unknown as TimelineView;
	document.body.append(view.containerEl);
	await act(() => sleep(0));
	return { ...harness, ui: within(view.contentEl) };
}

const blockOf = (title: HTMLElement): HTMLElement => title.parentElement as HTMLElement;

describe("sub tasks inside a block", () => {
	it("lists the tasks under a block inside it, nested ones indented", async () => {
		const { ui } = await setup();
		const morning = blockOf(ui.getByRole("button", { name: "10:00 to 12:00, Morning" }));
		const list = within(morning).getByRole("list", { name: "Sub tasks of Morning" });
		const items = within(list).getAllByRole("listitem");
		expect(items.map((item) => item.textContent)).toEqual(["bath", "shampoo"]);
		expect(items[0]?.style.paddingInlineStart).toBe("0px");
		expect(items[1]?.style.paddingInlineStart).toBe("14px");
	});

	it("shows which sub tasks are done", async () => {
		const { ui } = await setup();
		const night = blockOf(ui.getByRole("button", { name: /^00:00 to 10:00, Late night/ }));
		expect(
			within(night).getByRole("checkbox", { name: "Done: brush before sleep" }),
		).toBeChecked();
		const morning = blockOf(ui.getByRole("button", { name: "10:00 to 12:00, Morning" }));
		expect(within(morning).getByRole("checkbox", { name: "Done: bath" })).not.toBeChecked();
	});

	it("ticks a sub task off in its note", async () => {
		const { ui, app } = await setup();
		await act(async () => {
			fireEvent.click(ui.getByRole("checkbox", { name: "Done: bath" }));
			await sleep(20);
		});
		const note = app.vault.contentOf("2026-10-29.md");
		expect(note).toContain("\t- [x] bath");
		expect(note).toContain("\t\t- [ ] shampoo");
	});

	it("opens a sub task at its own line", async () => {
		const { ui, app } = await setup();
		const morning = blockOf(ui.getByRole("button", { name: "10:00 to 12:00, Morning" }));
		await act(async () => {
			fireEvent.click(within(morning).getByRole("button", { name: "shampoo" }));
			await sleep(0);
		});
		const leaf = app.workspace.leaves.find(
			(candidate) => candidate.file?.path === "2026-10-29.md",
		);
		// "shampoo" is the line after "bath": counted from the "## Work" heading on line 0.
		expect(leaf?.openState).toMatchObject({ eState: { line: 7 } });
	});

	it("does not start a drag when a sub task is pressed", async () => {
		const { ui, app } = await setup();
		const before = app.vault.contentOf("2026-10-29.md");
		const morning = blockOf(ui.getByRole("button", { name: "10:00 to 12:00, Morning" }));
		const bath = within(morning).getByRole("button", { name: "bath" });
		await act(async () => {
			fireEvent.pointerDown(bath, { button: 0, clientY: 100 });
			fireEvent.pointerMove(bath, { clientY: 220 });
			fireEvent.pointerUp(bath);
			await sleep(20);
		});
		expect(app.vault.contentOf("2026-10-29.md")).toBe(before);
	});

	it("marks a block too short for its sub tasks, which the stylesheet hides", async () => {
		const { ui } = await setup();
		const short = blockOf(ui.getByRole("button", { name: "13:00 to 13:20, Short block" }));
		expect(short).toHaveClass("is-short");
		expect(
			within(short).getByRole("list", { name: "Sub tasks of Short block" }),
		).toBeInTheDocument();
	});
});

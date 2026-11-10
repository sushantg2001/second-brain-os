import { describe, expect, it } from "bun:test";
import { act, fireEvent, within } from "@testing-library/react";

import type { TimelineView } from "../../src/features/planner";
import { loadPlugin, sleep } from "../fakes/plugin-harness";

const DAY = "2026-10-29.md";

/** A day log as it is written: timed tasks, what was done in them, and a clock under each. */
const LOG = [
	"## Work",
	"- [x] 10:00 - 12:00 Morning  [type::log]",
	"\t- [x] getting fresh after waking",
	"\t      [clock::2026-10-29T09:56:14--2026-10-29T10:30:40]",
	"\t- [x] bath",
	"\t      [clock::2026-10-29T10:30:47--2026-10-29T11:16:53]",
	"- [x] 12:00 - 18:30 Work",
	"\t- [x] office work from home",
	"\t      [clock::2026-10-29T12:00:00--2026-10-29T13:57:42]",
	"\t      [clock::2026-10-29T14:29:57--2026-10-29T15:40:06]",
].join("\n");

async function setup(files: Record<string, string> = { [DAY]: LOG }, minutes = 20 * 60) {
	const harness = await loadPlugin({ files, today: "2026-10-29", minutes });
	await act(() => sleep(10));
	const view = harness.app.workspace.getLeavesOfType("sbos-timeline")[0]
		?.view as unknown as TimelineView;
	document.body.append(view.containerEl);
	await act(() => sleep(0));
	const ui = within(view.contentEl);
	const blockOf = (name: string | RegExp): HTMLElement =>
		ui.getByRole("button", { name }).parentElement as HTMLElement;
	return { ...harness, view, ui, blockOf };
}

describe("clocked time on the timeline", () => {
	it("draws each clocked task as a block with its name and time", async () => {
		const { ui } = await setup();
		const fresh = ui.getByRole("button", {
			name: "Clocked 09:56 – 10:30, getting fresh after waking",
		});
		expect(within(fresh).getByText("getting fresh after waking")).toBeInTheDocument();
		// Tracked to the second, shown to the minute.
		expect(within(fresh).getByText("09:56 – 10:30 · 34m")).toBeInTheDocument();
		expect(ui.getByRole("button", { name: "Clocked 10:30 – 11:16, bath" })).toBeInTheDocument();
	});

	it("draws the task a sub task belongs to as a block around it", async () => {
		const { ui, blockOf } = await setup();
		const morning = blockOf("Clocked 09:56 – 11:16, Morning");
		const bath = blockOf("Clocked 10:30 – 11:16, bath");
		expect(morning.dataset.depth).toBe("0");
		expect(bath.dataset.depth).toBe("1");
		expect(morning).not.toHaveClass("is-leaf");
		expect(bath).toHaveClass("is-leaf");
		// A parent keeps its own column; the sub task's block takes the column after it.
		expect(morning.style.left).toBe("0%");
		expect(morning.style.width).toBe("50%");
		expect(bath.style.left).toBe("50%");
		expect(bath.style.width).toBe("50%");
		expect(ui.getAllByRole("button", { name: /^Clocked / }).length).toBeGreaterThan(4);
	});

	it("draws sub task blocks level with the time they were clocked", async () => {
		const { blockOf } = await setup();
		const bath = blockOf("Clocked 10:30 – 11:16, bath");
		// 60px an hour from the day's 06:00 start: 10:30:47 is 270.78 minutes in.
		expect(Number.parseFloat(bath.style.top)).toBeCloseTo(270.78, 1);
		expect(Number.parseFloat(bath.style.height)).toBeCloseTo(46.1, 1);
	});

	it("keeps a task's separate stretches apart", async () => {
		const { ui } = await setup();
		expect(
			ui.getAllByRole("button", { name: /^Clocked .*, office work from home$/ }),
		).toHaveLength(2);
	});

	it("leaves a lane for them, so planned blocks do not sit underneath", async () => {
		const { blockOf } = await setup();
		const planned = blockOf(/^10:00 to 12:00, Morning/);
		// Two columns of sub tasks at most, so the lane takes 52% of the day.
		expect(planned.style.left).toBe("calc((100% - 52%) * 0)");
		expect(planned.style.width).toBe("calc((100% - 52%) / 1)");
	});

	it("uses the whole day for planned blocks when nothing was clocked", async () => {
		const { blockOf, view } = await setup({
			[DAY]: "## Work\n- [ ] 10:00 - 12:00 Morning\n",
		});
		const planned = blockOf("10:00 to 12:00, Morning");
		expect(planned.style.left).toBe("0%");
		expect(planned.style.width).toBe("100%");
		expect(view.contentEl.querySelector(".sbos-clocks")).toBeNull();
	});

	it("opens the task at its own line when its clocked block is clicked", async () => {
		const { ui, app } = await setup();
		await act(async () => {
			fireEvent.click(ui.getByRole("button", { name: "Clocked 10:30 – 11:16, bath" }));
			await sleep(0);
		});
		const leaf = app.workspace.leaves.find((candidate) => candidate.file?.path === DAY);
		// "bath" is the fifth line of the note, counting from the "## Work" heading on line 0.
		expect(leaf?.openState).toMatchObject({ eState: { line: 4 } });
	});

	it("does not start a new block when a clocked block is pressed", async () => {
		const { ui, app } = await setup();
		const before = app.vault.contentOf(DAY);
		const bath = ui.getByRole("button", { name: "Clocked 10:30 – 11:16, bath" });
		await act(async () => {
			fireEvent.pointerDown(bath, { button: 0, clientY: 640, pointerId: 1 });
			fireEvent.pointerUp(bath, { clientY: 640, pointerId: 1 });
			await sleep(10);
		});
		expect(app.vault.contentOf(DAY)).toBe(before);
		expect(document.querySelector(".sbos-modal")).toBeNull();
	});

	it("marks a clock that is still running", async () => {
		const { ui, blockOf } = await setup(
			{
				[DAY]: "## Work\n- [ ] 09:00 - 11:00 Main\n\t- [ ] Sub\n\t\t[clock::2026-10-29T09:00:00--]\n",
			},
			9 * 60 + 30,
		);
		const running = blockOf("Clocked 09:00 – 09:30, Sub, running");
		expect(running).toHaveClass("is-running");
		expect(blockOf("Clocked 09:00 – 09:30, Main, running")).toHaveClass("is-running");
		// The task and its sub task were clocked for the same half hour.
		expect(
			ui.getAllByText("09:00 – 09:30 · 30m", { selector: ".sbos-clock__time" }),
		).toHaveLength(2);
	});
});

describe("clocked time that overlaps", () => {
	/** Two tasks clocked over the same half hour, from different parts of a note. */
	const OVERLAP = [
		"## Work",
		"- [x] 12:00 - 14:00 Work",
		"\t- [x] office work",
		"\t      [clock::2026-10-29T12:00:00--2026-10-29T13:57:00]",
		"- [x] 13:00 - 15:00 Review",
		"\t- [x] weekly sweep",
		"\t      [clock::2026-10-29T13:18:00--2026-10-29T14:29:00]",
	].join("\n");

	it("sets the tasks side by side so neither covers the other", async () => {
		const { blockOf } = await setup({ [DAY]: OVERLAP });
		const first = blockOf("Clocked 12:00 – 13:57, Work");
		const second = blockOf("Clocked 13:18 – 14:29, Review");
		// Two tasks side by side, each with a column for its sub task.
		expect([first.style.left, first.style.width]).toEqual(["0%", "25%"]);
		expect([second.style.left, second.style.width]).toEqual(["50%", "25%"]);
		const sub = blockOf("Clocked 12:00 – 13:57, office work");
		expect([sub.style.left, sub.style.width]).toEqual(["25%", "25%"]);
	});

	it("makes the lane wider to fit them", async () => {
		const { blockOf, view } = await setup({ [DAY]: OVERLAP });
		const lane = view.contentEl.querySelector<HTMLElement>(".sbos-clocks");
		// 52% for two levels, and 12% more for the task beside.
		expect(lane?.style.width).toBe("64%");
		expect(blockOf(/^10:00 to 12:00|^12:00 to 14:00, Work/).style.left).toBe(
			"calc((100% - 64%) * 0)",
		);
	});
});

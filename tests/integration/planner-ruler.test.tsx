import { describe, expect, it } from "bun:test";
import { act, fireEvent, within } from "@testing-library/react";

import type { TimelineView } from "../../src/features/planner";
import { loadPlugin, sleep } from "../fakes/plugin-harness";

async function setup() {
	const harness = await loadPlugin({
		files: { "2026-10-29.md": "- [ ] 10:00 - 11:00 Plan" },
		today: "2026-10-29",
		minutes: 9 * 60,
	});
	await act(() => sleep(10));
	const view = harness.app.workspace.getLeavesOfType("sbos-timeline")[0]
		?.view as unknown as TimelineView;
	document.body.append(view.containerEl);
	await act(() => sleep(0));
	return { ...harness, view, ui: within(view.contentEl) };
}

/** A horizontal scrollbar is a different height on each platform, so it has to be measured. */
function pretendScrollbarIs(height: number, scroller: HTMLElement): void {
	Object.defineProperty(scroller, "offsetHeight", { configurable: true, value: 400 });
	Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 400 - height });
}

describe("hour ruler", () => {
	it("ends with a strip as tall as the timeline's own scrollbar", async () => {
		const { view, ui } = await setup();
		const root = view.contentEl.querySelector<HTMLElement>(".sbos-timeline");
		const scroller = view.contentEl.querySelector<HTMLElement>(".sbos-timeline__scroll");
		expect(root).not.toBeNull();
		expect(scroller).not.toBeNull();
		pretendScrollbarIs(15, scroller as HTMLElement);

		// Any re-render measures again; stepping the range is the simplest one.
		await act(async () => {
			fireEvent.click(ui.getByRole("button", { name: "Next week" }));
			await sleep(0);
		});

		expect(root?.style.getPropertyValue("--sbos-scrollbar-width")).toBe("15px");
	});

	it("leaves no strip when the timeline does not scroll sideways", async () => {
		const { view, ui } = await setup();
		const root = view.contentEl.querySelector<HTMLElement>(".sbos-timeline");
		const scroller = view.contentEl.querySelector<HTMLElement>(".sbos-timeline__scroll");
		pretendScrollbarIs(0, scroller as HTMLElement);

		await act(async () => {
			fireEvent.click(ui.getByRole("button", { name: "Next week" }));
			await sleep(0);
		});

		expect(root?.style.getPropertyValue("--sbos-scrollbar-width")).toBe("0px");
	});
});

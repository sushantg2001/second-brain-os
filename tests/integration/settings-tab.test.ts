import { describe, expect, it } from "bun:test";
import { fireEvent, within } from "@testing-library/react";

import { loadPlugin, sleep } from "../fakes/plugin-harness";

async function openSettings() {
	const harness = await loadPlugin({ today: "2026-10-29" });
	const tab = harness.plugin.settingTabs[0];
	if (!tab) {
		throw new Error("No settings tab");
	}
	document.body.append(tab.containerEl);
	tab.display();
	return { ...harness, tab, ui: within(tab.containerEl) };
}

const periodic = (harness: Awaited<ReturnType<typeof openSettings>>) =>
	harness.container.settings.section("periodic").store.get();

describe("settings tab", () => {
	it("changes calendar options", async () => {
		const harness = await openSettings();
		fireEvent.change(harness.ui.getByRole("combobox", { name: "Start week on" }), {
			target: { value: "monday" },
		});
		fireEvent.click(harness.ui.getByRole("checkbox", { name: "Show week numbers" }));
		fireEvent.click(
			harness.ui.getByRole("checkbox", { name: "Confirm before creating notes" }),
		);
		await sleep(0);
		expect(periodic(harness).weekStart).toBe("monday");
		expect(periodic(harness).showWeekNumbers).toBe(true);
		expect(periodic(harness).confirmBeforeCreate).toBe(true);
		expect(harness.plugin.data).toMatchObject({ periodic: { weekStart: "monday" } });
	});

	it("edits a granularity and previews the format", async () => {
		const harness = await openSettings();
		const [format] = harness.ui.getAllByRole("textbox", { name: "Format" });
		const [folder] = harness.ui.getAllByRole("textbox", { name: "Folder" });
		const [template] = harness.ui.getAllByRole("textbox", { name: "Template" });
		fireEvent.input(format as HTMLElement, { target: { value: "DD.MM.YYYY" } });
		fireEvent.input(folder as HTMLElement, { target: { value: "Journal" } });
		fireEvent.input(template as HTMLElement, { target: { value: "Templates/Day" } });
		await sleep(0);
		expect(periodic(harness).notes.day).toEqual({
			enabled: true,
			format: "DD.MM.YYYY",
			folder: "Journal",
			template: "Templates/Day",
		});
		expect(harness.ui.getByText("Current note: 29.10.2026")).toBeInTheDocument();
	});

	it("shows a granularity's fields only while it is enabled", async () => {
		const harness = await openSettings();
		expect(harness.ui.getAllByRole("textbox", { name: "Format" })).toHaveLength(2);
		const toggles = harness.ui.getAllByRole("checkbox", { name: "Enabled" });
		fireEvent.click(toggles[2] as HTMLElement);
		await sleep(0);
		expect(periodic(harness).notes.month.enabled).toBe(true);
		expect(harness.ui.getAllByRole("textbox", { name: "Format" })).toHaveLength(3);
	});
});

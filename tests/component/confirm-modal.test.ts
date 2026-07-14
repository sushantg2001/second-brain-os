import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";

import { App as MockApp } from "../mocks/obsidian";
import { ConfirmationModal } from "../../src/ui/confirm-modal";

function openModal(onAccept: () => void) {
	const modal = new ConfirmationModal(new MockApp() as unknown as App, {
		title: "New note",
		text: "File journal/2024-01-05.md does not exist.",
		cta: "Create daily note",
		onAccept,
	});
	modal.open();
	return modal;
}

describe("ConfirmationModal", () => {
	it("renders title, text, and cta", () => {
		const modal = openModal(vi.fn());
		expect(modal.titleEl.textContent).toBe("New note");
		expect(modal.contentEl.querySelector("p")?.textContent).toContain(
			"does not exist",
		);
		expect(modal.contentEl.querySelector("button.mod-cta")?.textContent).toBe(
			"Create daily note",
		);
	});

	it("runs onAccept and closes when confirmed", () => {
		const onAccept = vi.fn();
		const modal = openModal(onAccept);
		modal.contentEl.querySelector<HTMLButtonElement>("button.mod-cta")?.click();
		expect(onAccept).toHaveBeenCalledOnce();
		expect(document.body.contains(modal.modalEl)).toBe(false);
	});

	it("closes without accepting on cancel", () => {
		const onAccept = vi.fn();
		const modal = openModal(onAccept);
		const cancel = [...modal.contentEl.querySelectorAll("button")].find(
			(el) => el.textContent === "Cancel",
		);
		cancel?.click();
		expect(onAccept).not.toHaveBeenCalled();
		expect(document.body.contains(modal.modalEl)).toBe(false);
	});
});

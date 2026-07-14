import { beforeEach, describe, expect, it, vi } from "vitest";
import { moment, type App } from "obsidian";
import type { Moment } from "moment";

import { App as MockApp } from "../mocks/obsidian";
import { JumpToDateModal } from "../../src/ui/jump-to-date-modal";

function openModal(initial = moment("2024-03-15")) {
	const onPick = vi.fn<(target: Moment) => void>();
	const modal = new JumpToDateModal(
		new MockApp() as unknown as App,
		initial,
		onPick,
	);
	modal.open();
	return { modal, onPick };
}

function yearInput(modal: JumpToDateModal): HTMLInputElement {
	const input = modal.contentEl.querySelector("input");
	expect(input).not.toBeNull();
	return input as HTMLInputElement;
}

function clickButton(root: HTMLElement, text: string): void {
	const button = [...root.querySelectorAll("button")].find(
		(el) => el.textContent === text,
	);
	expect(button, `button "${text}"`).toBeDefined();
	button?.click();
}

describe("JumpToDateModal", () => {
	beforeEach(() => {
		vi.useRealTimers();
	});

	it("opens on the year step with the initial year", () => {
		const { modal } = openModal();
		expect(modal.titleEl.textContent).toBe("Jump to date");
		expect(yearInput(modal).value).toBe("2024");
	});

	it("steps the year with the arrow buttons", () => {
		const { modal } = openModal();
		clickButton(modal.contentEl, "←");
		expect(yearInput(modal).value).toBe("2023");
		clickButton(modal.contentEl, "→");
		clickButton(modal.contentEl, "→");
		expect(yearInput(modal).value).toBe("2025");
	});

	it("shows the month grid after selecting a year", () => {
		const { modal } = openModal();
		clickButton(modal.contentEl, "Next");
		const grid = modal.contentEl.querySelector(".jump-to-date-month-grid");
		expect(grid).not.toBeNull();
		expect(grid?.querySelectorAll("button")).toHaveLength(12);
	});

	it("advances with the enter key", () => {
		const { modal } = openModal();
		yearInput(modal).dispatchEvent(
			new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
		);
		expect(
			modal.contentEl.querySelector(".jump-to-date-month-grid"),
		).not.toBeNull();
	});

	it("highlights the initial month", () => {
		const { modal } = openModal(moment("2024-03-15"));
		clickButton(modal.contentEl, "Next");
		const highlighted = modal.contentEl.querySelector(
			".jump-to-date-month-grid button.mod-cta",
		);
		expect(highlighted?.textContent).toBe("Mar");
	});

	it("picks the chosen month and closes", () => {
		const { modal, onPick } = openModal();
		const input = yearInput(modal);
		input.value = "1999";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		clickButton(modal.contentEl, "Next");
		clickButton(modal.contentEl, "Jul");

		expect(onPick).toHaveBeenCalledOnce();
		const target = onPick.mock.calls[0]?.[0];
		expect(target?.year()).toBe(1999);
		expect(target?.month()).toBe(6);
		expect(target?.date()).toBe(1);
		expect(document.body.contains(modal.modalEl)).toBe(false);
	});

	it("returns to the year step from the month grid", () => {
		const { modal } = openModal();
		clickButton(modal.contentEl, "Next");
		clickButton(modal.contentEl, "Back");
		expect(yearInput(modal).value).toBe("2024");
	});

	it("stays on the year step for an out-of-range year", () => {
		const { modal } = openModal();
		const input = yearInput(modal);
		input.value = "0";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		clickButton(modal.contentEl, "Next");
		expect(modal.contentEl.querySelector(".jump-to-date-month-grid")).toBeNull();
	});

	it("closes on cancel without picking", () => {
		const { modal, onPick } = openModal();
		clickButton(modal.contentEl, "Cancel");
		expect(document.body.contains(modal.modalEl)).toBe(false);
		expect(onPick).not.toHaveBeenCalled();
	});
});

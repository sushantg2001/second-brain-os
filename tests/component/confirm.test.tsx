import { describe, expect, it } from "bun:test";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { App as ObsidianApp } from "obsidian";

import { confirm } from "../../src/shared/react";
import { App, Modal } from "../mocks/obsidian";

const app = new App() as unknown as ObsidianApp;

/** Wrapped in an object: an async function would otherwise wait for the answer itself. */
async function ask(): Promise<{ answer: Promise<boolean> }> {
	let answer: Promise<boolean> = Promise.resolve(false);
	await act(async () => {
		answer = confirm(app, {
			title: "Create note",
			message: "Create it?",
			confirmText: "Create",
		});
		await Promise.resolve();
	});
	return { answer };
}

describe("confirm", () => {
	it("resolves true when confirmed", async () => {
		const { answer } = await ask();
		expect(screen.getByText("Create it?")).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Create" }));
		expect(await answer).toBe(true);
		expect(Modal.open).toHaveLength(0);
	});

	it("resolves false when cancelled", async () => {
		const { answer } = await ask();
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		expect(await answer).toBe(false);
	});

	it("resolves false when closed another way", async () => {
		const { answer } = await ask();
		act(() => Modal.open[0]?.close());
		expect(await answer).toBe(false);
	});
});

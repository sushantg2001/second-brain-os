import { describe, expect, it } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DependencyGate, DependencyGateContext, SetupScreen } from "../../src/features/setup";
import { FakePluginRegistry, READY_PLUGINS } from "../fakes/fake-plugin-registry";

function renderScreen(registry: FakePluginRegistry): DependencyGate {
	const gate = new DependencyGate(registry);
	render(
		<DependencyGateContext.Provider value={gate}>
			<SetupScreen />
		</DependencyGateContext.Provider>,
	);
	return gate;
}

function itemFor(name: string): HTMLElement {
	const list = screen.getByRole("list", { name: "Required plugins" });
	const item = within(list)
		.getAllByRole("listitem")
		.find((element) => within(element).queryByText(name));
	if (!item) {
		throw new Error(`No list item for ${name}`);
	}
	return item;
}

describe("SetupScreen", () => {
	it("lists each required plugin with its state", () => {
		renderScreen(
			new FakePluginRegistry([
				{ id: "obsidian-tasks-plugin", version: "8.6.0", enabled: false },
			]),
		);

		expect(screen.getByRole("heading", { name: "Required plugins" })).toBeInTheDocument();
		expect(within(itemFor("Tasks")).getByText("Installed but not enabled")).toBeInTheDocument();
		expect(within(itemFor("Templater")).getByText("Not installed")).toBeInTheDocument();
		expect(
			screen.getByText(/Install and enable these plugins from Community plugins/),
		).toBeInTheDocument();
	});

	it("shows the installed version against the minimum", () => {
		renderScreen(
			new FakePluginRegistry([
				{ id: "obsidian-tasks-plugin", version: "6.1.0", enabled: true },
			]),
		);

		const tasks = itemFor("Tasks");
		expect(within(tasks).getByText("Update required")).toBeInTheDocument();
		expect(within(tasks).getByText("version 6.1.0, needs 7.0.0 or later")).toBeInTheDocument();
	});

	it("updates after the user enables the missing plugin and checks again", async () => {
		const registry = new FakePluginRegistry(READY_PLUGINS.slice(0, 1));
		renderScreen(registry);
		expect(within(itemFor("Templater")).getByText("Not installed")).toBeInTheDocument();

		registry.set({ id: "templater-obsidian", version: "2.26.0", enabled: true });
		await userEvent.click(screen.getByRole("button", { name: "Check again" }));

		expect(within(itemFor("Templater")).getByText("Ready")).toBeInTheDocument();
		expect(screen.getByText("All required plugins are ready.")).toBeInTheDocument();
	});

	it("fails loudly when rendered without its gate", () => {
		const consoleError = console.error;
		console.error = () => {};
		try {
			expect(() => render(<SetupScreen />)).toThrow(/DependencyGate is not provided/);
		} finally {
			console.error = consoleError;
		}
	});
});

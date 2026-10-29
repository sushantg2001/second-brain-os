import { describe, expect, it } from "bun:test";
import { act } from "@testing-library/react";
import { WorkspaceLeaf } from "obsidian";

import { DependencyGate, SetupView, VIEW_TYPE_SETUP } from "../../src/features/setup";
import { FakePluginRegistry, READY_PLUGINS } from "../fakes/fake-plugin-registry";

describe("SetupView", () => {
	it("describes itself to the workspace", () => {
		const view = new SetupView(
			new WorkspaceLeaf(),
			new DependencyGate(new FakePluginRegistry()),
		);
		expect(view.getViewType()).toBe(VIEW_TYPE_SETUP);
		expect(view.getDisplayText()).toBe("Required plugins");
		expect(view.getIcon()).toBe("plug");
	});

	it("renders the setup screen for its gate", async () => {
		const gate = new DependencyGate(new FakePluginRegistry(READY_PLUGINS));
		const view = new SetupView(new WorkspaceLeaf(), gate);

		await act(() => view.onOpen());
		expect(view.contentEl).toHaveTextContent("Dataview");

		await act(() => view.onClose());
	});
});

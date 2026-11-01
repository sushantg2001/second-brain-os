import { describe, expect, it } from "bun:test";
import { act } from "@testing-library/react";
import { WorkspaceLeaf } from "obsidian";
import type { ReactNode } from "react";

import { ReactItemView } from "../../src/shared/react";

class GreetingView extends ReactItemView {
	override getViewType(): string {
		return "greeting";
	}

	override getDisplayText(): string {
		return "Greeting";
	}

	protected override renderContent(): ReactNode {
		return <p>Hello from React</p>;
	}
}

describe("ReactItemView", () => {
	it("mounts the React tree into the view on open and unmounts it on close", async () => {
		const view = new GreetingView(new WorkspaceLeaf());
		view.contentEl.append(document.createElement("span"));

		await act(() => view.onOpen());
		expect(view.contentEl).toHaveClass("sbos-view");
		expect(view.contentEl).toHaveTextContent("Hello from React");
		expect(view.contentEl.querySelector("span")).toBeNull();

		await act(() => view.onClose());
		expect(view.contentEl).toBeEmptyDOMElement();
	});
});

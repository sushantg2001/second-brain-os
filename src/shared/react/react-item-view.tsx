import { ItemView } from "obsidian";
import { Fragment, StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ErrorBoundary } from "./error-boundary";

const DevelopmentWrapper = process.env.NODE_ENV === "production" ? Fragment : StrictMode;

/**
 * An Obsidian view whose content is a React tree. Each open view owns one React root, which is
 * unmounted when Obsidian closes the view.
 */
export abstract class ReactItemView extends ItemView {
	#root: Root | null = null;

	protected abstract renderContent(): ReactNode;

	override async onOpen(): Promise<void> {
		this.contentEl.replaceChildren();
		this.contentEl.classList.add("sbos-view");
		this.#root = createRoot(this.contentEl);
		this.#root.render(
			<DevelopmentWrapper>
				<ErrorBoundary>{this.renderContent()}</ErrorBoundary>
			</DevelopmentWrapper>,
		);
	}

	override async onClose(): Promise<void> {
		this.#root?.unmount();
		this.#root = null;
	}
}

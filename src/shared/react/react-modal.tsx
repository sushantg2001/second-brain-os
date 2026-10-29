import { Modal, type App } from "obsidian";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ErrorBoundary } from "./error-boundary";

/** An Obsidian modal whose content is a React tree, unmounted on close. */
export abstract class ReactModal extends Modal {
	#root: Root | null = null;

	constructor(app: App, title?: string) {
		super(app);
		if (title) {
			this.setTitle(title);
		}
	}

	protected abstract renderContent(): ReactNode;

	override onOpen(): void {
		this.contentEl.classList.add("sbos-modal");
		this.#root = createRoot(this.contentEl);
		this.#root.render(<ErrorBoundary>{this.renderContent()}</ErrorBoundary>);
	}

	override onClose(): void {
		this.#root?.unmount();
		this.#root = null;
		this.contentEl.replaceChildren();
	}
}

export interface ConfirmOptions {
	readonly title: string;
	readonly message: string;
	readonly confirmText?: string;
}

class ConfirmModal extends ReactModal {
	#answered = false;

	constructor(
		app: App,
		private readonly options: ConfirmOptions,
		private readonly resolve: (confirmed: boolean) => void,
	) {
		super(app, options.title);
	}

	private answer(confirmed: boolean): void {
		if (!this.#answered) {
			this.#answered = true;
			this.resolve(confirmed);
		}
		this.close();
	}

	protected renderContent(): ReactNode {
		return (
			<div className="sbos-confirm">
				<p>{this.options.message}</p>
				<div className="modal-button-container">
					<button type="button" onClick={() => this.answer(false)}>
						Cancel
					</button>
					<button type="button" className="mod-cta" onClick={() => this.answer(true)}>
						{this.options.confirmText ?? "Confirm"}
					</button>
				</div>
			</div>
		);
	}

	override onClose(): void {
		super.onClose();
		if (!this.#answered) {
			this.#answered = true;
			this.resolve(false);
		}
	}
}

/** Asks a yes/no question. Closing the dialog counts as no. */
export function confirm(app: App, options: ConfirmOptions): Promise<boolean> {
	return new Promise((resolve) => new ConfirmModal(app, options, resolve).open());
}

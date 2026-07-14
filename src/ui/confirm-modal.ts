import { App, Modal } from "obsidian";

interface ConfirmationParams {
	title: string;
	text: string;
	cta: string;
	onAccept: () => void;
}

export class ConfirmationModal extends Modal {
	constructor(
		app: App,
		private params: ConfirmationParams,
	) {
		super(app);
	}

	onOpen(): void {
		const { title, text, cta, onAccept } = this.params;
		this.titleEl.setText(title);
		this.contentEl.createEl("p", { text });

		this.contentEl.createDiv("modal-button-container", (buttonsEl) => {
			buttonsEl
				.createEl("button", { text: "Cancel" })
				.addEventListener("click", () => this.close());
			buttonsEl
				.createEl("button", { cls: "mod-cta", text: cta })
				.addEventListener("click", () => {
					onAccept();
					this.close();
				});
		});
	}
}

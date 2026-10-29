/**
 * The smallest stand-in for the `obsidian` module that the UI and app layers need in tests.
 * Domain and application code never import `obsidian`, so they never see this file.
 */

export class Notice {
	static readonly messages: string[] = [];

	constructor(message: string) {
		Notice.messages.push(message);
	}
}

export function setIcon(el: HTMLElement, name: string): void {
	el.dataset.icon = name;
}

export class Component {
	readonly #cleanups: (() => void)[] = [];

	register(cleanup: () => void): void {
		this.#cleanups.push(cleanup);
	}

	unload(): void {
		for (const cleanup of this.#cleanups.splice(0)) {
			cleanup();
		}
	}
}

export class WorkspaceLeaf {}

export class ItemView extends Component {
	readonly contentEl: HTMLElement = document.createElement("div");

	constructor(readonly leaf: WorkspaceLeaf) {
		super();
	}
}

export class Plugin extends Component {}

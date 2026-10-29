import { TFile, type App, type PaneType } from "obsidian";

import type { OpenMode, Workspace } from "../../shared/kernel";

const PANE: Readonly<Record<OpenMode, PaneType | false>> = {
	current: false,
	tab: "tab",
	split: "split",
};

export class ObsidianWorkspace implements Workspace {
	constructor(private readonly app: App) {}

	async open(path: string, mode: OpenMode = "current", line?: number): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			return;
		}
		const leaf = this.app.workspace.getLeaf(PANE[mode]);
		await leaf.openFile(file, {
			active: true,
			...(line === undefined ? {} : { eState: { line } }),
		});
	}

	activePath(): string | null {
		return this.app.workspace.getActiveFile()?.path ?? null;
	}

	onActiveChange(listener: (path: string | null) => void): () => void {
		const ref = this.app.workspace.on("file-open", (file) => listener(file?.path ?? null));
		return () => this.app.workspace.offref(ref);
	}
}

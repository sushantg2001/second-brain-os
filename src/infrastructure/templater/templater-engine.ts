import { TFile, type App } from "obsidian";

import type { TemplateEngine } from "../../shared/kernel";

/** The part of Templater's undocumented plugin object used here. */
interface TemplaterPlugin {
	readonly templater?: {
		overwrite_file_commands?: (file: TFile, activeFile?: boolean) => Promise<void>;
	};
}

/** Runs Templater's "replace templates in file" over a freshly created note. */
export class TemplaterEngine implements TemplateEngine {
	constructor(private readonly app: App) {}

	async process(path: string): Promise<void> {
		const plugins = (this.app as App & { plugins?: { plugins?: Record<string, unknown> } })
			.plugins?.plugins;
		const templater = (plugins?.["templater-obsidian"] as TemplaterPlugin | undefined)
			?.templater;
		const file = this.app.vault.getAbstractFileByPath(path);
		if (templater?.overwrite_file_commands && file instanceof TFile) {
			await templater.overwrite_file_commands(file);
		}
	}
}

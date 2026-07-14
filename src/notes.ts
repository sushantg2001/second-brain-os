import { moment, normalizePath, Notice, TFile, TFolder } from "obsidian";
import type { App, WorkspaceLeaf } from "obsidian";
import type { Moment } from "moment";

import { getFormat } from "./settings";
import type { Granularity, PluginSettings } from "./types";

export function renderTemplate(template: string, date: Moment, title: string): string {
	return template
		.replace(/{{\s*title\s*}}/gi, title)
		.replace(/{{\s*date(?::(.*?))?\s*}}/gi, (_, format: string | undefined) =>
			date.format(format || "YYYY-MM-DD"),
		)
		.replace(/{{\s*time(?::(.*?))?\s*}}/gi, (_, format: string | undefined) =>
			moment().format(format || "HH:mm"),
		);
}

export class PeriodicNotesManager {
	constructor(
		private app: App,
		private getSettings: () => PluginSettings,
	) {}

	getNotePath(granularity: Granularity, date: Moment): string {
		const settings = this.getSettings();
		const folder = settings.notes[granularity].folder;
		const filename = date.format(getFormat(settings, granularity));
		return normalizePath(folder ? `${folder}/${filename}.md` : `${filename}.md`);
	}

	getNote(granularity: Granularity, date: Moment): TFile | null {
		const file = this.app.vault.getAbstractFileByPath(
			this.getNotePath(granularity, date),
		);
		return file instanceof TFile ? file : null;
	}

	getNoteDate(granularity: Granularity, file: TFile): Moment | null {
		const settings = this.getSettings();
		const folder = normalizePath(settings.notes[granularity].folder || "/");
		if (normalizePath(file.parent?.path ?? "/") !== folder) {
			return null;
		}
		const date = moment(file.basename, getFormat(settings, granularity), true);
		return date.isValid() ? date : null;
	}

	getAllNotes(granularity: Granularity): { file: TFile; date: Moment }[] {
		const notes: { file: TFile; date: Moment }[] = [];
		for (const file of this.app.vault.getMarkdownFiles()) {
			const date = this.getNoteDate(granularity, file);
			if (date) {
				notes.push({ file, date });
			}
		}
		return notes;
	}

	async createNote(granularity: Granularity, date: Moment): Promise<TFile> {
		const settings = this.getSettings();
		const path = this.getNotePath(granularity, date);
		const title = date.format(getFormat(settings, granularity));

		let contents = "";
		const templatePath = settings.notes[granularity].template;
		if (templatePath) {
			const templateFile = this.app.vault.getAbstractFileByPath(
				normalizePath(templatePath),
			);
			if (templateFile instanceof TFile) {
				contents = renderTemplate(
					await this.app.vault.cachedRead(templateFile),
					date,
					title,
				);
			} else {
				new Notice(`Template not found: ${templatePath}`);
			}
		}

		await this.ensureFolder(path);
		return this.app.vault.create(path, contents);
	}

	async createOrReturnNote(granularity: Granularity, date: Moment): Promise<TFile> {
		return this.getNote(granularity, date) ?? this.createNote(granularity, date);
	}

	async openNote(
		granularity: Granularity,
		date: Moment,
		inNewSplit = false,
	): Promise<void> {
		const file = await this.createOrReturnNote(granularity, date);
		const { workspace } = this.app;
		const leaf: WorkspaceLeaf = inNewSplit
			? workspace.getLeaf("split")
			: workspace.getLeaf(false);
		await leaf.openFile(file, { active: true });
	}

	private async ensureFolder(notePath: string): Promise<void> {
		const parts = notePath.split("/");
		parts.pop();
		if (parts.length === 0) {
			return;
		}
		const folderPath = normalizePath(parts.join("/"));
		const existing = this.app.vault.getAbstractFileByPath(folderPath);
		if (!(existing instanceof TFolder)) {
			await this.app.vault.createFolder(folderPath);
		}
	}
}

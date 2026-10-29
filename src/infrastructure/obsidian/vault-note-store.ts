import { TFile, type App, type TAbstractFile } from "obsidian";

import type { NoteChange, NoteFile, NoteStore } from "../../shared/kernel";

function toNoteFile(file: TFile): NoteFile {
	return { path: file.path, basename: file.basename };
}

function folderOf(path: string): string {
	const index = path.lastIndexOf("/");
	return index === -1 ? "" : path.slice(0, index);
}

/** NoteStore over the vault and metadata cache. */
export class VaultNoteStore implements NoteStore {
	constructor(private readonly app: App) {}

	exists(path: string): boolean {
		return this.file(path) !== null;
	}

	list(): readonly NoteFile[] {
		return this.app.vault.getMarkdownFiles().map(toNoteFile);
	}

	read(path: string): Promise<string> {
		return this.app.vault.cachedRead(this.require(path));
	}

	async create(path: string, content: string): Promise<void> {
		await this.ensureFolder(folderOf(path));
		await this.app.vault.create(path, content);
	}

	process(path: string, edit: (content: string) => string): Promise<string> {
		return this.app.vault.process(this.require(path), edit);
	}

	frontmatter(path: string): Readonly<Record<string, unknown>> | null {
		const file = this.file(path);
		const frontmatter = file
			? this.app.metadataCache.getFileCache(file)?.frontmatter
			: undefined;
		return (frontmatter as Record<string, unknown> | undefined) ?? null;
	}

	resolveLink(link: string, sourcePath: string): string | null {
		const target =
			link
				.replace(/^\[\[|\]\]$/g, "")
				.split("|")[0]
				?.split("#")[0]
				?.trim() ?? "";
		if (!target) {
			return null;
		}
		return this.app.metadataCache.getFirstLinkpathDest(target, sourcePath)?.path ?? null;
	}

	onChange(listener: (change: NoteChange) => void): () => void {
		const { vault, metadataCache } = this.app;
		const markdown = (file: TAbstractFile): file is TFile =>
			file instanceof TFile && file.extension === "md";
		const refs = [
			vault.on(
				"create",
				(file) => markdown(file) && listener({ type: "create", path: file.path }),
			),
			vault.on(
				"delete",
				(file) => markdown(file) && listener({ type: "delete", path: file.path }),
			),
			vault.on(
				"rename",
				(file, oldPath) =>
					markdown(file) && listener({ type: "rename", path: file.path, oldPath }),
			),
			// "changed" fires after the cache is updated, so front matter is fresh for listeners.
			metadataCache.on("changed", (file) => listener({ type: "modify", path: file.path })),
		];
		return () => {
			for (const ref of refs) {
				vault.offref(ref);
				metadataCache.offref(ref);
			}
		};
	}

	private file(path: string): TFile | null {
		const file = this.app.vault.getAbstractFileByPath(path);
		return file instanceof TFile ? file : null;
	}

	private require(path: string): TFile {
		const file = this.file(path);
		if (!file) {
			throw new Error(`Note not found: ${path}`);
		}
		return file;
	}

	private async ensureFolder(folder: string): Promise<void> {
		if (!folder || this.app.vault.getAbstractFileByPath(folder)) {
			return;
		}
		await this.ensureFolder(folderOf(folder));
		await this.app.vault.createFolder(folder);
	}
}

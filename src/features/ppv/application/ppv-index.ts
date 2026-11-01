import { Store, type NoteStore, type ReadableStore } from "../../../shared/kernel";
import { readPpvNote, type PpvNote } from "../domain/ppv-note";
import type { PpvSettings, PpvType } from "../domain/settings";
import { buildTree, type PpvTree } from "../domain/tree";

export interface PpvSnapshot {
	readonly notes: ReadonlyMap<string, PpvNote>;
	readonly tree: PpvTree;
	readonly version: number;
}

/** Every pillar, goal, project and resource, from front matter, kept current. */
export class PpvIndex {
	readonly #store: Store<PpvSnapshot>;

	constructor(
		private readonly notes: NoteStore,
		private readonly settings: ReadableStore<PpvSettings>,
	) {
		this.#store = new Store<PpvSnapshot>({ notes: new Map(), tree: buildTree([]), version: 0 });
	}

	get snapshot(): ReadableStore<PpvSnapshot> {
		return this.#store;
	}

	get(path: string): PpvNote | null {
		return this.#store.get().notes.get(path) ?? null;
	}

	ofType(type: PpvType): PpvNote[] {
		return [...this.#store.get().notes.values()]
			.filter((note) => note.type === type)
			.sort((a, b) => a.title.localeCompare(b.title));
	}

	rebuild(): void {
		const settings = this.settings.get();
		const notes = new Map<string, PpvNote>();
		for (const file of this.notes.list()) {
			const note = readPpvNote(
				file.path,
				file.basename,
				this.notes.frontmatter(file.path),
				settings,
				(link) => this.notes.resolveLink(link, file.path),
			);
			if (note) {
				notes.set(file.path, note);
			}
		}
		this.#store.set({
			notes,
			tree: buildTree(notes.values()),
			version: this.#store.get().version + 1,
		});
	}

	/** Keeps the index current. Returns the unsubscribe function. */
	attach(): () => void {
		const offNotes = this.notes.onChange(() => this.rebuild());
		const offSettings = this.settings.subscribe(() => this.rebuild());
		return () => {
			offNotes();
			offSettings();
		};
	}
}

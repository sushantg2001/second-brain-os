import {
	err,
	ok,
	Store,
	type Clock,
	type DateFormatter,
	type IsoDate,
	type NoteStore,
	type OpenMode,
	type ReadableStore,
	type Result,
	type TemplateEngine,
	type Workspace,
} from "../../../shared/kernel";
import { GRANULARITIES, type Granularity } from "../domain/granularity";
import { normalizeVaultPath, notePath, parentFolder, withMarkdownExtension } from "../domain/paths";
import { adjacentDate, periodStart } from "../domain/period";
import { formatOf, resolveWeekStart, type PeriodicSettings } from "../domain/settings";
import { renderTemplate } from "../domain/template";

/** Existing periodic notes: period start date to note path, per granularity. */
export type PeriodicIndex = Readonly<Record<Granularity, ReadonlyMap<IsoDate, string>>>;

export class PeriodicError extends Error {
	override readonly name = "PeriodicError";
}

export interface PeriodicNotesDeps {
	readonly settings: ReadableStore<PeriodicSettings>;
	readonly notes: NoteStore;
	readonly dates: DateFormatter;
	readonly workspace: Workspace;
	readonly templates: TemplateEngine | null;
	readonly clock: Clock;
}

function emptyIndex(): PeriodicIndex {
	return {
		day: new Map(),
		week: new Map(),
		month: new Map(),
		quarter: new Map(),
		year: new Map(),
	};
}

export class PeriodicNotes {
	readonly #index = new Store<PeriodicIndex>(emptyIndex());

	constructor(private readonly deps: PeriodicNotesDeps) {}

	get index(): ReadableStore<PeriodicIndex> {
		return this.#index;
	}

	get settingsStore(): ReadableStore<PeriodicSettings> {
		return this.deps.settings;
	}

	get settings(): PeriodicSettings {
		return this.deps.settings.get();
	}

	weekStart(): number {
		return resolveWeekStart(this.settings.weekStart, this.deps.dates.localeWeekStart());
	}

	today(): IsoDate {
		return this.deps.clock.today();
	}

	enabled(granularity: Granularity): boolean {
		return this.settings.notes[granularity].enabled;
	}

	enabledGranularities(): Granularity[] {
		return GRANULARITIES.filter((granularity) => this.enabled(granularity));
	}

	periodOf(granularity: Granularity, date: IsoDate): IsoDate {
		return periodStart(date, granularity, this.weekStart());
	}

	title(granularity: Granularity, date: IsoDate): string {
		return this.deps.dates.format(
			this.periodOf(granularity, date),
			formatOf(this.settings, granularity),
		);
	}

	pathFor(granularity: Granularity, date: IsoDate): string {
		return notePath(this.settings.notes[granularity].folder, this.title(granularity, date));
	}

	/** The note's path when it exists. */
	find(granularity: Granularity, date: IsoDate): string | null {
		const path = this.pathFor(granularity, date);
		return this.deps.notes.exists(path) ? path : null;
	}

	/** The period start a note stands for, or null when it is not a note of this granularity. */
	dateOf(granularity: Granularity, path: string): IsoDate | null {
		const folder = normalizeVaultPath(this.settings.notes[granularity].folder);
		const normalized = normalizeVaultPath(path);
		if (!normalized.toLowerCase().endsWith(".md")) {
			return null;
		}
		let relative = normalized.slice(0, -3);
		if (folder) {
			if (!relative.startsWith(`${folder}/`)) {
				return null;
			}
			relative = relative.slice(folder.length + 1);
		}
		const format = formatOf(this.settings, granularity);
		// Without a "/" in the format, the note must sit directly in the folder.
		if (!format.includes("/") && parentFolder(normalized) !== folder) {
			return null;
		}
		const date = this.deps.dates.parse(relative, format);
		return date === null ? null : this.periodOf(granularity, date);
	}

	/** Finds which enabled granularity a note belongs to, finest first. */
	identify(path: string): { granularity: Granularity; date: IsoDate } | null {
		for (const granularity of this.enabledGranularities()) {
			const date = this.dateOf(granularity, path);
			if (date !== null) {
				return { granularity, date };
			}
		}
		return null;
	}

	/** Rebuilds the index of existing notes from the vault. */
	refresh(): void {
		const index = emptyIndex();
		const enabled = this.enabledGranularities();
		for (const file of this.deps.notes.list()) {
			for (const granularity of enabled) {
				const date = this.dateOf(granularity, file.path);
				if (date !== null) {
					(index[granularity] as Map<IsoDate, string>).set(date, file.path);
				}
			}
		}
		this.#index.set(index);
	}

	/** Returns the note for the period, creating it from its template when missing. */
	async ensure(
		granularity: Granularity,
		date: IsoDate,
	): Promise<Result<{ path: string; created: boolean }, PeriodicError>> {
		const path = this.pathFor(granularity, date);
		if (this.deps.notes.exists(path)) {
			return ok({ path, created: false });
		}
		const content = await this.initialContent(granularity, date);
		if (!content.ok) {
			return content;
		}
		try {
			await this.deps.notes.create(path, content.value);
		} catch (error) {
			return err(new PeriodicError(`Could not create ${path}: ${describe(error)}`));
		}
		if (this.deps.templates && content.value.includes("<%")) {
			await this.deps.templates.process(path);
		}
		this.refresh();
		return ok({ path, created: true });
	}

	async open(
		granularity: Granularity,
		date: IsoDate,
		mode: OpenMode = "current",
	): Promise<Result<string, PeriodicError>> {
		const note = await this.ensure(granularity, date);
		if (!note.ok) {
			return note;
		}
		await this.deps.workspace.open(note.value.path, mode);
		return ok(note.value.path);
	}

	/** The closest existing note before or after the active one (or today). */
	adjacent(granularity: Granularity, direction: "next" | "prev"): IsoDate | null {
		const active = this.deps.workspace.activePath();
		const current =
			(active && this.dateOf(granularity, active)) ||
			this.periodOf(granularity, this.today());
		return adjacentDate(this.#index.get()[granularity].keys(), current, direction);
	}

	private async initialContent(
		granularity: Granularity,
		date: IsoDate,
	): Promise<Result<string, PeriodicError>> {
		const templatePath = this.settings.notes[granularity].template.trim();
		if (!templatePath) {
			return ok("");
		}
		const path = withMarkdownExtension(templatePath);
		if (!this.deps.notes.exists(path)) {
			return err(new PeriodicError(`Template not found: ${templatePath}`));
		}
		const start = this.periodOf(granularity, date);
		const template = await this.deps.notes.read(path);
		return ok(
			renderTemplate(template, {
				title: this.title(granularity, date),
				formatDate: (format) => this.deps.dates.format(start, format),
				formatNow: (format) => this.deps.dates.formatNow(format),
			}),
		);
	}
}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

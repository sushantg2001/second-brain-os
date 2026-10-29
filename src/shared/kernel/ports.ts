/**
 * Ports used by more than one feature. Adapters in src/infrastructure implement them, and
 * tests use the fakes in tests/fakes. Feature-specific ports live in the feature.
 */
import type { IsoDate } from "./date";
import type { Result } from "./result";
import type { ReadableStore } from "./store";
import type { Minutes } from "./time";

export interface NoteFile {
	/** Vault path with extension, such as "Daily/2026-10-29.md". */
	readonly path: string;
	readonly basename: string;
}

export type NoteChange =
	| { readonly type: "create" | "modify" | "delete"; readonly path: string }
	| { readonly type: "rename"; readonly path: string; readonly oldPath: string };

export interface NoteStore {
	exists(path: string): boolean;
	/** Every Markdown note in the vault. */
	list(): readonly NoteFile[];
	read(path: string): Promise<string>;
	/** Creates the note and any missing folders. Fails if the path is taken. */
	create(path: string, content: string): Promise<void>;
	/** Atomic read-modify-write. The edit must be pure. Returns the new content. */
	process(path: string, edit: (content: string) => string): Promise<string>;
	/** Edits front matter in place through Obsidian, keeping the body untouched. */
	updateFrontmatter(
		path: string,
		edit: (frontmatter: Record<string, unknown>) => void,
	): Promise<void>;
	/** Moves or renames a note, updating links to it. Creates the target folder if needed. */
	move(path: string, newPath: string): Promise<void>;
	/** Creates a folder and its parents when missing. True when something was created. */
	ensureFolder(path: string): Promise<boolean>;
	/** Parsed front matter from the metadata cache, or null. */
	frontmatter(path: string): Readonly<Record<string, unknown>> | null;
	/** Resolves a wikilink target as written in `sourcePath`, or null when unresolved. */
	resolveLink(link: string, sourcePath: string): string | null;
	onChange(listener: (change: NoteChange) => void): () => void;
}

export type OpenMode = "current" | "tab" | "split";

export interface Workspace {
	open(path: string, mode?: OpenMode, line?: number): Promise<void>;
	activePath(): string | null;
	onActiveChange(listener: (path: string | null) => void): () => void;
}

export interface DateFormatter {
	format(date: IsoDate, format: string): string;
	/** Strict parse. Null when the text does not match the format exactly. */
	parse(text: string, format: string): IsoDate | null;
	/** Formats the current moment, for {{time}}. */
	formatNow(format: string): string;
	/** First day of the week in the user's locale, 0 (Sunday) to 6. */
	localeWeekStart(): number;
	/** Short weekday name, 0 is Sunday. */
	weekdayShort(day: number): string;
}

export interface Clock {
	today(): IsoDate;
	/** Minutes since local midnight. */
	nowMinutes(): Minutes;
	/** Milliseconds since the epoch. */
	now(): number;
}

export interface TemplateEngine {
	/** Runs the template plugin over a note that already holds template text. */
	process(path: string): Promise<void>;
}

export interface Notifier {
	notify(message: string): void;
}

/** One feature's slice of the plugin settings. */
export interface SettingsSection<T> {
	readonly store: ReadableStore<T>;
	update(updater: (current: T) => T): Promise<Result<T, Error>>;
}

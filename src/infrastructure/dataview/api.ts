/**
 * The part of Dataview's API this plugin reads, written out as types.
 *
 * Dataview's own typings import each other by bare paths that a plugin cannot resolve, so they
 * come out as `any`. These are checked against Dataview 0.5.68 instead (`DataviewApi.page`,
 * `FullIndex.pages` and `initialized`, and the serialized list items of `SMarkdownPage`), and
 * `tests/fakes/fake-dataview.ts` is tested against what Dataview's importer returns.
 */

/** A Luxon `DateTime`, as far as dates are read here. */
export interface DataviewDate {
	toISODate(): string | null;
}

export interface DataviewLink {
	/** The note a link points to as written, without a heading or block. */
	readonly path: string;
}

/**
 * A list item or task of a note. Its inline fields are properties of it, one value or an array
 * when the field was written more than once, so anything else is `unknown`.
 */
export interface DataviewListItem {
	readonly line: number;
	/** Lines the item takes, its first line and any continuing it, not the items nested under it. */
	readonly lineCount: number;
	/** Line of the item this one is nested under. */
	readonly parent?: number;
	readonly task: boolean;
	/** The checkbox character, for tasks. */
	readonly status?: string;
	/** The text after the checkbox, one line per line of the item. */
	readonly text: string;
	readonly outlinks: readonly DataviewLink[];
	/** The heading above the item is `subpath`. */
	readonly section: { readonly subpath?: string };
	readonly children: readonly DataviewListItem[];
	readonly [field: string]: unknown;
}

export interface DataviewPage {
	readonly file: { readonly lists: readonly DataviewListItem[] };
}

export interface DataviewApi {
	readonly index: {
		/** True once every note has been indexed. */
		readonly initialized: boolean;
		readonly pages: ReadonlyMap<
			string,
			{ readonly lists: readonly { readonly task?: unknown }[] }
		>;
	};
	page(path: string): DataviewPage | undefined;
}

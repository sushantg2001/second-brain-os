/**
 * A stand-in for the Dataview plugin, for tests.
 *
 * It reads the notes of the fake vault and answers `app.plugins.plugins.dataview.api` the way
 * Dataview 0.5.68 does for the parts this plugin uses: `index.initialized`, `index.pages`,
 * `page(path).file.lists`, and the `dataview:metadata-change` and `dataview:index-ready` events.
 * `tests/unit/dataview/importer-contract.test.ts` checks it against what Dataview's own
 * importer returned for the same notes.
 *
 * Lists are read the way Obsidian reports them: an item holds the lines indented under it that
 * are not list lines, and nests under the closest item indented less than it.
 */
import type {
	DataviewApi,
	DataviewDate,
	DataviewListItem,
} from "../../src/infrastructure/dataview";
import { App, type TAbstractFile, type TFile } from "../mocks/obsidian";

const LIST = /^([ \t>]*)([-*+]|\d+[.)])(?:[ \t]+|$)(?:\[(.?)\](?:[ \t]+|$))?(.*)$/;
const HEADING = /^#{1,6}\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;

/** The Tasks emoji dates Dataview reads as fields of a task. */
const EMOJI_FIELDS: readonly (readonly [string, RegExp])[] = [
	["created", /\u{2795}\s*(\d{4}-\d{2}-\d{2})/u],
	["start", /\u{1F6EB}\s*(\d{4}-\d{2}-\d{2})/u],
	["scheduled", /[\u{23F3}\u{231B}]\s*(\d{4}-\d{2}-\d{2})/u],
	["due", /(?:\u{1F4C5}|\u{1F4C6}|\u{1F5D3}\u{FE0F}?)\s*(\d{4}-\d{2}-\d{2})/u],
	["completion", /\u{2705}\s*(\d{4}-\d{2}-\d{2})/u],
];

function width(indent: string): number {
	let total = 0;
	for (const char of indent) {
		total += char === "\t" ? 4 : char === ">" ? 0 : 1;
	}
	return total;
}

/** A value as Dataview reads it: a date becomes a date, a number a number, the rest text. */
function valueOf(raw: string): unknown {
	const text = raw.trim();
	const link = /^\[\[([^\]|#^]+)[^\]]*\]\]$/.exec(text);
	if (link) {
		return { path: link[1] };
	}
	if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
		const date: DataviewDate = { toISODate: () => text };
		return date;
	}
	return /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : text;
}

/** `[key:: value]` and `(key:: value)`, where the value can hold brackets of its own. */
function inlineFields(text: string): { start: number; end: number; key: string; value: string }[] {
	const found: { start: number; end: number; key: string; value: string }[] = [];
	for (let at = 0; at < text.length; at++) {
		const open = text[at];
		const key = /^[[(]([\w-]+)::/.exec(text.slice(at));
		if ((open !== "[" && open !== "(") || !key) {
			continue;
		}
		const close = open === "[" ? "]" : ")";
		let depth = 0;
		for (let end = at; end < text.length; end++) {
			if (text[end] === open) {
				depth++;
			} else if (text[end] === close && --depth === 0) {
				found.push({
					start: at,
					end: end + 1,
					key: key[1] ?? "",
					value: text.slice(at + key[0].length, end),
				});
				at = end;
				break;
			}
		}
	}
	return found;
}

/**
 * The fields of a task in the order they are written, inline ones and the Tasks emoji dates
 * together. A field that starts inside an earlier one is not a field.
 */
function fieldsIn(text: string, task: boolean): { key: string; value: string }[] {
	const found = inlineFields(text);
	if (task) {
		for (const [key, pattern] of EMOJI_FIELDS) {
			const match = pattern.exec(text);
			if (match?.[1]) {
				found.push({
					start: match.index,
					end: match.index + match[0].length,
					key,
					value: match[1],
				});
			}
		}
	}
	found.sort((a, b) => a.start - b.start);
	const kept: typeof found = [];
	for (const field of found) {
		if (kept.length === 0 || (kept.at(-1)?.end ?? 0) < field.start) {
			kept.push(field);
		}
	}
	return kept;
}

interface Draft {
	line: number;
	end: number;
	task: boolean;
	status: string | undefined;
	parts: string[];
	parent: Draft | null;
	children: Draft[];
	heading: string | null;
}

function frontmatterLength(lines: readonly string[]): number {
	if (lines[0]?.trim() !== "---") {
		return 0;
	}
	const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
	return end === -1 ? 0 : end + 1;
}

/** Reads a note into list items the way Dataview's API serializes them. */
export function readLists(content: string): DataviewListItem[] {
	const lines = content.split(/\r?\n/);
	const drafts: Draft[] = [];
	const open: { draft: Draft; width: number }[] = [];
	let fence: string | null = null;
	let heading: string | null = null;
	for (let index = frontmatterLength(lines); index < lines.length; index++) {
		const raw = lines[index] ?? "";
		const fenceMatch = FENCE.exec(raw);
		if (fenceMatch) {
			fence = fence === null ? (fenceMatch[1] ?? "") : fence === fenceMatch[1] ? null : fence;
			continue;
		}
		if (fence !== null) {
			continue;
		}
		const headingMatch = HEADING.exec(raw);
		if (headingMatch) {
			heading = headingMatch[1] ?? null;
			open.length = 0;
			continue;
		}
		const match = LIST.exec(raw);
		if (!match) {
			if (raw.trim() === "") {
				continue;
			}
			const hosts = open.filter(
				(entry) => entry.width < width(/^[ \t]*/.exec(raw)?.[0] ?? ""),
			);
			open.length = hosts.length;
			const host = hosts.at(-1)?.draft;
			if (host) {
				host.parts.push(raw.trim());
				host.end = index;
			}
			continue;
		}
		const at = width(match[1] ?? "");
		while (open.length > 0 && (open.at(-1)?.width ?? 0) >= at) {
			open.pop();
		}
		const parent = open.at(-1)?.draft ?? null;
		const draft: Draft = {
			line: index,
			end: index,
			task: match[3] !== undefined,
			status: match[3] === undefined ? undefined : match[3] === "" ? " " : match[3],
			parts: [(match[4] ?? "").trim()],
			parent,
			children: [],
			heading,
		};
		parent?.children.push(draft);
		drafts.push(draft);
		open.push({ draft, width: at });
	}

	const built = new Map<Draft, DataviewListItem>();
	const build = (draft: Draft): DataviewListItem => {
		const known = built.get(draft);
		if (known) {
			return known;
		}
		const joined = draft.parts.join(" ");
		const fields = new Map<string, unknown[]>();
		const add = (key: string, value: unknown): void => {
			fields.set(key, [...(fields.get(key) ?? []), value]);
		};
		for (const field of fieldsIn(joined, draft.task)) {
			add(field.key, valueOf(field.value));
		}
		const item: Record<string, unknown> = {
			text: draft.parts.join("\n"),
			line: draft.line,
			lineCount: draft.end - draft.line + 1,
			outlinks: [...joined.matchAll(/\[\[([^\]|#^]+)[^\]]*\]\]/g)].map((link) => ({
				path: link[1] ?? "",
			})),
			children: [] as DataviewListItem[],
			task: draft.task,
			section: { subpath: draft.heading ?? undefined },
		};
		if (draft.parent) {
			item["parent"] = draft.parent.line;
		}
		for (const [key, values] of fields) {
			if (!(key in item)) {
				item[key] = values.length === 1 ? values[0] : values;
			}
		}
		if (draft.task) {
			item["status"] = draft.status;
			const first = (...keys: string[]): unknown =>
				keys.map((key) => fields.get(key)?.[0]).find((value) => value !== undefined);
			for (const [key, aliases] of [
				["created", ["created"]],
				["due", ["due"]],
				["completion", ["completed", "completion"]],
				["start", ["start"]],
				["scheduled", ["scheduled"]],
			] as const) {
				const value = first(...aliases);
				if (value !== undefined) {
					item[key] = value;
				}
			}
		}
		built.set(draft, item as unknown as DataviewListItem);
		(item["children"] as DataviewListItem[]).push(...draft.children.map(build));
		return item as unknown as DataviewListItem;
	};
	return drafts.map(build);
}

export interface FakeDataview {
	readonly api: DataviewApi;
}

/** Installs the fake as the `dataview` plugin of the app and indexes the vault as it is now. */
export function installDataview(app: App): FakeDataview {
	const pages = new Map<string, DataviewListItem[]>();
	const view = new Map<string, { lists: { task?: unknown }[] }>();
	let initialized = false;

	const read = (file: TAbstractFile): void => {
		if (!("extension" in file) || (file as TFile).extension !== "md") {
			return;
		}
		const lists = readLists(app.vault.contentOf(file.path) ?? "");
		pages.set(file.path, lists);
		view.set(file.path, { lists: lists.map((item) => ({ task: item.task ? {} : undefined })) });
	};
	const drop = (path: string): void => {
		pages.delete(path);
		view.delete(path);
	};

	const api: DataviewApi = {
		index: {
			get initialized() {
				return initialized;
			},
			pages: view,
		},
		page: (path) => {
			const lists = pages.get(path);
			return lists ? { file: { lists } } : undefined;
		},
	};

	for (const file of app.vault.getMarkdownFiles()) {
		read(file);
	}
	app.plugins.plugins["dataview"] = { ...(app.plugins.plugins["dataview"] as object), api };
	initialized = true;

	app.vault.on("create", (file: TAbstractFile) => {
		read(file);
		app.metadataCache.trigger("dataview:metadata-change", "update", file);
	});
	app.vault.on("modify", (file: TAbstractFile) => {
		read(file);
		app.metadataCache.trigger("dataview:metadata-change", "update", file);
	});
	app.vault.on("delete", (file: TAbstractFile) => {
		drop(file.path);
		app.metadataCache.trigger("dataview:metadata-change", "delete", file);
	});
	app.vault.on("rename", (file: TAbstractFile, oldPath: string) => {
		drop(oldPath);
		read(file);
		app.metadataCache.trigger("dataview:metadata-change", "rename", file, oldPath);
	});
	app.metadataCache.trigger("dataview:index-ready");
	return { api };
}

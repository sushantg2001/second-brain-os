import { isIsoDate, type IsoDate } from "../../../shared/kernel";
import {
	PPV_TYPES,
	PROJECT_STATUSES,
	type PpvSettings,
	type PpvType,
	type ProjectStatus,
} from "./settings";

export interface PpvNote {
	readonly path: string;
	readonly title: string;
	readonly type: PpvType;
	/** Projects only; other types are "active". */
	readonly status: ProjectStatus;
	/** Resolved path of the parent note, or null. */
	readonly parent: string | null;
	/** The parent link as written, for messages when it does not resolve. */
	readonly parentLink: string | null;
	readonly due: IsoDate | null;
	readonly start: IsoDate | null;
	/** Goals: "value" or "outcome". */
	readonly kind: string | null;
}

/** Front matter keys that link to a parent, in order of preference, per type. */
export const PARENT_KEYS: Readonly<Record<PpvType, readonly string[]>> = {
	pillar: [],
	goal: ["pillar"],
	project: ["goal", "pillar"],
	resource: ["project", "pillar"],
};

function folderOf(path: string): string {
	const index = path.lastIndexOf("/");
	return index === -1 ? "" : path.slice(0, index);
}

function trimSlashes(path: string): string {
	return path.replace(/^\/+|\/+$/g, "");
}

function first(value: unknown): unknown {
	return Array.isArray(value) ? value[0] : value;
}

function text(value: unknown): string | null {
	const single = first(value);
	if (typeof single === "string") {
		return single.trim() || null;
	}
	return null;
}

function date(value: unknown): IsoDate | null {
	const single = first(value);
	const raw =
		single instanceof Date
			? single.toISOString().slice(0, 10)
			: typeof single === "string"
				? single.trim()
				: "";
	return isIsoDate(raw) ? raw : null;
}

/**
 * The PPV type of a note: `type` in front matter wins; otherwise a note directly inside a type's
 * folder has that type. Anything else is not a PPV note.
 */
export function classify(
	path: string,
	frontmatter: Readonly<Record<string, unknown>> | null,
	settings: PpvSettings,
): PpvType | null {
	const declared = text(frontmatter?.type)?.toLowerCase();
	if (declared) {
		return (PPV_TYPES as readonly string[]).includes(declared) ? (declared as PpvType) : null;
	}
	const folder = folderOf(path);
	return (
		PPV_TYPES.find((type) => trimSlashes(settings.folders[type]) === folder && folder !== "") ??
		null
	);
}

/** Reads a PPV note from its front matter. `resolve` turns a link into a vault path. */
export function readPpvNote(
	path: string,
	title: string,
	frontmatter: Readonly<Record<string, unknown>> | null,
	settings: PpvSettings,
	resolve: (link: string) => string | null,
): PpvNote | null {
	const type = classify(path, frontmatter, settings);
	if (!type) {
		return null;
	}
	let parent: string | null = null;
	let parentLink: string | null = null;
	for (const key of PARENT_KEYS[type]) {
		const link = text(frontmatter?.[key]);
		if (link) {
			parentLink = link;
			parent = resolve(link);
			break;
		}
	}
	const rawStatus = text(frontmatter?.status)?.toLowerCase() ?? "";
	const status =
		type === "project"
			? (PROJECT_STATUSES as readonly string[]).includes(rawStatus)
				? (rawStatus as ProjectStatus)
				: "active"
			: "active";
	return {
		path,
		title,
		type,
		status,
		parent,
		parentLink,
		due: date(frontmatter?.due),
		start: date(frontmatter?.start),
		kind: type === "goal" ? (text(frontmatter?.kind) ?? "outcome") : null,
	};
}

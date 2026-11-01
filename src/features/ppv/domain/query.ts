import { err, ok, type Result } from "../../../shared/kernel";
import type { PpvNote } from "./ppv-note";
import { PROJECT_STATUSES, type ProjectStatus } from "./settings";

/** The body of an `sbos` code block. */
export interface BlockQuery {
	readonly view: "projects" | "tasks";
	readonly statuses: readonly ProjectStatus[];
	/** Title of a pillar or goal the projects must sit under. */
	readonly under: string | null;
	readonly limit: number;
}

const VIEWS = ["projects", "tasks"] as const;

/**
 * Parses lines of `key: value`. Keys: view (projects or tasks), status (comma-separated),
 * pillar or goal (a title, with or without [[ ]]), limit.
 */
export function parseBlockQuery(source: string): Result<BlockQuery, Error> {
	let view: BlockQuery["view"] = "projects";
	let statuses: ProjectStatus[] = ["active"];
	let under: string | null = null;
	let limit = 50;
	for (const rawLine of source.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) {
			continue;
		}
		const match = /^(\w+)\s*:\s*(.*)$/.exec(line);
		if (!match) {
			return err(new Error(`Cannot read "${line}". Use key: value.`));
		}
		const key = (match[1] ?? "").toLowerCase();
		const value = (match[2] ?? "").trim();
		if (key === "view") {
			if (!(VIEWS as readonly string[]).includes(value)) {
				return err(new Error(`Unknown view "${value}". Use projects or tasks.`));
			}
			view = value as BlockQuery["view"];
		} else if (key === "status") {
			const wanted =
				value === "all"
					? [...PROJECT_STATUSES]
					: value.split(",").map((part) => part.trim().toLowerCase());
			const unknown = wanted.find(
				(status) => !(PROJECT_STATUSES as readonly string[]).includes(status),
			);
			if (unknown !== undefined) {
				return err(new Error(`Unknown status "${unknown}".`));
			}
			statuses = wanted as ProjectStatus[];
		} else if (key === "pillar" || key === "goal") {
			under = value.replace(/^\[\[|\]\]$/g, "").trim() || null;
		} else if (key === "limit") {
			const parsed = Number(value);
			if (!Number.isInteger(parsed) || parsed < 1) {
				return err(new Error("limit must be a whole number above 0."));
			}
			limit = parsed;
		} else {
			return err(new Error(`Unknown key "${key}".`));
		}
	}
	return ok({ view, statuses, under, limit });
}

/** Projects matching a query. `ancestors` lists a project's parent chain titles. */
export function selectProjects(
	notes: Iterable<PpvNote>,
	query: BlockQuery,
	ancestors: (note: PpvNote) => readonly string[],
): PpvNote[] {
	const wanted = query.under?.toLowerCase() ?? null;
	return [...notes]
		.filter(
			(note) =>
				note.type === "project" &&
				query.statuses.includes(note.status) &&
				(wanted === null ||
					ancestors(note).some((title) => title.toLowerCase() === wanted)),
		)
		.sort(
			(a, b) =>
				(a.due ?? "9999").localeCompare(b.due ?? "9999") || a.title.localeCompare(b.title),
		)
		.slice(0, query.limit);
}

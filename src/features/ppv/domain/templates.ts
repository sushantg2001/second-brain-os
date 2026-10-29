import type { IsoDate } from "../../../shared/kernel";
import type { PpvType, ProjectStatus } from "./settings";

export interface NewNoteInput {
	readonly type: PpvType;
	readonly title: string;
	/** Title of the parent note to link, or null. */
	readonly parentTitle: string | null;
	readonly status: ProjectStatus;
	readonly today: IsoDate;
}

const PARENT_KEY: Readonly<Record<PpvType, string | null>> = {
	pillar: null,
	goal: "pillar",
	project: "goal",
	resource: "project",
};

/** Characters Obsidian does not allow in file names, and link syntax characters. */
const UNSAFE = /[\\/:*?"<>|#^[\]]/g;

export function safeFileName(title: string): string {
	return title.replace(UNSAFE, " ").replace(/\s+/g, " ").trim();
}

function quote(value: string): string {
	return JSON.stringify(value);
}

/**
 * Built-in note content for a new PPV note. A project's parent key is `goal` unless the parent is
 * a pillar, which the caller decides through `parentKey`.
 */
export function defaultContent(input: NewNoteInput, parentKey = PARENT_KEY[input.type]): string {
	const lines = ["---", `type: ${input.type}`];
	if (input.type === "project") {
		lines.push(`status: ${input.status}`, `start: ${input.today}`, "due: ");
	}
	if (input.type === "goal") {
		lines.push("kind: outcome", "due: ");
	}
	if (parentKey && input.parentTitle) {
		lines.push(`${parentKey}: ${quote(`[[${input.parentTitle}]]`)}`);
	}
	lines.push("---", `# ${input.title}`, "");
	const body: Record<PpvType, string[]> = {
		pillar: ["## Why it matters", "", "## Standards", ""],
		goal: ["## Outcome", "", "## Projects", ""],
		project: ["## Outcome", "", "## Next actions", "- [ ] ", ""],
		resource: ["## Notes", ""],
	};
	return [...lines, ...body[input.type]].join("\n");
}

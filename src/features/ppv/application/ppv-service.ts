import {
	err,
	ok,
	type Clock,
	type NoteStore,
	type ReadableStore,
	type Result,
	type TemplateEngine,
} from "../../../shared/kernel";
import {
	normalizeVaultPath,
	renderTemplate,
	withMarkdownExtension,
	type PeriodicNotes,
} from "../../periodic";
import {
	appendToSection,
	isClosed,
	setStatusLine,
	STATE_SYMBOL,
	stateOf,
	type Task,
	type TaskActions,
	type TaskIndex,
	type TaskRef,
	type TaskState,
} from "../../tasks";
import type { PpvNote } from "../domain/ppv-note";
import {
	isClosedStatus,
	PPV_TYPES,
	type PpvSettings,
	type PpvType,
	type ProjectStatus,
} from "../domain/settings";
import { defaultContent, safeFileName } from "../domain/templates";
import type { PpvIndex } from "./ppv-index";

export interface PpvServiceDeps {
	readonly index: PpvIndex;
	readonly tasks: TaskIndex;
	readonly actions: TaskActions;
	readonly notes: NoteStore;
	readonly periodic: PeriodicNotes;
	readonly settings: ReadableStore<PpvSettings>;
	readonly templates: TemplateEngine | null;
	readonly clock: Clock;
	readonly formatDate: (date: string, format: string) => string;
}

/** The order "Cycle task stage" moves through. Done is reached by completing the task. */
export const STAGE_CYCLE: readonly TaskState[] = ["todo", "in-progress", "waiting"];

export function nextStage(state: TaskState): TaskState {
	const index = STAGE_CYCLE.indexOf(state);
	return STAGE_CYCLE[(index + 1) % STAGE_CYCLE.length] ?? "todo";
}

const PARENT_KEYS: Readonly<Record<PpvType, Partial<Record<PpvType, string>>>> = {
	pillar: {},
	goal: { pillar: "pillar" },
	project: { goal: "goal", pillar: "pillar" },
	resource: { project: "project", pillar: "pillar" },
};

export class PpvService {
	constructor(private readonly deps: PpvServiceDeps) {}

	get settings(): PpvSettings {
		return this.deps.settings.get();
	}

	/** Notes a new note of `type` can link to as its parent. */
	parentOptions(type: PpvType): PpvNote[] {
		return Object.keys(PARENT_KEYS[type]).flatMap((parentType) =>
			this.deps.index.ofType(parentType as PpvType),
		);
	}

	async create(
		type: PpvType,
		title: string,
		parentPath: string | null,
		status: ProjectStatus = "active",
	): Promise<Result<string, Error>> {
		const name = safeFileName(title);
		if (!name) {
			return err(new Error("Enter a title."));
		}
		const path = normalizeVaultPath(`${this.settings.folders[type]}/${name}.md`);
		if (this.deps.notes.exists(path)) {
			return err(new Error(`${path} already exists.`));
		}
		const parent = parentPath ? this.deps.index.get(parentPath) : null;
		const parentKey = parent ? PARENT_KEYS[type][parent.type] : undefined;
		if (parentPath && !parentKey) {
			return err(new Error("That parent cannot hold this kind of note."));
		}
		const today = this.deps.clock.today();
		const templatePath = this.settings.templates[type].trim();
		let content: string;
		if (templatePath) {
			const template = withMarkdownExtension(templatePath);
			if (!this.deps.notes.exists(template)) {
				return err(new Error(`Template not found: ${templatePath}`));
			}
			content = renderTemplate(await this.deps.notes.read(template), {
				title: name,
				formatDate: (format) => this.deps.formatDate(today, format),
				formatNow: (format) => this.deps.formatDate(today, format),
			});
		} else {
			content = defaultContent(
				{ type, title: name, parentTitle: parent?.title ?? null, status, today },
				parentKey ?? null,
			);
		}
		await this.deps.notes.create(path, content);
		if (templatePath) {
			if (this.deps.templates && content.includes("<%")) {
				await this.deps.templates.process(path);
			}
			await this.deps.notes.updateFrontmatter(path, (frontmatter) => {
				frontmatter.type = type;
				if (type === "project") {
					frontmatter.status ??= status;
				}
				if (parent && parentKey) {
					frontmatter[parentKey] = `[[${parent.title}]]`;
				}
			});
		}
		this.deps.index.rebuild();
		return ok(path);
	}

	/** Sets a project's status, moving it to the archive when it closes, if that is turned on. */
	async setStatus(path: string, status: ProjectStatus): Promise<Result<string, Error>> {
		const note = this.deps.index.get(path);
		if (note?.type !== "project") {
			return err(new Error("That note is not a project."));
		}
		await this.deps.notes.updateFrontmatter(path, (frontmatter) => {
			frontmatter.status = status;
			if (isClosedStatus(status)) {
				frontmatter.completed = this.deps.clock.today();
			} else {
				delete frontmatter.completed;
			}
		});
		let finalPath = path;
		const archive = normalizeVaultPath(this.settings.archiveFolder);
		if (
			this.settings.archiveClosedProjects &&
			isClosedStatus(status) &&
			archive &&
			!path.startsWith(`${archive}/`)
		) {
			finalPath = `${archive}/${path.split("/").pop() ?? path}`;
			try {
				await this.deps.notes.move(path, finalPath);
			} catch (error) {
				return err(error instanceof Error ? error : new Error(String(error)));
			}
		}
		this.deps.index.rebuild();
		return ok(finalPath);
	}

	/** Adds a quick task or note to today's note or the inbox note. */
	async capture(text: string, asTask: boolean): Promise<Result<string, Error>> {
		const clean = text.replace(/\s*\n\s*/g, " ").trim();
		if (!clean) {
			return err(new Error("Nothing to capture."));
		}
		const settings = this.settings;
		let path: string;
		if (settings.captureTarget === "daily") {
			const note = await this.deps.periodic.ensure("day", this.deps.clock.today());
			if (!note.ok) {
				return note;
			}
			path = note.value.path;
		} else {
			path = withMarkdownExtension(settings.inboxPath || "Inbox");
			if (!this.deps.notes.exists(path)) {
				await this.deps.notes.create(path, "");
			}
		}
		const line = asTask ? `- [ ] ${clean}` : `- ${clean}`;
		await this.deps.notes.process(path, (content) =>
			appendToSection(content, settings.captureHeading, [line]),
		);
		await this.deps.tasks.update(path);
		return ok(path);
	}

	/** Tasks that belong to a project: in its note, or anywhere with a link to it. */
	projectTasks(projectPath: string): Task[] {
		const own = [...this.deps.tasks.tasksIn(projectPath)];
		const linked: Task[] = [];
		for (const task of this.deps.tasks.all()) {
			if (
				task.path !== projectPath &&
				task.fields.links.some(
					(link) => this.deps.notes.resolveLink(link, task.path) === projectPath,
				)
			) {
				linked.push(task);
			}
		}
		return [...own, ...linked];
	}

	nextActions(projectPath: string, limit = 3): Task[] {
		return this.projectTasks(projectPath)
			.filter((task) => !isClosed(task.state) && task.text.trim() !== "")
			.sort((a, b) => stageRank(a.state) - stageRank(b.state))
			.slice(0, limit);
	}

	/** Moves a task to the next stage: todo, in progress, waiting, then back to todo. */
	cycleStage(ref: TaskRef): Promise<Result<void, Error>> {
		return this.deps.actions.editLine(ref, (raw) => {
			const symbol = /\[(.)\]/.exec(raw)?.[1] ?? " ";
			return setStatusLine(raw, STATE_SYMBOL[nextStage(stateOf(symbol))]);
		});
	}

	/** Creates missing PPV folders and, in an empty system, an example pillar. Never overwrites. */
	async setUp(): Promise<string[]> {
		const created: string[] = [];
		const settings = this.settings;
		for (const folder of [
			...PPV_TYPES.map((type) => settings.folders[type]),
			settings.archiveFolder,
		]) {
			const normalized = normalizeVaultPath(folder);
			if (normalized && (await this.deps.notes.ensureFolder(normalized))) {
				created.push(normalized);
			}
		}
		this.deps.index.rebuild();
		if (this.deps.index.ofType("pillar").length === 0) {
			const example = await this.create("pillar", "Health", null);
			if (example.ok) {
				created.push(example.value);
			}
		}
		return created;
	}
}

function stageRank(state: TaskState): number {
	return state === "in-progress" ? 0 : state === "todo" ? 1 : 2;
}

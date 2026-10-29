import type { App, Editor, MarkdownFileInfo, MarkdownView, Plugin } from "obsidian";

import { Store, type Notifier, type ReadableStore, type Workspace } from "../../../shared/kernel";
import { isClosed, type Task, type TaskActions, type TaskIndex } from "../../tasks";
import type { PpvIndex } from "../application/ppv-index";
import type { PpvService } from "../application/ppv-service";
import { parseBlockQuery } from "../domain/query";
import { PPV_TYPES, TYPE_LABELS, type PpvType } from "../domain/settings";
import type { PpvServices, ProjectSummary } from "./services";
import {
	CaptureModal,
	DashboardView,
	NewNoteModal,
	QueryBlockChild,
	StatusModal,
	VIEW_TYPE_DASHBOARD,
} from "./views";

export interface PpvModuleDeps {
	readonly app: App;
	readonly index: PpvIndex;
	readonly service: PpvService;
	readonly tasks: TaskIndex;
	readonly actions: TaskActions;
	readonly workspace: Workspace;
	readonly notifier: Notifier;
	readonly settings: ReadableStore<unknown>;
	/** Overrides the task counts on project rows, for example with clocked time. */
	readonly summary?: (project: { path: string }) => ProjectSummary;
}

async function revealDashboard(app: App): Promise<void> {
	const existing = app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD)[0];
	const leaf = existing ?? app.workspace.getLeaf("tab");
	if (!existing) {
		await leaf.setViewState({ type: VIEW_TYPE_DASHBOARD, active: true });
	}
	await app.workspace.revealLeaf(leaf);
}

/** The task on a line, or the task a nested line belongs to. */
function taskAt(tasks: readonly Task[], line: number): Task | null {
	let found: Task | null = null;
	for (const task of tasks) {
		if (task.line === line || task.children.some((child) => child.line === line)) {
			found = task;
		}
	}
	return found;
}

/** Dashboard, note creation, project status, capture, stage cycling and the `sbos` code block. */
export function registerPpv(plugin: Plugin, deps: PpvModuleDeps): PpvServices {
	const { app, index, service, notifier } = deps;
	const version = new Store(0);
	const bump = (): void => version.update((value) => value + 1);
	for (const source of [index.snapshot, deps.tasks.snapshot, deps.settings]) {
		plugin.register(source.subscribe(bump));
	}
	plugin.register(index.attach());
	index.rebuild();

	const report = (result: { ok: boolean; error?: Error }): void => {
		if (!result.ok && result.error) {
			notifier.notify(result.error.message);
		}
	};

	const newNote = (type: PpvType, parent?: { path: string }): void => {
		new NewNoteModal(
			app,
			type,
			service.parentOptions(type),
			parent?.path ?? null,
			async (title, parentPath, status) => {
				const result = await service.create(type, title, parentPath, status);
				if (!result.ok) {
					return result.error.message;
				}
				await deps.workspace.open(result.value);
				return null;
			},
		).open();
	};

	const defaultSummary = (project: { path: string }): ProjectSummary => {
		const tasks = service.projectTasks(project.path);
		return {
			done: tasks.filter((task) => isClosed(task.state)).length,
			total: tasks.length,
			clockedMinutes: 0,
		};
	};

	const services: PpvServices = {
		index,
		service,
		tasks: deps.tasks,
		version,
		open: (path, line) => void deps.workspace.open(path, "current", line),
		newNote,
		toggleTask: (task) => void deps.actions.toggleDone(task).then(report),
		summary: deps.summary ?? defaultSummary,
		setUp: () =>
			void service.setUp().then((created) => {
				notifier.notify(
					created.length === 0
						? "Everything was already set up."
						: `Created ${created.join(", ")}.`,
				);
			}),
	};

	plugin.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, services));
	plugin.addCommand({
		id: "open-ppv-dashboard",
		name: "Open PPV dashboard",
		callback: () => void revealDashboard(app),
	});
	for (const type of PPV_TYPES) {
		plugin.addCommand({
			id: `new-${type}`,
			name: `New ${TYPE_LABELS[type].toLowerCase()}`,
			callback: () => {
				const active = deps.workspace.activePath();
				const activeNote = active ? index.get(active) : null;
				const parent =
					activeNote &&
					service.parentOptions(type).some((note) => note.path === activeNote.path)
						? activeNote
						: undefined;
				newNote(type, parent);
			},
		});
	}
	plugin.addCommand({
		id: "set-project-status",
		name: "Set project status",
		checkCallback: (checking) => {
			const path = deps.workspace.activePath();
			const note = path ? index.get(path) : null;
			if (note?.type !== "project") {
				return false;
			}
			if (!checking) {
				new StatusModal(app, note.status, (status) => {
					void service.setStatus(note.path, status).then(report);
				}).open();
			}
			return true;
		},
	});
	plugin.addCommand({
		id: "capture",
		name: "Capture to inbox",
		callback: () => {
			const settings = service.settings;
			const destination =
				settings.captureTarget === "daily"
					? `today's note, under ${settings.captureHeading}`
					: settings.inboxPath;
			new CaptureModal(app, destination, async (text, asTask) => {
				const result = await service.capture(text, asTask);
				return result.ok ? null : result.error.message;
			}).open();
		},
	});
	plugin.addCommand({
		id: "cycle-task-stage",
		name: "Cycle task stage",
		editorCheckCallback: (
			checking: boolean,
			editor: Editor,
			context: MarkdownView | MarkdownFileInfo,
		) => {
			const path = context.file?.path;
			const task = path ? taskAt(deps.tasks.tasksIn(path), editor.getCursor().line) : null;
			if (!task || isClosed(task.state)) {
				return false;
			}
			if (!checking) {
				void service.cycleStage(task).then(report);
			}
			return true;
		},
	});
	plugin.addCommand({
		id: "set-up-ppv",
		name: "Set up PPV folders",
		callback: services.setUp,
	});

	plugin.registerMarkdownCodeBlockProcessor("sbos", (source, el, context) => {
		const query = parseBlockQuery(source);
		if (!query.ok) {
			el.createEl("p", { cls: "sbos-error", text: query.error.message });
			return;
		}
		context.addChild(new QueryBlockChild(el, services, query.value));
	});
	return services;
}

import type { Editor, MarkdownFileInfo, MarkdownView, Plugin } from "obsidian";

import {
	formatDuration,
	formatTime,
	type NowSnapshot,
	type Notifier,
	type ReadableStore,
	type Workspace,
} from "../../../shared/kernel";
import type { Task, TaskIndex } from "../../tasks";
import { taskTitle, type Clocks } from "../application/clocks";
import { entryMinutes } from "../domain/clock-entry";

export interface ClocksModuleDeps {
	readonly clocks: Clocks;
	readonly tasks: TaskIndex;
	readonly workspace: Workspace;
	readonly now: ReadableStore<NowSnapshot>;
	readonly notifier: Notifier;
}

/** The task on a line, or the task a nested line belongs to. */
export function taskAtLine(tasks: readonly Task[], line: number): Task | null {
	let found: Task | null = null;
	for (const task of tasks) {
		if (task.line === line || task.children.some((child) => child.line === line)) {
			found = task;
		}
	}
	return found;
}

export function clockStatusText(clocks: Clocks, now: NowSnapshot): string {
	const active = clocks.active();
	return active
		? `⏱ ${taskTitle(active.task)} · ${formatDuration(entryMinutes(active.clock, now))}`
		: "";
}

/** Commands, the running clock in the status bar, and a reminder about clocks left running. */
export function registerClocks(plugin: Plugin, deps: ClocksModuleDeps): void {
	const { clocks, notifier } = deps;
	const report = (result: { ok: boolean; error?: Error }): void => {
		if (!result.ok && result.error) {
			notifier.notify(result.error.message);
		}
	};

	plugin.addCommand({
		id: "start-clock",
		name: "Start or stop clock on the current task",
		editorCheckCallback: (
			checking: boolean,
			editor: Editor,
			context: MarkdownView | MarkdownFileInfo,
		) => {
			const path = context.file?.path;
			const task = path
				? taskAtLine(deps.tasks.tasksIn(path), editor.getCursor().line)
				: null;
			if (!task) {
				return false;
			}
			if (!checking) {
				void clocks.toggle(task).then(report);
			}
			return true;
		},
	});
	plugin.addCommand({
		id: "stop-clock",
		name: "Stop clock",
		checkCallback: (checking) => {
			if (clocks.running.get().length === 0) {
				return false;
			}
			if (!checking) {
				void clocks.stop().then(report);
			}
			return true;
		},
	});
	plugin.addCommand({
		id: "open-running-task",
		name: "Open task with running clock",
		checkCallback: (checking) => {
			const active = clocks.active();
			if (!active) {
				return false;
			}
			if (!checking) {
				void deps.workspace.open(active.task.path, "current", active.task.line);
			}
			return true;
		},
	});

	plugin.addCommand({
		id: "convert-clock-entries",
		name: "Convert old clock entries to YAML",
		callback: () =>
			void clocks.convertLegacy().then((result) => {
				if (!result.ok) {
					notifier.notify(result.error.message);
				} else {
					notifier.notify(
						result.value === 0
							? "No old clock entries found."
							: `Converted clock entries on ${result.value} ${result.value === 1 ? "task" : "tasks"}.`,
					);
				}
			}),
	});

	const statusBar = plugin.addStatusBarItem();
	statusBar.classList.add("sbos-status", "sbos-status--clock");
	const render = (): void => {
		const text = clockStatusText(clocks, deps.now.get());
		statusBar.textContent = text;
		statusBar.toggleAttribute("hidden", text === "");
	};
	plugin.register(clocks.running.subscribe(render));
	plugin.register(deps.now.subscribe(render));
	render();

	void deps.tasks.ready.then(() => {
		for (const { task, clock } of clocks.running.get()) {
			notifier.notify(
				`A clock is still running on "${taskTitle(task)}" since ${clock.start.date} ${formatTime(clock.start.minutes)}.`,
			);
		}
	});
}

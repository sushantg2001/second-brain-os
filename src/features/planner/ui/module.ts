import type { App, Plugin } from "obsidian";

import {
	formatDuration,
	formatTime,
	Store,
	type Clock,
	type DateFormatter,
	type NowSnapshot,
	type Notifier,
	type ReadableStore,
	type Workspace,
} from "../../../shared/kernel";
import type { PeriodicNotes } from "../../periodic";
import type { TaskIndex } from "../../tasks";
import type { Planner } from "../application/planner";
import { currentBlock, nextBlock } from "../domain/day-plan";
import type { PlannerClockControls, PlannerServices } from "./services";
import { NewBlockModal, TimelineView, VIEW_TYPE_TIMELINE } from "./timeline-view";

export interface PlannerModuleDeps {
	readonly app: App;
	readonly planner: Planner;
	readonly tasks: TaskIndex;
	readonly periodic: PeriodicNotes;
	readonly dates: DateFormatter;
	readonly workspace: Workspace;
	readonly clock: Clock;
	readonly now: ReadableStore<NowSnapshot>;
	readonly notifier: Notifier;
	readonly clocks?: PlannerClockControls;
}

/** Text for the status bar: the running block and time left, or the next block. */
export function statusText(planner: Planner, now: NowSnapshot): string {
	const plan = planner.plan(now.date);
	const current = currentBlock(plan, now.minutes);
	if (current) {
		return `▶ ${current.title} · ${formatDuration(current.end - now.minutes)} left`;
	}
	const next = nextBlock(plan, now.minutes);
	return next ? `Next: ${next.title} at ${formatTime(next.start)}` : "";
}

async function openTimeline(app: App, days: number, inSidebar: boolean): Promise<void> {
	const { workspace } = app;
	const existing = workspace
		.getLeavesOfType(VIEW_TYPE_TIMELINE)
		.find((leaf) => ((leaf.view as TimelineView | null)?.state?.get().days ?? 1) === days);
	const leaf = existing ?? (inSidebar ? workspace.getRightLeaf(false) : workspace.getLeaf("tab"));
	if (!leaf) {
		return;
	}
	if (!existing) {
		await leaf.setViewState({ type: VIEW_TYPE_TIMELINE, active: true, state: { days } });
	}
	await workspace.revealLeaf(leaf);
}

/** Timeline views, commands, the status bar and start notifications. */
export function registerPlanner(plugin: Plugin, deps: PlannerModuleDeps): PlannerServices {
	const { app, planner, clock } = deps;
	const { now } = deps;
	const version = new Store(0);
	const bump = (): void => version.update((value) => value + 1);
	for (const source of [
		deps.tasks.snapshot,
		deps.periodic.index,
		planner.settingsStore,
	] as ReadableStore<unknown>[]) {
		plugin.register(source.subscribe(bump));
	}
	plugin.register(planner.attach());

	const services: PlannerServices = {
		planner,
		dates: deps.dates,
		now,
		version,
		openTask: (task) => void deps.workspace.open(task.path, "current", task.line),
		newBlock: (date, start, end) => new NewBlockModal(app, services, date, start, end).open(),
		report: (error) => deps.notifier.notify(error.message),
		...(deps.clocks ? { clocks: deps.clocks } : {}),
	};

	plugin.registerView(VIEW_TYPE_TIMELINE, (leaf) => new TimelineView(leaf, services, 1));

	const statusBar = plugin.addStatusBarItem();
	statusBar.classList.add("sbos-status");
	const renderStatus = (): void => {
		const text = planner.settings.showStatusBar ? statusText(planner, now.get()) : "";
		statusBar.textContent = text;
		statusBar.toggleAttribute("hidden", text === "");
	};
	plugin.register(version.subscribe(renderStatus));
	plugin.register(now.subscribe(renderStatus));

	// Notify for blocks that started since the last tick, on the same day.
	let lastChecked = now.get();
	const notified = new Set<string>();
	plugin.register(
		now.subscribe(() => {
			const current = now.get();
			if (planner.settings.notifyOnStart && current.date === lastChecked.date) {
				for (const block of planner.plan(current.date).blocks) {
					const key = `${current.date}|${block.id}|${block.start}`;
					const started =
						block.start > lastChecked.minutes && block.start <= current.minutes;
					if (started && block.state !== "done" && !notified.has(key)) {
						notified.add(key);
						deps.notifier.notify(`Starting now: ${block.title}`);
					}
				}
			}
			lastChecked = current;
		}),
	);
	renderStatus();

	plugin.addCommand({
		id: "open-day-planner",
		name: "Open day planner",
		callback: () => void openTimeline(app, 1, true),
	});
	plugin.addCommand({
		id: "open-multi-day-planner",
		name: "Open multi-day planner",
		callback: () => void openTimeline(app, planner.settings.multiDayCount, false),
	});
	plugin.addCommand({
		id: "add-time-block",
		name: "Add time block to today",
		callback: () => {
			const date = clock.today();
			const start = planner.freeSlot(date) ?? planner.settings.startHour * 60;
			services.newBlock(date, start, start + planner.settings.defaultDuration);
		},
	});
	plugin.addCommand({
		id: "carry-over-tasks",
		name: "Carry unfinished tasks over to today",
		callback: () =>
			void planner.carryOver().then((result) => {
				if (!result.ok) {
					deps.notifier.notify(result.error.message);
				} else if (result.value.count === 0) {
					deps.notifier.notify("No unfinished tasks to carry over.");
				} else {
					deps.notifier.notify(
						`Carried ${result.value.count} tasks over from ${result.value.from ?? "the last daily note"}.`,
					);
				}
			}),
	});
	app.workspace.onLayoutReady(() => {
		if (app.workspace.getLeavesOfType(VIEW_TYPE_TIMELINE).length === 0) {
			void app.workspace
				.getRightLeaf(false)
				?.setViewState({ type: VIEW_TYPE_TIMELINE, state: { days: 1 } });
		}
	});
	return services;
}

import type { App, Plugin } from "obsidian";

import {
	formatDuration,
	formatTime,
	Store,
	type Clock,
	type DateFormatter,
	type Notifier,
	type ReadableStore,
	type Workspace,
} from "../../../shared/kernel";
import type { PeriodicNotes } from "../../periodic";
import type { TaskIndex } from "../../tasks";
import type { Planner } from "../application/planner";
import { currentBlock, nextBlock } from "../domain/day-plan";
import type { NowSnapshot, PlannerServices } from "./services";
import { NewBlockModal, TimelineView, VIEW_TYPE_TIMELINE } from "./timeline-view";

export interface PlannerModuleDeps {
	readonly app: App;
	readonly planner: Planner;
	readonly tasks: TaskIndex;
	readonly periodic: PeriodicNotes;
	readonly dates: DateFormatter;
	readonly workspace: Workspace;
	readonly clock: Clock;
	readonly notifier: Notifier;
}

const TICK_MS = 30_000;

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
export function registerPlanner(
	plugin: Plugin,
	deps: PlannerModuleDeps,
): PlannerServices & { readonly tick: () => void } {
	const { app, planner, clock } = deps;
	const now = new Store<NowSnapshot>({ date: clock.today(), minutes: clock.nowMinutes() });
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

	let lastChecked = now.get();
	const notified = new Set<string>();
	const tick = (): void => {
		const current = { date: clock.today(), minutes: clock.nowMinutes() };
		if (planner.settings.notifyOnStart && current.date === lastChecked.date) {
			for (const block of planner.plan(current.date).blocks) {
				const key = `${current.date}|${block.id}|${block.start}`;
				if (
					block.start > lastChecked.minutes &&
					block.start <= current.minutes &&
					block.state !== "done" &&
					!notified.has(key)
				) {
					notified.add(key);
					deps.notifier.notify(`Starting now: ${block.title}`);
				}
			}
		}
		lastChecked = current;
		if (current.date !== now.get().date || current.minutes !== now.get().minutes) {
			now.set(current);
		}
	};
	plugin.registerInterval(window.setInterval(tick, TICK_MS));
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
	app.workspace.onLayoutReady(() => {
		if (app.workspace.getLeavesOfType(VIEW_TYPE_TIMELINE).length === 0) {
			void app.workspace
				.getRightLeaf(false)
				?.setViewState({ type: VIEW_TYPE_TIMELINE, state: { days: 1 } });
		}
	});
	return Object.assign(services, { tick });
}

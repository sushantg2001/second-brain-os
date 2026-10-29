import { describe, expect, it } from "bun:test";
import type { App as ObsidianApp, Plugin as ObsidianPlugin } from "obsidian";

import { createContainer } from "../../src/app/container";
import { registerPlanner } from "../../src/features/planner";
import { Notice, Plugin } from "../mocks/obsidian";
import { createTestApp } from "../fakes/fake-obsidian-app";
import { FixedClock } from "../fakes/fixed-clock";
import { sleep } from "../fakes/plugin-harness";

async function setup(notify: boolean) {
	const app = await createTestApp({
		files: {
			"2026-10-29.md":
				"- [ ] 10:30 - 11:00 Standup\n- [x] 10:30 - 10:45 Done already\n- [ ] 12:00 Lunch",
		},
	});
	const plugin = new Plugin(app);
	const obsidianPlugin = plugin as unknown as ObsidianPlugin;
	const clock = new FixedClock("2026-10-29", 10 * 60 + 25);
	const container = createContainer(obsidianPlugin, { clock });
	await container.settings.load();
	await container.settings
		.section("planner")
		.update((settings) => ({ ...settings, notifyOnStart: notify }));
	container.periodic.refresh();
	await container.tasks.rebuild();
	const services = registerPlanner(obsidianPlugin, {
		app: app as unknown as ObsidianApp,
		planner: container.planner,
		tasks: container.tasks,
		periodic: container.periodic,
		dates: container.dates,
		workspace: container.workspace,
		clock,
		now: container.now,
		notifier: container.notifier,
	});
	const tick = (): void => container.now.tick();
	return { app, plugin, clock, services, tick };
}

describe("planner module", () => {
	it("notifies once when an open block starts", async () => {
		Notice.messages.length = 0;
		const { clock, services, tick } = await setup(true);
		clock.minutes = 10 * 60 + 30;
		tick();
		tick();
		expect(Notice.messages).toEqual(["Starting now: Standup"]);
		clock.minutes = 12 * 60;
		tick();
		expect(Notice.messages).toEqual(["Starting now: Standup", "Starting now: Lunch"]);
		expect(services.now.get()).toEqual({ date: "2026-10-29", minutes: 720 });
	});

	it("stays quiet when notifications are off or the day changed", async () => {
		Notice.messages.length = 0;
		const quiet = await setup(false);
		quiet.clock.minutes = 10 * 60 + 30;
		quiet.tick();
		expect(Notice.messages).toEqual([]);

		const rolled = await setup(true);
		rolled.clock.date = "2026-10-30";
		rolled.clock.minutes = 10 * 60 + 30;
		rolled.tick();
		expect(Notice.messages).toEqual([]);
		expect(rolled.services.now.get().date).toBe("2026-10-30");
	});

	it("opens the day planner in the sidebar on layout ready and on command", async () => {
		const { app, plugin } = await setup(false);
		app.workspace.finishLayout();
		await sleep(0);
		expect(app.workspace.getLeavesOfType("sbos-timeline")).toHaveLength(1);
		app.workspace.detachLeavesOfType("sbos-timeline");
		plugin.runCommand("open-day-planner");
		await sleep(0);
		expect(app.workspace.getLeavesOfType("sbos-timeline")).toHaveLength(1);
		plugin.runCommand("open-day-planner");
		await sleep(0);
		expect(app.workspace.getLeavesOfType("sbos-timeline")).toHaveLength(1);
	});
});

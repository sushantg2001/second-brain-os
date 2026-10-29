import { describe, expect, it } from "bun:test";

import { loadPlugin } from "../fakes/plugin-harness";
import { clockBlock } from "../fakes/yaml";

/** A vault of 2,000 notes: daily notes with tasks, projects, and plain notes. */
function largeVault(): Record<string, string> {
	const files: Record<string, string> = {};
	const start = Date.UTC(2021, 0, 1);
	for (let day = 0; day < 1000; day++) {
		const date = new Date(start + day * 86_400_000).toISOString().slice(0, 10);
		files[`${date}.md`] = [
			"## Day planner",
			"- [ ] 09:00 - 10:00 Deep work [[Project 1]]",
			"- [x] 10:30 Standup ✅ " + date,
			clockBlock({ start: `${date} 10:30:00`, end: `${date} 10:45:00` }),
			"- [ ] Inbox item",
		].join("\n");
	}
	for (let index = 0; index < 200; index++) {
		files[`PPV/Projects/Project ${index}.md`] =
			`---\ntype: project\npillar: "[[Work]]"\n---\n- [ ] Next ${index}\n- [x] Done ${index}`;
	}
	files["PPV/Pillars/Work.md"] = "---\ntype: pillar\n---\n";
	for (let index = 0; index < 799; index++) {
		files[`Notes/Note ${index}.md`] = `# Note ${index}\nPlain text with a [[link]].`;
	}
	return files;
}

describe("performance", () => {
	it("indexes and answers queries quickly on 2,000 notes", async () => {
		const files = largeVault();
		expect(Object.keys(files)).toHaveLength(2000);
		const harness = await loadPlugin({ files, today: "2023-09-27", minutes: 12 * 60 });
		const { container } = harness;
		await container.tasks.ready;

		const time = (work: () => unknown): number => {
			const started = performance.now();
			work();
			return performance.now() - started;
		};
		const rebuild = performance.now();
		await container.tasks.rebuild();
		const rebuildMs = performance.now() - rebuild;
		const periodicMs = time(() => container.periodic.refresh());
		const ppvMs = time(() => container.ppvIndex.rebuild());
		const planMs = time(() => container.planner.plan("2022-06-01"));
		const rollupMs = time(() =>
			container.rollups.review({ from: "2022-01-01", to: "2022-12-31" }),
		);
		const lintMs = time(() => container.linter.run());

		// Generous limits for slow CI machines; typical runs are several times faster.
		expect(rebuildMs).toBeLessThan(1500);
		expect(periodicMs).toBeLessThan(1000);
		expect(ppvMs).toBeLessThan(500);
		expect(planMs).toBeLessThan(200);
		expect(rollupMs).toBeLessThan(1500);
		expect(lintMs).toBeLessThan(3000);
		expect(container.periodic.index.get().day.size).toBe(1000);
		expect(
			container.rollups.review({ from: "2022-01-01", to: "2022-12-31" }).completed,
		).toHaveLength(365);
		console.info(
			`large vault: tasks ${rebuildMs.toFixed(0)}ms, periodic ${periodicMs.toFixed(0)}ms, ppv ${ppvMs.toFixed(0)}ms, ` +
				`plan ${planMs.toFixed(0)}ms, review ${rollupMs.toFixed(0)}ms, lint ${lintMs.toFixed(0)}ms`,
		);
	}, 60_000);
});

import { describe, expect, it } from "bun:test";

import { DEFAULT_PERIODIC_SETTINGS } from "../../../src/features/periodic";
import {
	DEFAULT_SETTINGS,
	migrateSettings,
	SETTINGS_VERSION,
	SettingsRepository,
	type Settings,
} from "../../../src/infrastructure/settings";

function persistence(initial: unknown) {
	const saved: Settings[] = [];
	return {
		saved,
		load: () => Promise.resolve(initial),
		save: (data: Settings) => {
			saved.push(data);
			return Promise.resolve();
		},
	};
}

describe("migrateSettings", () => {
	it("uses defaults when nothing is stored", () => {
		const outcome = migrateSettings(undefined);
		expect(outcome.ok && outcome.value).toEqual({ settings: DEFAULT_SETTINGS, changed: true });
	});

	it("upgrades version 0 and 1 data to the current version", () => {
		for (const raw of [{}, { version: 1 }]) {
			const outcome = migrateSettings(raw);
			expect(outcome.ok).toBe(true);
			if (outcome.ok) {
				expect(outcome.value.changed).toBe(true);
				expect(outcome.value.settings.version).toBe(SETTINGS_VERSION);
				expect(outcome.value.settings.periodic).toEqual(DEFAULT_PERIODIC_SETTINGS);
			}
		}
	});

	it("keeps current data unchanged", () => {
		const outcome = migrateSettings(structuredClone(DEFAULT_SETTINGS));
		expect(outcome.ok && outcome.value.changed).toBe(false);
	});

	it("rejects data it cannot trust", () => {
		expect(migrateSettings("text").ok).toBe(false);
		expect(migrateSettings({ version: -1 }).ok).toBe(false);
		expect(migrateSettings({ version: 99 }).ok).toBe(false);
		expect(
			migrateSettings({ version: SETTINGS_VERSION, periodic: { weekStart: "someday" } }).ok,
		).toBe(false);
	});
});

describe("SettingsRepository", () => {
	it("loads, migrates and saves upgraded settings once", async () => {
		const store = persistence({ version: 1 });
		const repository = new SettingsRepository(store);
		const loaded = await repository.load();
		expect(loaded.ok).toBe(true);
		expect(store.saved).toHaveLength(1);
		expect(repository.settings.get().periodic.weekStart).toBe("locale");
	});

	it("never overwrites settings it could not read", async () => {
		const store = persistence({ version: 99 });
		const repository = new SettingsRepository(store);
		expect((await repository.load()).ok).toBe(false);
		const update = await repository.update((settings) => settings);
		expect(update.ok).toBe(false);
		expect(store.saved).toHaveLength(0);
	});

	it("rejects invalid updates and keeps the old value", async () => {
		const store = persistence(structuredClone(DEFAULT_SETTINGS));
		const repository = new SettingsRepository(store);
		await repository.load();
		const result = await repository.update(
			(settings) =>
				({
					...settings,
					periodic: { ...settings.periodic, weekStart: "nope" },
				}) as unknown as Settings,
		);
		expect(result.ok).toBe(false);
		expect(repository.settings.get().periodic.weekStart).toBe("locale");
	});

	it("exposes sections that update and notify independently", async () => {
		const store = persistence(structuredClone(DEFAULT_SETTINGS));
		const repository = new SettingsRepository(store);
		await repository.load();
		const periodic = repository.section("periodic");
		let notified = 0;
		periodic.store.subscribe(() => notified++);

		const result = await periodic.update((current) => ({ ...current, showWeekNumbers: true }));

		expect(result.ok && result.value.showWeekNumbers).toBe(true);
		expect(periodic.store.get().showWeekNumbers).toBe(true);
		expect(notified).toBe(1);
		expect(store.saved.at(-1)?.periodic.showWeekNumbers).toBe(true);
	});
});

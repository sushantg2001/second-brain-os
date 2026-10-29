import { err, ok, Store, type ReadableStore, type Result } from "../../shared/kernel";
import { migrateSettings, SettingsError } from "./migrations";
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from "./schema";

export interface SettingsPersistence {
	load(): Promise<unknown>;
	save(data: Settings): Promise<void>;
}

export class SettingsRepository {
	readonly #store = new Store<Settings>(DEFAULT_SETTINGS);
	/** False while stored data could not be read, so it is never overwritten by defaults. */
	#writable = false;

	constructor(private readonly persistence: SettingsPersistence) {}

	get settings(): ReadableStore<Settings> {
		return this.#store;
	}

	async load(): Promise<Result<Settings, SettingsError>> {
		const outcome = migrateSettings(await this.persistence.load());
		if (!outcome.ok) {
			this.#writable = false;
			return outcome;
		}
		this.#writable = true;
		this.#store.set(outcome.value.settings);
		if (outcome.value.changed) {
			await this.persistence.save(outcome.value.settings);
		}
		return ok(outcome.value.settings);
	}

	async update(updater: (current: Settings) => Settings): Promise<Result<Settings, SettingsError>> {
		if (!this.#writable) {
			return err(new SettingsError("Settings are read-only until they load successfully."));
		}
		const parsed = settingsSchema.safeParse(updater(this.#store.get()));
		if (!parsed.success) {
			return err(new SettingsError(`Rejected invalid settings: ${parsed.error.message}`));
		}
		this.#store.set(parsed.data);
		await this.persistence.save(parsed.data);
		return ok(parsed.data);
	}
}

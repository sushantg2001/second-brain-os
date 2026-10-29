import { err, ok, type Result } from "../../shared/kernel";
import { DEFAULT_SETTINGS, SETTINGS_VERSION, settingsSchema, type Settings } from "./schema";

export class SettingsError extends Error {
	override readonly name = "SettingsError";
}

type RawSettings = Record<string, unknown>;
type Migration = (data: RawSettings) => RawSettings;

/** Keyed by the version a migration upgrades from. Version 0 means "no version field". */
const MIGRATIONS: Readonly<Record<number, Migration>> = {
	0: (data) => ({ ...data, version: 1 }),
	// 2.0: periodic notes and calendar settings.
	1: (data) => ({ ...data, version: 2, periodic: DEFAULT_SETTINGS.periodic }),
};

function isRecord(value: unknown): value is RawSettings {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface MigrationOutcome {
	readonly settings: Settings;
	/** True when stored data was missing or upgraded and should be written back. */
	readonly changed: boolean;
}

export function migrateSettings(raw: unknown): Result<MigrationOutcome, SettingsError> {
	if (raw === null || raw === undefined) {
		return ok({ settings: DEFAULT_SETTINGS, changed: true });
	}
	if (!isRecord(raw)) {
		return err(new SettingsError("Stored settings are not an object."));
	}

	let version = typeof raw.version === "number" ? raw.version : 0;
	if (!Number.isInteger(version) || version < 0) {
		return err(
			new SettingsError(`Stored settings have an invalid version: ${String(raw.version)}.`),
		);
	}
	if (version > SETTINGS_VERSION) {
		return err(
			new SettingsError(
				`Stored settings are from a newer release (version ${version}). Update the plugin.`,
			),
		);
	}

	let data = raw;
	const changed = version < SETTINGS_VERSION;
	while (version < SETTINGS_VERSION) {
		const migration = MIGRATIONS[version];
		if (!migration) {
			return err(new SettingsError(`No migration from settings version ${version}.`));
		}
		data = migration(data);
		version++;
	}

	const parsed = settingsSchema.safeParse(data);
	if (!parsed.success) {
		return err(new SettingsError(`Stored settings are invalid: ${parsed.error.message}`));
	}
	return ok({ settings: parsed.data, changed });
}

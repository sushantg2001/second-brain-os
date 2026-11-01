export { migrateSettings, SettingsError, type MigrationOutcome } from "./migrations";
export { DEFAULT_SETTINGS, SETTINGS_VERSION, settingsSchema, type Settings } from "./schema";
export { SettingsRepository, type SettingsPersistence } from "./settings-repository";

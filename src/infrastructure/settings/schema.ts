// Namespace import on purpose: `import { z }` defeats tree-shaking and adds ~350 KB.
import * as z from "zod/mini";

export const SETTINGS_VERSION = 1;

/** Settings v1. Feature sections are added by later phases, each with a migration. */
export const settingsSchema = z.object({
	version: z.literal(SETTINGS_VERSION),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = { version: SETTINGS_VERSION };

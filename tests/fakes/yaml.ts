import type { YamlCodec } from "../../src/shared/kernel";

/** The same YAML engine the Obsidian mock uses. */
export const yaml: YamlCodec = {
	parse: (text) => Bun.YAML.parse(text),
	stringify: (value) => `${Bun.YAML.stringify(value, null, 2)}\n`,
};

/** A Day Planner 0.29 clock block under a task at column 0. */
export function clockBlock(...entries: { start: string; end?: string }[]): string {
	const log = entries.flatMap((entry) => [
		`      - start: ${entry.start}`,
		...(entry.end ? [`        end: ${entry.end}`] : []),
	]);
	return ["  ```yaml", "  planner:", "    log:", ...log, "  ```"].join("\n");
}

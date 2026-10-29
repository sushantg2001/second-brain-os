import { parseYaml, stringifyYaml } from "obsidian";

import type { YamlCodec } from "../../shared/kernel";

export class ObsidianYaml implements YamlCodec {
	parse(text: string): unknown {
		return parseYaml(text) as unknown;
	}

	stringify(value: unknown): string {
		const text = stringifyYaml(value);
		return text.endsWith("\n") ? text : `${text}\n`;
	}
}

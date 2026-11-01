import { Plugin } from "obsidian";

import { createApi, type PublicApi } from "./app/api";
import { createContainer } from "./app/container";
import { startPlugin } from "./app/lifecycle";

export default class SecondBrainOsPlugin extends Plugin {
	/** Public API for other plugins and scripts. See src/app/api.ts. */
	api!: PublicApi;

	override async onload(): Promise<void> {
		const container = createContainer(this);
		this.api = createApi(container);
		await startPlugin(this, container);
	}
}

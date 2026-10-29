import { Plugin } from "obsidian";

import { createContainer } from "./app/container";
import { startPlugin } from "./app/lifecycle";

export default class SecondBrainOsPlugin extends Plugin {
	override async onload(): Promise<void> {
		await startPlugin(this, createContainer(this));
	}
}

import { Notice } from "obsidian";

import type { Notifier } from "../../shared/kernel";

export class NoticeNotifier implements Notifier {
	notify(message: string): void {
		new Notice(message);
	}
}

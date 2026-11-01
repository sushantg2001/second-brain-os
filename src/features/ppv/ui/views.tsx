import { MarkdownRenderChild, type App, type WorkspaceLeaf } from "obsidian";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ErrorBoundary, ReactItemView, ReactModal } from "../../../shared/react";
import type { PpvNote } from "../domain/ppv-note";
import type { BlockQuery } from "../domain/query";
import type { PpvType, ProjectStatus } from "../domain/settings";
import { TYPE_LABELS } from "../domain/settings";
import { QueryBlock } from "./code-block";
import { Dashboard } from "./dashboard";
import { CaptureForm, NewNoteForm, StatusPicker } from "./forms";
import { PpvContext, type PpvServices } from "./services";

export const VIEW_TYPE_DASHBOARD = "sbos-ppv-dashboard";

export class DashboardView extends ReactItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private readonly services: PpvServices,
	) {
		super(leaf);
	}

	override getViewType(): string {
		return VIEW_TYPE_DASHBOARD;
	}

	override getDisplayText(): string {
		return "PPV dashboard";
	}

	override getIcon(): string {
		return "layout-dashboard";
	}

	protected override renderContent(): ReactNode {
		return (
			<PpvContext.Provider value={this.services}>
				<Dashboard />
			</PpvContext.Provider>
		);
	}
}

export class NewNoteModal extends ReactModal {
	constructor(
		app: App,
		private readonly type: PpvType,
		private readonly parents: readonly PpvNote[],
		private readonly initialParent: string | null,
		private readonly create: (
			title: string,
			parent: string | null,
			status: ProjectStatus,
		) => Promise<string | null>,
	) {
		super(app, `New ${TYPE_LABELS[type].toLowerCase()}`);
	}

	protected override renderContent(): ReactNode {
		return (
			<NewNoteForm
				type={this.type}
				parents={this.parents}
				initialParent={this.initialParent}
				onCancel={() => this.close()}
				onSubmit={async (title, parent, status) => {
					const error = await this.create(title, parent, status);
					if (error === null) {
						this.close();
					}
					return error;
				}}
			/>
		);
	}
}

export class StatusModal extends ReactModal {
	constructor(
		app: App,
		private readonly current: ProjectStatus,
		private readonly pick: (status: ProjectStatus) => void,
	) {
		super(app, "Project status");
	}

	protected override renderContent(): ReactNode {
		return (
			<StatusPicker
				current={this.current}
				onPick={(status) => {
					this.close();
					this.pick(status);
				}}
			/>
		);
	}
}

export class CaptureModal extends ReactModal {
	constructor(
		app: App,
		private readonly destination: string,
		private readonly capture: (text: string, asTask: boolean) => Promise<string | null>,
	) {
		super(app, "Capture");
	}

	protected override renderContent(): ReactNode {
		return (
			<CaptureForm
				destination={this.destination}
				onSubmit={async (text, asTask) => {
					const error = await this.capture(text, asTask);
					if (error === null) {
						this.close();
					}
					return error;
				}}
			/>
		);
	}
}

/** Renders an `sbos` code block and unmounts it with the note's preview. */
export class QueryBlockChild extends MarkdownRenderChild {
	#root: Root | null = null;

	constructor(
		containerEl: HTMLElement,
		private readonly services: PpvServices,
		private readonly query: BlockQuery,
	) {
		super(containerEl);
	}

	override onload(): void {
		this.containerEl.classList.add("sbos-block-query");
		this.#root = createRoot(this.containerEl);
		this.#root.render(
			<ErrorBoundary>
				<PpvContext.Provider value={this.services}>
					<QueryBlock query={this.query} />
				</PpvContext.Provider>
			</ErrorBoundary>,
		);
	}

	override onunload(): void {
		this.#root?.unmount();
		this.#root = null;
	}
}

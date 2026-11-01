import { Setting, type App, type Plugin, type WorkspaceLeaf } from "obsidian";
import type { ReactNode } from "react";

import {
	Store,
	type Notifier,
	type ReadableStore,
	type SettingsSection,
	type Workspace,
} from "../../../shared/kernel";
import { ReactItemView, ReactModal } from "../../../shared/react";
import type { PpvService } from "../../ppv";
import type { Linter } from "../application/linter";
import { RULE_IDS, RULES, type LintFix, type Severity } from "../domain/rules";
import type { LintSettings } from "../domain/settings";
import { FixForm, LintContext, LintPanel, LintSummary, type LintServices } from "./lint-panel";

export const VIEW_TYPE_LINT = "sbos-lint";

export class LintView extends ReactItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private readonly services: LintServices,
	) {
		super(leaf);
	}

	override getViewType(): string {
		return VIEW_TYPE_LINT;
	}

	override getDisplayText(): string {
		return "Vault check";
	}

	override getIcon(): string {
		return "stethoscope";
	}

	protected override renderContent(): ReactNode {
		return (
			<LintContext.Provider value={this.services}>
				<LintPanel />
			</LintContext.Provider>
		);
	}
}

class FixModal extends ReactModal {
	constructor(
		app: App,
		private readonly fix: LintFix,
		private readonly linter: Linter,
		private readonly ppv: PpvService,
	) {
		super(app, fix.kind === "close-clock" ? "Stop the clock now" : "Link to a parent");
	}

	protected override renderContent(): ReactNode {
		const { fix } = this;
		return (
			<FixForm
				fix={fix}
				linter={this.linter}
				parents={fix.kind === "set-parent" ? this.ppv.parentOptions(fix.type) : []}
				onCancel={() => this.close()}
				onApply={async (parentPath) => {
					const result =
						fix.kind === "close-clock"
							? await this.linter.closeClock(fix)
							: await this.linter.setParent(fix.path, parentPath ?? "");
					if (!result.ok) {
						return result.error.message;
					}
					this.close();
					return null;
				}}
			/>
		);
	}
}

export interface LintModuleDeps {
	readonly app: App;
	readonly linter: Linter;
	readonly ppv: PpvService;
	readonly workspace: Workspace;
	readonly notifier: Notifier;
	/** Stores whose changes can change the findings. */
	readonly sources: readonly ReadableStore<unknown>[];
}

/** The vault check view, its commands, and a summary for reviews. */
export function registerLint(plugin: Plugin, deps: LintModuleDeps): { summary: () => ReactNode } {
	const { app, linter } = deps;
	const version = new Store(0);
	for (const source of deps.sources) {
		plugin.register(source.subscribe(() => version.update((value) => value + 1)));
	}
	const services: LintServices = {
		linter,
		version,
		open: (path, line) => void deps.workspace.open(path, "current", line),
		fix: (fix) => new FixModal(app, fix, linter, deps.ppv).open(),
	};

	plugin.registerView(VIEW_TYPE_LINT, (leaf) => new LintView(leaf, services));
	plugin.addCommand({
		id: "check-vault",
		name: "Check vault structure",
		callback: () =>
			void (async () => {
				const existing = app.workspace.getLeavesOfType(VIEW_TYPE_LINT)[0];
				const leaf = existing ?? app.workspace.getLeaf("tab");
				if (!existing) {
					await leaf.setViewState({ type: VIEW_TYPE_LINT, active: true });
				}
				await app.workspace.revealLeaf(leaf);
			})(),
	});
	return {
		summary: () => (
			<LintContext.Provider value={services}>
				<LintSummary />
			</LintContext.Provider>
		),
	};
}

const SEVERITIES: Readonly<Record<Severity, string>> = {
	error: "Error",
	warning: "Warning",
	info: "Note",
};

export function renderLintSettings(
	containerEl: HTMLElement,
	section: SettingsSection<LintSettings>,
): void {
	new Setting(containerEl).setName("Vault check").setHeading();
	for (const id of RULE_IDS) {
		const current = section.store.get()[id];
		const update = (patch: Partial<LintSettings[typeof id]>) =>
			void section.update((settings) => ({
				...settings,
				[id]: { ...settings[id], ...patch },
			}));
		new Setting(containerEl)
			.setName(RULES[id].title)
			.addToggle((toggle) =>
				toggle.setValue(current.enabled).onChange((enabled) => update({ enabled })),
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(SEVERITIES)
					.setValue(current.severity)
					.onChange((value) => update({ severity: value as Severity })),
			);
	}
}

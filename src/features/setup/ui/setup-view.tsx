import type { WorkspaceLeaf } from "obsidian";
import type { ReactNode } from "react";

import { ReactItemView } from "../../../shared/react";
import type { DependencyGate } from "../application/dependency-gate";
import { DependencyGateContext, SetupScreen } from "./setup-screen";

export const VIEW_TYPE_SETUP = "sbos-setup";

export class SetupView extends ReactItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private readonly gate: DependencyGate,
	) {
		super(leaf);
	}

	override getViewType(): string {
		return VIEW_TYPE_SETUP;
	}

	override getDisplayText(): string {
		return "Required plugins";
	}

	override getIcon(): string {
		return "plug";
	}

	protected override renderContent(): ReactNode {
		return (
			<DependencyGateContext.Provider value={this.gate}>
				<SetupScreen />
			</DependencyGateContext.Provider>
		);
	}
}

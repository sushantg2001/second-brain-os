import type { ReactNode } from "react";

import { createServiceContext, useStore } from "../../../shared/react";
import type { DependencyGate } from "../application/dependency-gate";
import type { DependencyState, DependencyStatus } from "../domain/dependencies";

export const DependencyGateContext = createServiceContext<DependencyGate>("DependencyGate");

const STATE_LABELS: Record<DependencyState, string> = {
	ready: "Ready",
	missing: "Not installed",
	disabled: "Installed but not enabled",
	outdated: "Update required",
};

function describeVersion(status: DependencyStatus): string {
	const minimum = `needs ${status.plugin.minVersion} or later`;
	return status.version ? `version ${status.version}, ${minimum}` : minimum;
}

export function SetupScreen(): ReactNode {
	const gate = DependencyGateContext.useService();
	const report = useStore(gate.report);

	return (
		<section className="sbos-setup" aria-labelledby="sbos-setup-title">
			<h2 id="sbos-setup-title">Required plugins</h2>
			<p>
				{report.ready
					? "All required plugins are ready."
					: "Install and enable these plugins from Community plugins, then check again."}
			</p>
			<ul className="sbos-setup__list" aria-label="Required plugins">
				{report.statuses.map((status) => (
					<li
						key={status.plugin.id}
						className={`sbos-setup__item sbos-setup__item--${status.state}`}
					>
						<span className="sbos-setup__name">{status.plugin.name}</span>
						<span className="sbos-setup__state">{STATE_LABELS[status.state]}</span>
						<span className="sbos-setup__purpose">{status.plugin.purpose}</span>
						<span className="sbos-setup__version">{describeVersion(status)}</span>
					</li>
				))}
			</ul>
			<button type="button" className="mod-cta" onClick={() => gate.recheck()}>
				Check again
			</button>
		</section>
	);
}

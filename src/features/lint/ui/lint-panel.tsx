import { useState, type ReactNode } from "react";

import type { ReadableStore } from "../../../shared/kernel";
import { createServiceContext, useStore } from "../../../shared/react";
import type { PpvNote } from "../../ppv";
import type { Linter } from "../application/linter";
import { RULES, type Finding, type LintFix, type RuleId } from "../domain/rules";

export interface LintServices {
	readonly linter: Linter;
	readonly version: ReadableStore<unknown>;
	readonly open: (path: string, line?: number) => void;
	readonly fix: (fix: LintFix) => void;
}

export const LintContext = createServiceContext<LintServices>("LintServices");

const SEVERITY_LABEL = { error: "Error", warning: "Warning", info: "Note" } as const;

function FindingItem({ finding }: { readonly finding: Finding }): ReactNode {
	const services = LintContext.useService();
	return (
		<li className={`sbos-finding sbos-finding--${finding.severity}`}>
			<span className="sbos-pill">{SEVERITY_LABEL[finding.severity]}</span>
			<button
				type="button"
				className="sbos-link"
				onClick={() => services.open(finding.path, finding.line ?? undefined)}
			>
				{finding.message}
			</button>
			{finding.fix && (
				<button type="button" onClick={() => finding.fix && services.fix(finding.fix)}>
					Fix…
				</button>
			)}
		</li>
	);
}

export function LintPanel(): ReactNode {
	const services = LintContext.useService();
	useStore(services.version);
	const findings = services.linter.run();
	const groups = new Map<RuleId, Finding[]>();
	for (const item of findings) {
		groups.set(item.rule, [...(groups.get(item.rule) ?? []), item]);
	}
	return (
		<div className="sbos-lint">
			<h2>Vault check</h2>
			<p className="sbos-muted">
				{findings.length === 0
					? "No problems found."
					: `${findings.length} ${findings.length === 1 ? "problem" : "problems"} found.`}
			</p>
			{[...groups].map(([rule, items]) => (
				<section key={rule} aria-labelledby={`sbos-rule-${rule}`}>
					<h3 id={`sbos-rule-${rule}`}>
						{RULES[rule].title} ({items.length})
					</h3>
					<ul className="sbos-finding-list">
						{items.map((item) => (
							<FindingItem
								key={`${item.path}:${item.line ?? ""}:${item.message}`}
								finding={item}
							/>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}

/** A few open findings for reviews. */
export function LintSummary({ limit = 5 }: { readonly limit?: number }): ReactNode {
	const services = LintContext.useService();
	useStore(services.version);
	const findings = services.linter.run();
	return (
		<>
			<h4>Vault check ({findings.length})</h4>
			{findings.length === 0 ? (
				<p className="sbos-muted">No problems found.</p>
			) : (
				<ul className="sbos-finding-list">
					{findings.slice(0, limit).map((item) => (
						<FindingItem
							key={`${item.path}:${item.line ?? ""}:${item.message}`}
							finding={item}
						/>
					))}
				</ul>
			)}
		</>
	);
}

export interface FixFormProps {
	readonly fix: LintFix;
	readonly linter: Linter;
	readonly parents: readonly PpvNote[];
	readonly onApply: (parentPath: string | null) => Promise<string | null>;
	readonly onCancel: () => void;
}

/** Shows exactly what a fix changes before applying it. */
export function FixForm({ fix, linter, parents, onApply, onCancel }: FixFormProps): ReactNode {
	const [parent, setParent] = useState(parents[0]?.path ?? "");
	const [error, setError] = useState<string | null>(null);
	const preview =
		fix.kind === "close-clock"
			? linter.previewCloseClock(fix)
			: parent
				? { before: null, after: linter.previewParent(parent) }
				: null;
	return (
		<form
			className="sbos-form"
			onSubmit={(event) => {
				event.preventDefault();
				void onApply(fix.kind === "set-parent" ? parent || null : null).then(setError);
			}}
		>
			{fix.kind === "set-parent" &&
				(parents.length === 0 ? (
					<p className="sbos-muted">
						There is nothing to link to yet. Create a pillar or goal first.
					</p>
				) : (
					<label>
						Link to
						<select value={parent} onChange={(event) => setParent(event.target.value)}>
							{parents.map((note) => (
								<option key={note.path} value={note.path}>
									{note.title}
								</option>
							))}
						</select>
					</label>
				))}
			{preview && (
				<div className="sbos-preview" aria-label="Preview">
					{preview.before !== null && (
						<pre className="sbos-preview__before">- {preview.before}</pre>
					)}
					<pre className="sbos-preview__after">+ {preview.after}</pre>
				</div>
			)}
			{error && (
				<p role="alert" className="sbos-form__error">
					{error}
				</p>
			)}
			<div className="modal-button-container">
				<button type="button" onClick={onCancel}>
					Cancel
				</button>
				<button type="submit" className="mod-cta" disabled={!preview}>
					Apply
				</button>
			</div>
		</form>
	);
}

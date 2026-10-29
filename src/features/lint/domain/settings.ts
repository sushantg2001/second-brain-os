import { RULE_IDS, RULES, type RuleId, type Severity } from "./rules";

export interface RuleSetting {
	readonly enabled: boolean;
	readonly severity: Severity;
}

export type LintSettings = Readonly<Record<RuleId, RuleSetting>>;

export const DEFAULT_LINT_SETTINGS: LintSettings = Object.fromEntries(
	RULE_IDS.map((id) => [id, { enabled: true, severity: RULES[id].severity }]),
) as Record<RuleId, RuleSetting>;

/** Drops findings of turned-off rules and applies severity overrides. */
export function applySettings<T extends { rule: RuleId; severity: Severity }>(
	findings: readonly T[],
	settings: LintSettings,
): T[] {
	return findings
		.filter((item) => settings[item.rule].enabled)
		.map((item) => ({ ...item, severity: settings[item.rule].severity }));
}

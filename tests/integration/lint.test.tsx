import { describe, expect, it } from "bun:test";
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { loadPlugin, sleep } from "../fakes/plugin-harness";

const VAULT = {
	"PPV/Pillars/Health.md": "---\ntype: pillar\n---\n",
	"PPV/Goals/Lost.md": "---\ntype: goal\n---\n",
	"PPV/Projects/Idle.md": '---\ntype: project\npillar: "[[Health]]"\n---\n',
	"2026-10-29.md": "- [ ] 10:00 - 09:00 Backwards\n- [ ] Long\n\t- [clock::2026-10-27T09:00--]",
	"2026-W44.md": "```sbos-review\n```",
};

async function setup(files: Record<string, string> = VAULT) {
	const harness = await loadPlugin({ files, today: "2026-10-29", minutes: 12 * 60 });
	await act(() => sleep(10));
	return harness;
}

async function openCheck(harness: Awaited<ReturnType<typeof setup>>) {
	harness.plugin.runCommand("check-vault");
	await act(() => sleep(0));
	const view = harness.app.workspace.getLeavesOfType("sbos-lint")[0]?.view;
	if (!view) {
		throw new Error("No lint view");
	}
	document.body.append(view.containerEl);
	await act(() => sleep(0));
	return { ui: within(view.contentEl), view };
}

describe("vault check", () => {
	it("groups findings by rule", async () => {
		const harness = await setup();
		const { ui, view } = await openCheck(harness);
		expect(ui.getByText("4 problems found.")).toBeInTheDocument();
		expect(
			ui.getByRole("region", { name: "Time block ends before it starts (1)" }),
		).toBeInTheDocument();
		expect(ui.getByRole("region", { name: "Goal without a pillar (1)" })).toBeInTheDocument();
		expect(
			ui.getByRole("region", { name: "Active project without a next action (1)" }),
		).toBeInTheDocument();
		expect(
			ui.getByRole("region", { name: "Clock running for more than 12 hours (1)" }),
		).toBeInTheDocument();
		expect([view.getViewType(), view.getDisplayText(), view.getIcon()]).toEqual([
			"sbos-lint",
			"Vault check",
			"stethoscope",
		]);
		harness.plugin.runCommand("check-vault");
		await act(() => sleep(0));
		expect(harness.app.workspace.getLeavesOfType("sbos-lint")).toHaveLength(1);
	});

	it("opens the note and line of a finding", async () => {
		const harness = await setup();
		const { ui } = await openCheck(harness);
		await userEvent.click(
			ui.getByRole("button", { name: '"10:00 - 09:00 Backwards" ends before it starts.' }),
		);
		await act(() => sleep(0));
		expect(harness.app.workspace.leaves.at(-1)?.openState).toMatchObject({
			eState: { line: 0 },
		});
	});

	it("previews and applies a clock fix", async () => {
		const harness = await setup();
		const { ui } = await openCheck(harness);
		const clockGroup = ui.getByRole("region", {
			name: "Clock running for more than 12 hours (1)",
		});
		await userEvent.click(within(clockGroup).getByRole("button", { name: "Fix…" }));
		const preview = screen.getByLabelText("Preview");
		expect(preview.textContent).toBe(
			"- \t- [clock::2026-10-27T09:00--]+ \t- [clock::2026-10-27T09:00--2026-10-29T12:00]",
		);
		await userEvent.click(screen.getByRole("button", { name: "Apply" }));
		await act(() => sleep(10));
		expect(harness.app.vault.contentOf("2026-10-29.md")).toContain(
			"[clock::2026-10-27T09:00--2026-10-29T12:00]",
		);
		expect(ui.getByText("3 problems found.")).toBeInTheDocument();
	});

	it("previews and applies a parent fix", async () => {
		const harness = await setup();
		const { ui } = await openCheck(harness);
		const group = ui.getByRole("region", { name: "Goal without a pillar (1)" });
		await userEvent.click(within(group).getByRole("button", { name: "Fix…" }));
		expect(screen.getByLabelText("Preview")).toHaveTextContent('+ pillar: "[[Health]]"');
		await userEvent.click(screen.getByRole("button", { name: "Apply" }));
		await act(() => sleep(10));
		expect(harness.app.vault.contentOf("PPV/Goals/Lost.md")).toContain(
			"pillar: '[[Health]]'".replace(/'/g, '"'),
		);
		expect(ui.queryByRole("region", { name: /Goal without a pillar/ })).toBeNull();
	});

	it("explains when there is nothing to link to", async () => {
		const harness = await setup({ "PPV/Goals/Lost.md": "---\ntype: goal\n---\n" });
		const { ui } = await openCheck(harness);
		await userEvent.click(ui.getByRole("button", { name: "Fix…" }));
		expect(screen.getByText(/There is nothing to link to yet/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
	});

	it("reports a clock that stopped before the fix was applied", async () => {
		const harness = await setup();
		const finding = harness.container.linter.run().find((item) => item.rule === "stale-clock");
		const fix = finding?.fix;
		if (fix?.kind !== "close-clock") {
			throw new Error("no fix");
		}
		await harness.container.clocks.stop();
		const result = await harness.container.linter.closeClock(fix);
		expect(!result.ok && result.error.message).toBe(
			"The note changed since it was read. Try again.",
		);
		const notRunning = await harness.container.linter.closeClock({
			...fix,
			raw: "\t- [clock::2026-10-27T09:00--2026-10-27T10:00]",
		});
		expect(!notRunning.ok && notRunning.error.message).toBe("That clock is no longer running.");
		expect(
			(await harness.container.linter.setParent("PPV/Goals/Lost.md", "missing.md")).ok,
		).toBe(false);
	});

	it("shows a summary in reviews", async () => {
		const harness = await setup();
		const handler = harness.plugin.codeBlockProcessors.get("sbos-review");
		const el = document.createElement("div");
		document.body.append(el);
		const children: { load(): void }[] = [];
		await act(async () => {
			await handler?.("", el, {
				sourcePath: "2026-W44.md",
				addChild: (child) => children.push(child),
			});
			children[0]?.load();
			await sleep(0);
		});
		expect(within(el).getByRole("heading", { name: "Vault check (4)" })).toBeInTheDocument();
	});

	it("shows a clean result", async () => {
		const harness = await setup({ "2026-W44.md": "```sbos-review\n```" });
		const { ui } = await openCheck(harness);
		expect(ui.getByText("No problems found.")).toBeInTheDocument();
	});

	it("follows rule settings", async () => {
		const harness = await setup();
		const tab = harness.plugin.settingTabs[0];
		if (!tab) {
			throw new Error("No settings tab");
		}
		document.body.append(tab.containerEl);
		tab.display();
		const settings = within(tab.containerEl);
		fireEvent.click(settings.getByRole("checkbox", { name: "Goal without a pillar" }));
		fireEvent.change(
			settings.getByRole("combobox", { name: "Clock running for more than 12 hours" }),
			{
				target: { value: "error" },
			},
		);
		await act(() => sleep(0));
		const findings = harness.container.linter.run();
		expect(findings.some((item) => item.rule === "orphan-goal")).toBe(false);
		expect(findings.find((item) => item.rule === "stale-clock")?.severity).toBe("error");
	});
});

import { describe, expect, it, spyOn } from "bun:test";
import { act, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { descendantsOf, type TimelineView } from "../../src/features/planner";
import { loadPlugin, sleep } from "../fakes/plugin-harness";

const DAY = "2026-10-29.md";

/** Main block with two sub blocks, as in a v3 daily note. */
const MAIN = [
	"## Day planner",
	"- [ ] 09:00 - 11:00 Main",
	"\t- [ ] 09:00 - 10:00 Sub",
	"\t- [ ] 10:00 - 11:00 Sub 2",
	"",
].join("\n");

async function setup(files: Record<string, string> = { [DAY]: MAIN }, minutes = 8 * 60) {
	const harness = await loadPlugin({ files, today: "2026-10-29", minutes });
	await act(() => sleep(10));
	const view = harness.app.workspace.getLeavesOfType("sbos-timeline")[0]
		?.view as unknown as TimelineView;
	document.body.append(view.containerEl);
	await act(() => sleep(0));
	const ui = within(view.contentEl);
	const content = (path = DAY) => harness.app.vault.contentOf(path);
	const settle = () => act(() => sleep(20));
	const plan = () => harness.container.planner.plan("2026-10-29");
	const block = (title: string) => {
		const found = plan().blocks.find((candidate) => candidate.title === title);
		if (!found) {
			throw new Error(`No block ${title}`);
		}
		return found;
	};
	/** Moves a block, and the blocks inside it, to a new start. */
	const move = (title: string, start: number) => {
		const target = block(title);
		return harness.container.planner.moveBlockWithChildren(
			target,
			descendantsOf(plan(), target),
			start,
		);
	};
	return { ...harness, view, ui, content, settle, plan, block, move };
}

const at = (hours: number, minutes = 0): number => hours * 60 + minutes;

describe("moving a parent block", () => {
	it("moves the blocks inside it, in one write", async () => {
		const { move, content, app } = await setup();
		const write = spyOn(app.vault, "process");
		expect((await move("Main", at(10))).ok).toBe(true);
		expect(write).toHaveBeenCalledTimes(1);
		expect(content()).toBe(
			[
				"## Day planner",
				"- [ ] 10:00 - 12:00 Main",
				"\t- [ ] 10:00 - 11:00 Sub",
				"\t- [ ] 11:00 - 12:00 Sub 2",
				"",
			].join("\n"),
		);
	});

	it("moves grandchildren too, and only what is inside the block that moves", async () => {
		const { move, content } = await setup({
			[DAY]: [
				"- [ ] 08:00 - 12:00 Top",
				"\t- [ ] 08:00 - 10:00 Mid",
				"\t\t- [ ] 08:00 - 09:00 Leaf",
				"\t- [ ] 11:00 - 12:00 Other",
			].join("\n"),
		});
		await move("Mid", at(9));
		expect(content()).toBe(
			[
				"- [ ] 08:00 - 12:00 Top",
				"\t- [ ] 09:00 - 11:00 Mid",
				"\t\t- [ ] 09:00 - 10:00 Leaf",
				"\t- [ ] 11:00 - 12:00 Other",
			].join("\n"),
		);
		await move("Top", at(9));
		expect(content()).toBe(
			[
				"- [ ] 09:00 - 13:00 Top",
				"\t- [ ] 10:00 - 12:00 Mid",
				"\t\t- [ ] 10:00 - 11:00 Leaf",
				"\t- [ ] 12:00 - 13:00 Other",
			].join("\n"),
		);
	});

	it("keeps a sub block that only has a start time without an end", async () => {
		const { move, content } = await setup({
			[DAY]: "- [ ] 09:00 - 11:00 Main\n\t- [ ] 10:00 Start only\n",
		});
		await move("Main", at(10));
		expect(content()).toBe("- [ ] 10:00 - 12:00 Main\n\t- [ ] 11:00 Start only\n");
	});

	it("moves sub blocks that are done", async () => {
		const { move, content } = await setup({
			[DAY]: "- [ ] 09:00 - 11:00 Main\n\t- [x] 09:00 - 10:00 Sub ✅ 2026-10-29\n",
		});
		await move("Main", at(10));
		expect(content()).toBe(
			"- [ ] 10:00 - 12:00 Main\n\t- [x] 10:00 - 11:00 Sub ✅ 2026-10-29\n",
		);
	});

	it("leaves a sub block that sticks out of the parent, and blocks in other notes, alone", async () => {
		const { move, content } = await setup({
			[DAY]: "- [ ] 09:00 - 11:00 Main\n\t- [ ] 10:30 - 11:30 Late\n",
			"Projects/Site.md": "- [ ] 09:30 - 10:00 Elsewhere ⏳ 2026-10-29\n",
		});
		await move("Main", at(10));
		expect(content()).toBe("- [ ] 10:00 - 12:00 Main\n\t- [ ] 10:30 - 11:30 Late\n");
		expect(content("Projects/Site.md")).toBe("- [ ] 09:30 - 10:00 Elsewhere ⏳ 2026-10-29\n");
	});

	it("moves a sub block on its own, with the blocks inside that one", async () => {
		const { move, content } = await setup();
		await move("Sub", at(10, 30));
		expect(content()).toBe(
			[
				"## Day planner",
				"- [ ] 09:00 - 11:00 Main",
				"\t- [ ] 10:30 - 11:30 Sub",
				"\t- [ ] 10:00 - 11:00 Sub 2",
				"",
			].join("\n"),
		);
	});

	it("changes only the time on each line and leaves clock lines alone", async () => {
		const note = [
			"## Day planner",
			"- [ ] 09:00 - 11:00 Main",
			"\t      [clock::2026-10-29T09:05:00--2026-10-29T09:50:00]",
			"\t- [x] 09:00 - 10:00 Sub  [completion:: 2026-10-29]",
			"\t\t[clock::2026-10-29T09:10:00--2026-10-29T09:20:00]",
			"\t\t- [clock::2026-10-29T09:30--2026-10-29T09:40]",
			"",
		].join("\n");
		const { move, content } = await setup({ [DAY]: note });
		await move("Main", at(9, 30));
		expect(content()).toBe(
			note
				.replace("09:00 - 11:00 Main", "09:30 - 11:30 Main")
				.replace("09:00 - 10:00 Sub", "09:30 - 10:30 Sub"),
		);
	});

	it("keeps Windows line endings", async () => {
		const { move, content } = await setup({ [DAY]: MAIN.replaceAll("\n", "\r\n") });
		await move("Main", at(10));
		expect(content()).toBe(
			[
				"## Day planner",
				"- [ ] 10:00 - 12:00 Main",
				"\t- [ ] 10:00 - 11:00 Sub",
				"\t- [ ] 11:00 - 12:00 Sub 2",
				"",
			].join("\r\n"),
		);
	});

	it("stops at the end of the day instead of shrinking, and writes nothing when it cannot move", async () => {
		const { move, content, app } = await setup({
			[DAY]: "- [ ] 22:00 - 24:00 Night\n\t- [ ] 23:00 - 24:00 Late\n",
		});
		const write = spyOn(app.vault, "process");
		expect((await move("Night", at(23))).ok).toBe(true);
		expect(write).not.toHaveBeenCalled();
		expect(content()).toBe("- [ ] 22:00 - 24:00 Night\n\t- [ ] 23:00 - 24:00 Late\n");
		await move("Night", at(20));
		expect(content()).toBe("- [ ] 20:00 - 22:00 Night\n\t- [ ] 21:00 - 22:00 Late\n");
	});

	it("moves the blocks inside by the amount the parent really moved when it hits the start of the day", async () => {
		const { move, content } = await setup({
			[DAY]: "- [ ] 00:30 - 02:30 Main\n\t- [ ] 00:30 - 01:30 Sub\n",
		});
		await move("Main", -60);
		expect(content()).toBe("- [ ] 00:00 - 02:00 Main\n\t- [ ] 00:00 - 01:00 Sub\n");
	});

	it("changes nothing when the start does not change", async () => {
		const { move, app } = await setup();
		const write = spyOn(app.vault, "process");
		expect((await move("Main", at(9))).ok).toBe(true);
		expect((await move("Main", at(9, 5))).ok).toBe(true);
		expect(write).not.toHaveBeenCalled();
	});

	it("moves nothing if any line changed since the plan was read", async () => {
		const { app, block, plan, container, content } = await setup();
		const main = block("Main");
		const inside = descendantsOf(plan(), main);
		const file = app.vault.getFileByPath(DAY);
		if (!file) {
			throw new Error("missing");
		}
		await app.vault.process(file, (text) => text.replace("Sub 2", "Sub two"));
		const before = content();
		const result = await container.planner.moveBlockWithChildren(main, inside, at(10));
		expect(result.ok).toBe(false);
		expect(!result.ok && result.error.message).toBe(
			"The note changed since it was read. Try again.",
		);
		expect(content()).toBe(before);
	});

	it("resizing a parent leaves the blocks inside it where they are", async () => {
		const { container, block, content, plan } = await setup();
		await container.planner.moveBlock(block("Main"), at(9), at(10));
		expect(content()).toBe(
			[
				"## Day planner",
				"- [ ] 09:00 - 10:00 Main",
				"\t- [ ] 09:00 - 10:00 Sub",
				"\t- [ ] 10:00 - 11:00 Sub 2",
				"",
			].join("\n"),
		);
		// Sub 2 no longer fits inside Main, so it stands on its own.
		expect(plan().blocks.map((candidate) => [candidate.title, candidate.parentId])).toEqual([
			["Main", null],
			["Sub", "2026-10-29.md:1"],
			["Sub 2", null],
		]);
	});

	it("removing the time from a parent leaves the blocks inside it", async () => {
		const { container, block, content, plan } = await setup();
		await container.planner.unschedule(block("Main"));
		expect(content()).toContain(
			"- [ ] Main\n\t- [ ] 09:00 - 10:00 Sub\n\t- [ ] 10:00 - 11:00 Sub 2",
		);
		expect(plan().blocks.map((candidate) => candidate.parentId)).toEqual([null, null]);
	});
});

describe("nested blocks on the timeline", () => {
	it("draws sub blocks inside the parent, positioned from its top", async () => {
		const { ui } = await setup();
		const parent = ui.getByRole("button", { name: "09:00 to 11:00, Main" })
			.parentElement as HTMLElement;
		const sub = ui.getByRole("button", { name: "09:00 to 10:00, Sub" })
			.parentElement as HTMLElement;
		const sub2 = ui.getByRole("button", { name: "10:00 to 11:00, Sub 2" })
			.parentElement as HTMLElement;
		expect(parent).toHaveClass("has-children");
		expect(parent.dataset.depth).toBe("0");
		expect(sub.parentElement).toHaveClass("sbos-block__children");
		expect(sub.parentElement?.parentElement).toBe(parent);
		expect(sub).toHaveClass("is-nested");
		expect(sub.dataset.depth).toBe("1");
		expect([sub.style.top, sub2.style.top]).toEqual(["0px", "60px"]);
		expect([parent.style.height, sub.style.height, sub2.style.height]).toEqual([
			"120px",
			"60px",
			"60px",
		]);
		expect(parent.style.width).toBe("100%");
		expect(sub.style.width).toBe("100%");
	});

	it("puts overlapping sub blocks side by side inside the parent", async () => {
		const { ui } = await setup({
			[DAY]: [
				"- [ ] 09:00 - 11:00 Main",
				"\t- [ ] 09:00 - 10:30 A",
				"\t- [ ] 10:00 - 11:00 B",
			].join("\n"),
		});
		const left = ui.getByRole("button", { name: "09:00 to 10:30, A" }).parentElement;
		const right = ui.getByRole("button", { name: "10:00 to 11:00, B" }).parentElement;
		expect([left?.style.left, left?.style.width]).toEqual(["0%", "50%"]);
		expect([right?.style.left, right?.style.width]).toEqual(["50%", "50%"]);
	});

	it("drags a parent to move the blocks inside it", async () => {
		const { ui, content, settle } = await setup();
		const title = ui.getByRole("button", { name: "09:00 to 11:00, Main" });
		const block = title.parentElement as HTMLElement;
		const column = block.parentElement as HTMLElement;
		fireEvent.pointerDown(block, { button: 0, clientY: 100, pointerId: 1 });
		fireEvent.pointerMove(column, { clientY: 160, pointerId: 1 });
		fireEvent.pointerUp(column, { clientY: 160, pointerId: 1 });
		fireEvent.click(title);
		await settle();
		expect(content()).toContain(
			"- [ ] 10:00 - 12:00 Main\n\t- [ ] 10:00 - 11:00 Sub\n\t- [ ] 11:00 - 12:00 Sub 2",
		);
	});

	it("drags a sub block without moving the parent", async () => {
		const { ui, content, settle } = await setup();
		const title = ui.getByRole("button", { name: "09:00 to 10:00, Sub" });
		const block = title.parentElement as HTMLElement;
		const column = block.closest(".sbos-timeline__column") as HTMLElement;
		fireEvent.pointerDown(block, { button: 0, clientY: 100, pointerId: 1 });
		fireEvent.pointerMove(column, { clientY: 130, pointerId: 1 });
		fireEvent.pointerUp(column, { clientY: 130, pointerId: 1 });
		fireEvent.click(title);
		await settle();
		expect(content()).toContain("- [ ] 09:00 - 11:00 Main\n\t- [ ] 09:30 - 10:30 Sub\n");
	});

	it("moves the whole tree with the arrow keys, and only the end with shift", async () => {
		const { ui, content, settle } = await setup();
		ui.getByRole("button", { name: "09:00 to 11:00, Main" }).focus();
		await userEvent.keyboard("{ArrowDown}");
		await settle();
		expect(content()).toContain(
			"- [ ] 09:15 - 11:15 Main\n\t- [ ] 09:15 - 10:15 Sub\n\t- [ ] 10:15 - 11:15 Sub 2",
		);
		ui.getByRole("button", { name: "09:15 to 11:15, Main" }).focus();
		await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}");
		await settle();
		expect(content()).toContain(
			"- [ ] 09:15 - 11:30 Main\n\t- [ ] 09:15 - 10:15 Sub\n\t- [ ] 10:15 - 11:15 Sub 2",
		);
	});

	it("resizes a parent from its bottom edge without moving what is inside", async () => {
		const { ui, content, settle } = await setup();
		const block = ui.getByRole("button", { name: "09:00 to 11:00, Main" })
			.parentElement as HTMLElement;
		const handle = block.querySelector(":scope > .sbos-block__resize") as HTMLElement;
		const column = block.parentElement as HTMLElement;
		fireEvent.pointerDown(handle, { button: 0, clientY: 300, pointerId: 1 });
		fireEvent.pointerMove(column, { clientY: 330, pointerId: 1 });
		fireEvent.pointerUp(column, { clientY: 330, pointerId: 1 });
		await settle();
		expect(content()).toContain(
			"- [ ] 09:00 - 11:30 Main\n\t- [ ] 09:00 - 10:00 Sub\n\t- [ ] 10:00 - 11:00 Sub 2",
		);
	});
});

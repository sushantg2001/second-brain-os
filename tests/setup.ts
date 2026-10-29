import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach, expect, mock } from "bun:test";

GlobalRegistrator.register();

// Imported after the DOM exists: Testing Library binds `screen` to document.body on load.
const { cleanup } = await import("@testing-library/react");
// The default export duplicates the named matchers and does not fit expect.extend.
const { default: _default, ...matchers } = await import("@testing-library/jest-dom/matchers");
expect.extend(matchers);

await mock.module("obsidian", () => import("./mocks/obsidian"));
const { Modal } = await import("./mocks/obsidian");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
	// A test that leaves a dialog open must not leak it into the next test.
	for (const modal of [...Modal.open]) {
		modal.close();
	}
	cleanup();
	document.body.replaceChildren();
});

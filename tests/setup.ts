import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach, expect, mock } from "bun:test";

GlobalRegistrator.register();

// Imported after the DOM exists: Testing Library binds `screen` to document.body on load.
const { cleanup } = await import("@testing-library/react");
const matchers = await import("@testing-library/jest-dom/matchers");
expect.extend(matchers);

await mock.module("obsidian", () => import("./mocks/obsidian"));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
	cleanup();
	document.body.replaceChildren();
});

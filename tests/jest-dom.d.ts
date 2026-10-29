import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

/* eslint-disable @typescript-eslint/no-empty-object-type -- module augmentation */
declare module "bun:test" {
	interface Matchers<T> extends TestingLibraryMatchers<typeof expect.stringContaining, T> {}
	interface AsymmetricMatchers extends TestingLibraryMatchers {}
}
/* eslint-enable @typescript-eslint/no-empty-object-type -- end of augmentation */

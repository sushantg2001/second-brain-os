import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { Icon } from "../../src/shared/react";

describe("Icon", () => {
	it("draws the named Obsidian icon and hides a decorative icon from assistive tech", () => {
		const { container } = render(<Icon name="calendar" />);
		const icon = container.querySelector(".sbos-icon");
		expect(icon).toHaveAttribute("data-icon", "calendar");
		expect(icon).toHaveAttribute("aria-hidden", "true");
	});

	it("exposes a labelled icon as an image", () => {
		render(<Icon name="clock" label="Open clock" className="extra" />);
		const icon = screen.getByRole("img", { name: "Open clock" });
		expect(icon).toHaveClass("sbos-icon", "extra");
	});
});

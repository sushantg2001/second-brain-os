import { setIcon } from "obsidian";
import { useEffect, useRef, type ReactNode } from "react";

interface IconProps {
	readonly name: string;
	/** Accessible label. Without one the icon is decorative and hidden from assistive tech. */
	readonly label?: string;
	readonly className?: string;
}

export function Icon({ name, label, className }: IconProps): ReactNode {
	const ref = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		if (ref.current) {
			setIcon(ref.current, name);
		}
	}, [name]);

	return (
		<span
			ref={ref}
			className={className ? `sbos-icon ${className}` : "sbos-icon"}
			{...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
		/>
	);
}

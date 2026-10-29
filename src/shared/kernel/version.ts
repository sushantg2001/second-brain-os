export interface Version {
	readonly major: number;
	readonly minor: number;
	readonly patch: number;
	readonly prerelease: readonly string[];
}

const VERSION_PATTERN =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** Parses a strict SemVer 2.0 string. A leading `v` is rejected on purpose. */
export function parseVersion(text: string): Version | null {
	const match = VERSION_PATTERN.exec(text);
	if (!match) {
		return null;
	}
	const [, major, minor, patch, prerelease] = match;
	return {
		major: Number(major),
		minor: Number(minor),
		patch: Number(patch),
		prerelease: prerelease ? prerelease.split(".") : [],
	};
}

function compareIdentifiers(a: string, b: string): number {
	const aNumeric = /^\d+$/.test(a);
	const bNumeric = /^\d+$/.test(b);
	if (aNumeric && bNumeric) {
		return Math.sign(Number(a) - Number(b));
	}
	if (aNumeric !== bNumeric) {
		return aNumeric ? -1 : 1;
	}
	return a < b ? -1 : a > b ? 1 : 0;
}

/** SemVer precedence: negative when `a` sorts before `b`, zero when equal, positive after. */
export function compareVersions(a: Version, b: Version): number {
	const core =
		Math.sign(a.major - b.major) ||
		Math.sign(a.minor - b.minor) ||
		Math.sign(a.patch - b.patch);
	if (core !== 0) {
		return core;
	}
	if (a.prerelease.length === 0 || b.prerelease.length === 0) {
		return Math.sign(b.prerelease.length - a.prerelease.length);
	}
	const length = Math.max(a.prerelease.length, b.prerelease.length);
	for (let i = 0; i < length; i++) {
		const left = a.prerelease[i];
		const right = b.prerelease[i];
		if (left === undefined || right === undefined) {
			return left === undefined ? -1 : 1;
		}
		const order = compareIdentifiers(left, right);
		if (order !== 0) {
			return order;
		}
	}
	return 0;
}

/** True when `actual` parses and is at or above `minimum`. */
export function isAtLeast(actual: string, minimum: string): boolean {
	const parsedActual = parseVersion(actual);
	const parsedMinimum = parseVersion(minimum);
	if (!parsedActual || !parsedMinimum) {
		return false;
	}
	return compareVersions(parsedActual, parsedMinimum) >= 0;
}

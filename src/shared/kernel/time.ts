/** Minutes since midnight. Pure helpers for wall-clock times such as "09:30". */
export type Minutes = number;

export const MINUTES_PER_DAY = 24 * 60;

const TIME_PATTERN = /^(\d{1,2}):(\d{2})(?:\s*([ap]m))?$/i;

/** Parses "9:30", "09:30", "9:30 pm" or "21:30". Returns null for anything else. */
export function parseTime(text: string): Minutes | null {
	const match = TIME_PATTERN.exec(text.trim());
	if (!match) {
		return null;
	}
	let hours = Number(match[1]);
	const minutes = Number(match[2]);
	const meridiem = match[3]?.toLowerCase();
	if (minutes > 59) {
		return null;
	}
	if (meridiem) {
		if (hours < 1 || hours > 12) {
			return null;
		}
		hours = (hours % 12) + (meridiem === "pm" ? 12 : 0);
	} else if (hours > 24 || (hours === 24 && minutes > 0)) {
		return null;
	}
	return hours * 60 + minutes;
}

/** Formats minutes as zero-padded 24-hour "HH:mm". 1440 formats as "24:00". */
export function formatTime(minutes: Minutes): string {
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** "1h 30m", "45m", "2h". */
export function formatDuration(minutes: Minutes): string {
	const whole = Math.max(0, Math.round(minutes));
	const hours = Math.floor(whole / 60);
	const rest = whole % 60;
	if (hours === 0) {
		return `${rest}m`;
	}
	return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function clampMinutes(minutes: Minutes, min = 0, max = MINUTES_PER_DAY): Minutes {
	return Math.min(max, Math.max(min, minutes));
}

export function snapMinutes(minutes: Minutes, step: number): Minutes {
	return Math.round(minutes / step) * step;
}

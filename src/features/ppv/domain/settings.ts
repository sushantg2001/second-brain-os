export const PPV_TYPES = ["pillar", "goal", "project", "resource"] as const;
export type PpvType = (typeof PPV_TYPES)[number];

export const PROJECT_STATUSES = ["backlog", "active", "paused", "done", "dropped"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const CAPTURE_TARGETS = ["daily", "inbox"] as const;
export type CaptureTarget = (typeof CAPTURE_TARGETS)[number];

export interface PpvSettings {
	readonly folders: Readonly<Record<PpvType, string>>;
	/** Template note per type, "" for the built-in one. */
	readonly templates: Readonly<Record<PpvType, string>>;
	readonly archiveFolder: string;
	/** Move projects to the archive folder when they are done or dropped. */
	readonly archiveClosedProjects: boolean;
	readonly captureTarget: CaptureTarget;
	readonly inboxPath: string;
	readonly captureHeading: string;
}

export const DEFAULT_PPV_SETTINGS: PpvSettings = {
	folders: {
		pillar: "PPV/Pillars",
		goal: "PPV/Goals",
		project: "PPV/Projects",
		resource: "PPV/Vault",
	},
	templates: { pillar: "", goal: "", project: "", resource: "" },
	archiveFolder: "PPV/Archive",
	archiveClosedProjects: true,
	captureTarget: "daily",
	inboxPath: "Inbox.md",
	captureHeading: "Inbox",
};

export const TYPE_LABELS: Readonly<Record<PpvType, string>> = {
	pillar: "Pillar",
	goal: "Goal",
	project: "Project",
	resource: "Resource",
};

export const STATUS_LABELS: Readonly<Record<ProjectStatus, string>> = {
	backlog: "Backlog",
	active: "Active",
	paused: "Paused",
	done: "Done",
	dropped: "Dropped",
};

export function isClosedStatus(status: ProjectStatus): boolean {
	return status === "done" || status === "dropped";
}

export { PpvIndex, type PpvSnapshot } from "./application/ppv-index";
export { nextStage, PpvService, STAGE_CYCLE, type PpvServiceDeps } from "./application/ppv-service";
export { classify, PARENT_KEYS, readPpvNote, type PpvNote } from "./domain/ppv-note";
export { parseBlockQuery, selectProjects, type BlockQuery } from "./domain/query";
export {
	CAPTURE_TARGETS,
	DEFAULT_PPV_SETTINGS,
	isClosedStatus,
	PPV_TYPES,
	PROJECT_STATUSES,
	STATUS_LABELS,
	TYPE_LABELS,
	type CaptureTarget,
	type PpvSettings,
	type PpvType,
	type ProjectStatus,
} from "./domain/settings";
export { defaultContent, safeFileName, type NewNoteInput } from "./domain/templates";
export { buildTree, type GoalNode, type PillarNode, type PpvTree } from "./domain/tree";
export { ancestorTitles } from "./ui/code-block";
export { registerPpv, type PpvModuleDeps } from "./ui/module";
export type { PpvServices, ProjectSummary } from "./ui/services";
export { renderPpvSettings } from "./ui/settings-section";
export { DashboardView, VIEW_TYPE_DASHBOARD } from "./ui/views";

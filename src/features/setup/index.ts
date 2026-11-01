export { DependencyGate } from "./application/dependency-gate";
export type { PluginRegistry } from "./application/ports";
export {
	evaluateDependencies,
	evaluateDependency,
	REQUIRED_PLUGINS,
	type DependencyReport,
	type DependencyState,
	type DependencyStatus,
	type InstalledPlugin,
	type RequiredPlugin,
} from "./domain/dependencies";
export { DependencyGateContext, SetupScreen } from "./ui/setup-screen";
export { SetupView, VIEW_TYPE_SETUP } from "./ui/setup-view";

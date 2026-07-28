import type { ComponentType } from "react";
import type * as THREE from "three/webgpu";

// A scenario is the configurable environment the sky is previewed from — terrain, water, forest.
// Deliberately app-level, not a runtime addon: the runtime's only extension point
// (registerLayerRuntimeAdapter) is for direction-sampled SKY layers, and its ARCHITECTURE.md puts
// internal modules outside the stability boundary. Scene content belongs here.
//
// The registry mirrors the effect-layer addon registry (src/effects/effect-layer.ts), including its
// React-free split: addons declare behaviour, the app attaches Icon/Panel via registerScenarioUi.

export type ScenarioContext = {
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGPURenderer;
  // The scene's existing on-demand render(). Scenarios call this after any async work that changes
  // what's on screen; synchronous param updates are already followed by a render from the caller.
  requestRender: () => void;
};

export type ScenarioInstance<TParams = unknown> = {
  // Added to the scenario group on build, removed and disposed on teardown.
  root: THREE.Object3D;
  update: (params: TParams) => void;
  // Called whenever the baked sky environment changes, so a scenario can pick it up for
  // reflections. Optional — terrain gets image-based lighting from scene.environment directly.
  setEnvironment?: (environment: THREE.Texture | null) => void;
  // Presence opts the scenario into a requestAnimationFrame loop. Omitting it keeps the viewport
  // on-demand, which is what terrain wants.
  animate?: (deltaSeconds: number) => void;
  dispose: () => void;
};

export type ScenarioAddon<TParams = unknown> = {
  id: string;
  displayName: string;
  // Attached by the app layer via registerScenarioUi so this module stays React-free.
  Icon?: ComponentType;
  Panel?: ComponentType;
  createDefaultParams: () => TParams;
  build: (context: ScenarioContext, params: TParams) => ScenarioInstance<TParams>;
};

const registeredScenarioAddons = new Map<string, ScenarioAddon>();

// Idempotent by design, unlike registerEffectLayerAddon: scenarios self-register from their own
// module, so a hot update re-evaluates the module and would throw on a duplicate id, breaking HMR
// for every file that imports it. Replacing the entry keeps dev reloads working; a genuine id
// collision surfaces immediately anyway, since the id is the value in the scenario picker.
export function registerScenarioAddon<TParams>(addon: ScenarioAddon<TParams>) {
  const previous = registeredScenarioAddons.get(addon.id);

  // Preserve UI attached by registerScenarioUi — that runs once, from a different module.
  if (previous) {
    addon.Icon ??= previous.Icon;
    addon.Panel ??= previous.Panel;
  }

  registeredScenarioAddons.set(addon.id, addon as ScenarioAddon);
}

export function getScenarioAddon(id: string) {
  const addon = registeredScenarioAddons.get(id);

  if (!addon) {
    throw new Error(`Scenario addon "${id}" is not registered.`);
  }

  return addon;
}

export function findScenarioAddon(id: string) {
  return registeredScenarioAddons.get(id) ?? null;
}

export function getScenarioAddons() {
  return Array.from(registeredScenarioAddons.values());
}

export function registerScenarioUi(
  id: string,
  ui: { Icon?: ComponentType; Panel?: ComponentType }
) {
  const addon = getScenarioAddon(id);

  addon.Icon = ui.Icon;
  addon.Panel = ui.Panel;
}

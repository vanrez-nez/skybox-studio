import * as THREE from "three/webgpu";

import { registerScenarioAddon, type ScenarioAddon } from "@/scenarios/scenario";

export const NONE_SCENARIO_ID = "none";

// The default scenario: builds nothing, so Preview opens showing just the sky. Registered as a real
// addon rather than special-cased with a null check, so every consumer can treat the active scenario
// uniformly.
export const noneScenarioAddon: ScenarioAddon<Record<string, never>> = {
  id: NONE_SCENARIO_ID,
  displayName: "None",
  createDefaultParams: () => ({}),
  build: () => ({
    root: new THREE.Group(),
    update: () => {},
    dispose: () => {},
  }),
};

registerScenarioAddon(noneScenarioAddon);

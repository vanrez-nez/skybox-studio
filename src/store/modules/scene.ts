import type { StateCreator } from "zustand";

import "@/scenarios/none";
import { createDefaultSceneParams, type SceneParams } from "@/scenarios/scene-params";
import { findScenarioAddon } from "@/scenarios/scenario";
import { TERRAIN_SCENARIO_ID } from "@/scenarios/terrain";

export type WorkspaceView = "editor" | "preview";
export type MenuId = "file" | "edit" | "layer" | "sky" | "view";
export type MenuCommandId =
  | "edit.redo"
  | "edit.undo"
  | "file.export.image"
  | "file.export.runtime"
  | "file.open"
  | "layer.delete"
  | "layer.focus"
  | "layer.lock"
  | "layer.unlock"
  | "layer.toggle-visibility";
export type MenuEventId = MenuId | MenuCommandId;
export type CameraRotationMode = "drag" | "scroll";
export type SceneRenderMode = "live" | "texture-baked";
export type SceneLookDirection = [number, number, number];
export type SkyGeometryType = "box" | "sphere";

export type MenuEvent = {
  id: MenuEventId;
  issuedAt: number;
};

export type LayerFocusRequest = {
  issuedAt: number;
  layerId: string;
};

export type SceneSlice = {
  activeView: WorkspaceView;
  cameraRotationMode: CameraRotationMode;
  lastLayerFocusRequest: LayerFocusRequest | null;
  lastMenuEvent: MenuEvent | null;
  sceneLookDirection: SceneLookDirection;
  sceneRenderMode: SceneRenderMode;
  skyGeometryType: SkyGeometryType;
  showGroundPlaneHelper: boolean;
  showOrientationGizmo: boolean;
  showSkyGeometry: boolean;
  // Flipped once the WebGPU renderer finishes async init. Never persisted — it must start false on
  // every load. The splash screen reveals its launcher panel off this.
  rendererReady: boolean;
  // Preview-mode scenario state. This is a VIEWING preference, not part of the sky document, so it
  // is persisted with the other workspace preferences and never touches SkyboxDocument.
  activeScenarioId: string;
  // Per-scenario params, keyed by scenario id, so switching away and back restores the tuning.
  scenarioParams: Record<string, unknown>;
  sceneParams: SceneParams;
  emitLayerFocusRequest: (layerId: string) => void;
  emitMenuEvent: (id: MenuEventId) => void;
  setActiveView: (view: WorkspaceView) => void;
  setCameraRotationMode: (mode: CameraRotationMode) => void;
  setSceneLookDirection: (direction: SceneLookDirection) => void;
  setSceneRenderMode: (mode: SceneRenderMode) => void;
  setSkyGeometryType: (type: SkyGeometryType) => void;
  setShowGroundPlaneHelper: (visible: boolean) => void;
  setShowOrientationGizmo: (visible: boolean) => void;
  setShowSkyGeometry: (visible: boolean) => void;
  setRendererReady: (ready: boolean) => void;
  setActiveScenario: (id: string) => void;
  // Merges a partial patch into the named scenario's params. Scenario tuning is not undoable —
  // SceneSlice is not a history participant, matching the existing scene toggles.
  updateScenarioParams: (id: string, patch: Record<string, unknown>) => void;
  updateSceneParams: (patch: Partial<SceneParams>) => void;
};

function scenarioDefaults(id: string): Record<string, unknown> {
  return (findScenarioAddon(id)?.createDefaultParams() as Record<string, unknown>) ?? {};
}

export const workspaceViews: Array<{ id: WorkspaceView; label: string }> = [
  { id: "editor", label: "Editor" },
  { id: "preview", label: "Preview" },
];

export const createSceneSlice: StateCreator<
  SceneSlice,
  [],
  [],
  SceneSlice
> = (set) => ({
  activeView: "editor",
  cameraRotationMode: "scroll",
  lastLayerFocusRequest: null,
  lastMenuEvent: null,
  sceneLookDirection: [0, 0, -1],
  sceneRenderMode: "live",
  skyGeometryType: "box",
  showGroundPlaneHelper: false,
  showOrientationGizmo: true,
  showSkyGeometry: false,
  rendererReady: false,
  activeScenarioId: TERRAIN_SCENARIO_ID,
  scenarioParams: {},
  sceneParams: createDefaultSceneParams(),
  emitLayerFocusRequest: (layerId) =>
    set({ lastLayerFocusRequest: { issuedAt: Date.now(), layerId } }),
  emitMenuEvent: (id) => set({ lastMenuEvent: { id, issuedAt: Date.now() } }),
  setActiveView: (view) => set({ activeView: view }),
  setCameraRotationMode: (mode) => set({ cameraRotationMode: mode }),
  setSceneLookDirection: (direction) => set({ sceneLookDirection: direction }),
  setSceneRenderMode: (mode) => set({ sceneRenderMode: mode === "texture-baked" ? "live" : mode }),
  setSkyGeometryType: (type) => set({ skyGeometryType: type }),
  setShowGroundPlaneHelper: (visible) => set({ showGroundPlaneHelper: visible }),
  setShowOrientationGizmo: (visible) => set({ showOrientationGizmo: visible }),
  setShowSkyGeometry: (visible) => set({ showSkyGeometry: visible }),
  setRendererReady: (ready) => set({ rendererReady: ready }),
  setActiveScenario: (id) =>
    set((state) => ({
      activeScenarioId: id,
      // Seed the full default set on first selection. Without this the first param patch would be
      // the entire stored object, leaving every other field undefined.
      scenarioParams: state.scenarioParams[id]
        ? state.scenarioParams
        : { ...state.scenarioParams, [id]: scenarioDefaults(id) },
    })),
  updateScenarioParams: (id, patch) =>
    set((state) => ({
      scenarioParams: {
        ...state.scenarioParams,
        // Defaults underneath so a patch can never drop fields, including ones added by a build
        // newer than the persisted params.
        [id]: { ...scenarioDefaults(id), ...(state.scenarioParams[id] as object | undefined), ...patch },
      },
    })),
  updateSceneParams: (patch) =>
    set((state) => ({
      sceneParams: {
        ...state.sceneParams,
        ...patch,
        ambient: { ...state.sceneParams.ambient, ...patch.ambient },
        fog: { ...state.sceneParams.fog, ...patch.fog },
        sun: { ...state.sceneParams.sun, ...patch.sun },
      },
    })),
});

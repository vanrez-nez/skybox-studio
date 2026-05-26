import type { StateCreator } from "zustand";

export type WorkspaceView = "editor" | "preview";
export type MenuId = "file" | "edit" | "layer" | "sky" | "view";
export type MenuCommandId =
  | "edit.redo"
  | "edit.undo"
  | "file.export"
  | "file.load"
  | "layer.delete"
  | "layer.focus"
  | "layer.toggle-visibility";
export type MenuEventId = MenuId | MenuCommandId;
export type CameraRotationMode = "drag" | "scroll";
export type SceneRenderMode = "live" | "texture-baked";
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
  sceneRenderMode: SceneRenderMode;
  skyGeometryType: SkyGeometryType;
  showGroundPlaneHelper: boolean;
  showOrientationGizmo: boolean;
  showSkyGeometry: boolean;
  emitLayerFocusRequest: (layerId: string) => void;
  emitMenuEvent: (id: MenuEventId) => void;
  setActiveView: (view: WorkspaceView) => void;
  setCameraRotationMode: (mode: CameraRotationMode) => void;
  setSceneRenderMode: (mode: SceneRenderMode) => void;
  setSkyGeometryType: (type: SkyGeometryType) => void;
  setShowGroundPlaneHelper: (visible: boolean) => void;
  setShowOrientationGizmo: (visible: boolean) => void;
  setShowSkyGeometry: (visible: boolean) => void;
};

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
  cameraRotationMode: "drag",
  lastLayerFocusRequest: null,
  lastMenuEvent: null,
  sceneRenderMode: "live",
  skyGeometryType: "box",
  showGroundPlaneHelper: false,
  showOrientationGizmo: true,
  showSkyGeometry: false,
  emitLayerFocusRequest: (layerId) =>
    set({ lastLayerFocusRequest: { issuedAt: Date.now(), layerId } }),
  emitMenuEvent: (id) => set({ lastMenuEvent: { id, issuedAt: Date.now() } }),
  setActiveView: (view) => set({ activeView: view }),
  setCameraRotationMode: (mode) => set({ cameraRotationMode: mode }),
  setSceneRenderMode: (mode) => set({ sceneRenderMode: mode === "texture-baked" ? "live" : mode }),
  setSkyGeometryType: (type) => set({ skyGeometryType: type }),
  setShowGroundPlaneHelper: (visible) => set({ showGroundPlaneHelper: visible }),
  setShowOrientationGizmo: (visible) => set({ showOrientationGizmo: visible }),
  setShowSkyGeometry: (visible) => set({ showSkyGeometry: visible }),
});

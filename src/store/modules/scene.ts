import type { StateCreator } from "zustand";

export type WorkspaceView = "editor" | "preview";
export type MenuId = "file" | "edit" | "sky" | "view";
export type MenuCommandId = "edit.redo" | "edit.undo" | "file.export" | "file.load";
export type MenuEventId = MenuId | MenuCommandId;
export type CameraRotationMode = "drag" | "scroll";
export type SceneRenderMode = "live" | "texture-baked";
export type SkyGeometryType = "box" | "sphere";

export type MenuEvent = {
  id: MenuEventId;
  issuedAt: number;
};

export type SceneSlice = {
  activeView: WorkspaceView;
  cameraRotationMode: CameraRotationMode;
  lastMenuEvent: MenuEvent | null;
  sceneRenderMode: SceneRenderMode;
  skyGeometryType: SkyGeometryType;
  showGroundPlaneHelper: boolean;
  showOrientationGizmo: boolean;
  showSkyGeometry: boolean;
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
  lastMenuEvent: null,
  sceneRenderMode: "live",
  skyGeometryType: "box",
  showGroundPlaneHelper: false,
  showOrientationGizmo: true,
  showSkyGeometry: false,
  emitMenuEvent: (id) => set({ lastMenuEvent: { id, issuedAt: Date.now() } }),
  setActiveView: (view) => set({ activeView: view }),
  setCameraRotationMode: (mode) => set({ cameraRotationMode: mode }),
  setSceneRenderMode: (mode) => set({ sceneRenderMode: mode === "texture-baked" ? "live" : mode }),
  setSkyGeometryType: (type) => set({ skyGeometryType: type }),
  setShowGroundPlaneHelper: (visible) => set({ showGroundPlaneHelper: visible }),
  setShowOrientationGizmo: (visible) => set({ showOrientationGizmo: visible }),
  setShowSkyGeometry: (visible) => set({ showSkyGeometry: visible }),
});

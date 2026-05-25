import type { StateCreator } from "zustand";

export type WorkspaceView = "editor" | "preview";
export type MenuId = "file" | "edit";
export type MenuCommandId = "edit.redo" | "edit.undo" | "file.export" | "file.load";
export type MenuEventId = MenuId | MenuCommandId;
export type SceneRenderMode = "live" | "texture-baked";
export type SkyGeometryType = "box" | "sphere";

export type MenuEvent = {
  id: MenuEventId;
  issuedAt: number;
};

export type SceneSlice = {
  activeView: WorkspaceView;
  lastMenuEvent: MenuEvent | null;
  sceneRenderMode: SceneRenderMode;
  skyGeometryType: SkyGeometryType;
  showOrientationGizmo: boolean;
  showSkyGeometry: boolean;
  emitMenuEvent: (id: MenuEventId) => void;
  setActiveView: (view: WorkspaceView) => void;
  setSceneRenderMode: (mode: SceneRenderMode) => void;
  setSkyGeometryType: (type: SkyGeometryType) => void;
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
  lastMenuEvent: null,
  sceneRenderMode: "live",
  skyGeometryType: "box",
  showOrientationGizmo: true,
  showSkyGeometry: false,
  emitMenuEvent: (id) => set({ lastMenuEvent: { id, issuedAt: Date.now() } }),
  setActiveView: (view) => set({ activeView: view }),
  setSceneRenderMode: (mode) => set({ sceneRenderMode: mode }),
  setSkyGeometryType: (type) => set({ skyGeometryType: type }),
  setShowOrientationGizmo: (visible) => set({ showOrientationGizmo: visible }),
  setShowSkyGeometry: (visible) => set({ showSkyGeometry: visible }),
});

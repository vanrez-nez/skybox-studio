import type { StateCreator } from "zustand";

export type WorkspaceView = "editor" | "preview";
export type MenuId = "file" | "edit";
export type MenuCommandId = "file.export" | "file.load";
export type MenuEventId = MenuId | MenuCommandId;
export type SceneRenderMode = "live" | "texture-baked";

export type MenuEvent = {
  id: MenuEventId;
  issuedAt: number;
};

export type SceneSlice = {
  activeView: WorkspaceView;
  lastMenuEvent: MenuEvent | null;
  sceneRenderMode: SceneRenderMode;
  showOrientationGizmo: boolean;
  emitMenuEvent: (id: MenuEventId) => void;
  setActiveView: (view: WorkspaceView) => void;
  setSceneRenderMode: (mode: SceneRenderMode) => void;
  setShowOrientationGizmo: (visible: boolean) => void;
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
  showOrientationGizmo: true,
  emitMenuEvent: (id) => set({ lastMenuEvent: { id, issuedAt: Date.now() } }),
  setActiveView: (view) => set({ activeView: view }),
  setSceneRenderMode: (mode) => set({ sceneRenderMode: mode }),
  setShowOrientationGizmo: (visible) => set({ showOrientationGizmo: visible }),
});

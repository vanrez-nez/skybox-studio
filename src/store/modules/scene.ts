import type { StateCreator } from "zustand";

export type WorkspaceView = "editor" | "preview";
export type MenuId = "file" | "edit";
export type MenuCommandId = "file.export" | "file.load";
export type MenuEventId = MenuId | MenuCommandId;

export type MenuEvent = {
  id: MenuEventId;
  issuedAt: number;
};

export type SceneSlice = {
  activeView: WorkspaceView;
  lastMenuEvent: MenuEvent | null;
  emitMenuEvent: (id: MenuEventId) => void;
  setActiveView: (view: WorkspaceView) => void;
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
  emitMenuEvent: (id) => set({ lastMenuEvent: { id, issuedAt: Date.now() } }),
  setActiveView: (view) => set({ activeView: view }),
});

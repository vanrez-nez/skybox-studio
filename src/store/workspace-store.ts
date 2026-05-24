import { create } from "zustand";

export type WorkspaceView = "editor" | "preview";
export type MenuId = "file" | "edit";
export type MenuCommandId = "file.export" | "file.load";
export type MenuEventId = MenuId | MenuCommandId;

type MenuEvent = {
  id: MenuEventId;
  issuedAt: number;
};

type WorkspaceStore = {
  activeView: WorkspaceView;
  lastMenuEvent: MenuEvent | null;
  setActiveView: (view: WorkspaceView) => void;
  emitMenuEvent: (id: MenuEventId) => void;
};

export const workspaceViews: Array<{ id: WorkspaceView; label: string }> = [
  { id: "editor", label: "Editor" },
  { id: "preview", label: "Preview" },
];

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  activeView: "editor",
  lastMenuEvent: null,
  setActiveView: (view) => set({ activeView: view }),
  emitMenuEvent: (id) => set({ lastMenuEvent: { id, issuedAt: Date.now() } }),
}));

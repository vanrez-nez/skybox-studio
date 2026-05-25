import { create } from "zustand";

import { createLayersSlice, type LayersSlice } from "@/store/modules/layers";
import { createSceneSlice, type SceneSlice } from "@/store/modules/scene";

export type WorkspaceStore = SceneSlice & LayersSlice;

export const useWorkspaceStore = create<WorkspaceStore>()((...storeApi) => ({
  ...createSceneSlice(...storeApi),
  ...createLayersSlice(...storeApi),
}));

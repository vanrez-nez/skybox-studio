import { create } from "zustand";
import type { StateCreator } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  createLayersSlice,
  layersHistoryParticipant,
  type LayersSlice,
} from "@/store/modules/layers";
import { createSceneSlice, type SceneSlice } from "@/store/modules/scene";

export type HistorySnapshot = Record<string, unknown>;

export type HistoryParticipant<TStore> = {
  capture: (state: TStore) => unknown;
  id: string;
  restore: (snapshot: unknown) => Partial<TStore>;
};

export type HistorySlice = {
  activeHistorySnapshot: HistorySnapshot | null;
  beginHistoryTransaction: () => void;
  cancelHistoryTransaction: () => void;
  commitHistoryTransaction: () => void;
  createHistoryCheckpoint: (state: WorkspaceStore) => Pick<
    HistorySlice,
    "activeHistorySnapshot" | "historyFuture" | "historyPast"
  >;
  historyFuture: HistorySnapshot[];
  historyPast: HistorySnapshot[];
  redoHistory: () => void;
  undoHistory: () => void;
};

export type WorkspaceStore = SceneSlice & LayersSlice & HistorySlice;

type PersistedWorkspacePreferences = Pick<
  WorkspaceStore,
  | "activeView"
  | "effectLayers"
  | "fieldGradient"
  | "gradient"
  | "image"
  | "sceneRenderMode"
  | "selectedLayerId"
  | "skyGeometryType"
  | "showGroundPlaneHelper"
  | "showOrientationGizmo"
  | "showSkyGeometry"
>;

function captureHistorySnapshot(
  participants: Array<HistoryParticipant<WorkspaceStore>>,
  state: WorkspaceStore
): HistorySnapshot {
  return Object.fromEntries(
    participants.map((participant) => [participant.id, participant.capture(state)])
  );
}

function restoreHistorySnapshot(
  participants: Array<HistoryParticipant<WorkspaceStore>>,
  snapshot: HistorySnapshot
) {
  return participants.reduce<Partial<WorkspaceStore>>((restorePatch, participant) => {
    if (!(participant.id in snapshot)) {
      return restorePatch;
    }

    return {
      ...restorePatch,
      ...participant.restore(snapshot[participant.id]),
    };
  }, {});
}

function areHistorySnapshotsEqual(firstSnapshot: HistorySnapshot, secondSnapshot: HistorySnapshot) {
  return JSON.stringify(firstSnapshot) === JSON.stringify(secondSnapshot);
}

function createHistorySlice(
  participants: Array<HistoryParticipant<WorkspaceStore>>
): StateCreator<WorkspaceStore, [], [], HistorySlice> {
  return (set) => ({
    activeHistorySnapshot: null,
    beginHistoryTransaction: () =>
      set((state) => {
        if (state.activeHistorySnapshot) {
          return state;
        }

        return {
          activeHistorySnapshot: captureHistorySnapshot(participants, state),
        };
      }),
    cancelHistoryTransaction: () => set({ activeHistorySnapshot: null }),
    commitHistoryTransaction: () =>
      set((state) => {
        const transactionSnapshot = state.activeHistorySnapshot;

        if (!transactionSnapshot) {
          return state;
        }

        const currentSnapshot = captureHistorySnapshot(participants, state);

        if (areHistorySnapshotsEqual(transactionSnapshot, currentSnapshot)) {
          return {
            activeHistorySnapshot: null,
          };
        }

        return {
          activeHistorySnapshot: null,
          historyFuture: [],
          historyPast: [...state.historyPast, transactionSnapshot],
        };
      }),
    createHistoryCheckpoint: (state) => ({
      activeHistorySnapshot: null,
      historyFuture: [],
      historyPast: [
        ...state.historyPast,
        state.activeHistorySnapshot ?? captureHistorySnapshot(participants, state),
      ],
    }),
    historyFuture: [],
    historyPast: [],
    redoHistory: () =>
      set((state) => {
        const next = state.historyFuture[0];

        if (!next) {
          return state;
        }

        return {
          ...restoreHistorySnapshot(participants, next),
          activeHistorySnapshot: null,
          historyFuture: state.historyFuture.slice(1),
          historyPast: [...state.historyPast, captureHistorySnapshot(participants, state)],
        };
      }),
    undoHistory: () =>
      set((state) => {
        const previous = state.historyPast[state.historyPast.length - 1];

        if (!previous) {
          return state;
        }

        return {
          ...restoreHistorySnapshot(participants, previous),
          activeHistorySnapshot: null,
          historyFuture: [captureHistorySnapshot(participants, state), ...state.historyFuture],
          historyPast: state.historyPast.slice(0, -1),
        };
      }),
  });
}

const historyParticipants: Array<HistoryParticipant<WorkspaceStore>> = [
  layersHistoryParticipant,
];

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (...storeApi) => ({
      ...createSceneSlice(...storeApi),
      ...createHistorySlice(historyParticipants)(...storeApi),
      ...createLayersSlice(...storeApi),
    }),
    {
      name: "skybox-studio-session",
      partialize: (state): PersistedWorkspacePreferences => ({
        activeView: state.activeView,
        effectLayers: state.effectLayers,
        fieldGradient: state.fieldGradient,
        gradient: state.gradient,
        image: state.image,
        sceneRenderMode: state.sceneRenderMode === "texture-baked" ? "live" : state.sceneRenderMode,
        selectedLayerId: state.selectedLayerId,
        skyGeometryType: state.skyGeometryType,
        showGroundPlaneHelper: state.showGroundPlaneHelper,
        showOrientationGizmo: state.showOrientationGizmo,
        showSkyGeometry: state.showSkyGeometry,
      }),
      storage: createJSONStorage(() => sessionStorage),
      version: 2,
    }
  )
);

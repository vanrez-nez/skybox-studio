import { create } from "zustand";
import type { StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import type { PersistStorage, StorageValue } from "zustand/middleware";

import {
  createLayersSlice,
  layersHistoryParticipant,
  type ImageState,
  type LayersSlice,
} from "@/store/modules/layers";
import { createSceneSlice, type SceneSlice } from "@/store/modules/scene";

export type HistorySnapshot = Record<string, unknown>;

export type HistoryParticipant<TStore> = {
  capture: (state: TStore) => unknown;
  id: string;
  restore: (snapshot: unknown, currentState: TStore) => Partial<TStore>;
};

export type HistoryTransaction = {
  scope: string;
  snapshot: HistorySnapshot;
};

export type HistorySlice = {
  activeHistoryTransaction: HistoryTransaction | null;
  beginHistoryTransaction: (scope?: string) => void;
  cancelHistoryTransaction: (scope?: string) => void;
  commitHistoryTransaction: (scope?: string) => void;
  createHistoryCheckpoint: (state: WorkspaceStore) => Pick<
    HistorySlice,
    "activeHistoryTransaction" | "historyFuture" | "historyPast"
  >;
  historyFuture: HistorySnapshot[];
  historyPast: HistorySnapshot[];
  isHistoryTransactionActive: (scope?: string) => boolean;
  redoHistory: () => void;
  undoHistory: () => void;
};

export type WorkspaceStore = SceneSlice & LayersSlice & HistorySlice;

type PersistedWorkspacePreferences = Pick<
  WorkspaceStore,
  | "activeView"
  | "cameraRotationMode"
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

let isStorageHistoryTransactionActive = false;
const DEFAULT_HISTORY_TRANSACTION_SCOPE = "global";
const MAX_HISTORY_OPERATIONS = 50;

function pushHistorySnapshot(
  history: HistorySnapshot[],
  snapshot: HistorySnapshot
): HistorySnapshot[] {
  return [...history, snapshot].slice(-MAX_HISTORY_OPERATIONS);
}

function unshiftHistorySnapshot(
  history: HistorySnapshot[],
  snapshot: HistorySnapshot
): HistorySnapshot[] {
  return [snapshot, ...history].slice(0, MAX_HISTORY_OPERATIONS);
}

function omitRuntimeImageData(image: ImageState): ImageState {
  return {
    ...image,
    pixels: null,
    src: null,
  };
}

function omitRuntimeImageLayerData(effectLayers: WorkspaceStore["effectLayers"]) {
  return effectLayers.map((layer) =>
    layer.type === "image"
      ? {
          ...layer,
          params: omitRuntimeImageData(layer.params),
        }
      : layer
  );
}

function beginStorageHistoryTransaction() {
  isStorageHistoryTransactionActive = true;
}

function endStorageHistoryTransaction() {
  isStorageHistoryTransactionActive = false;
}

function createTransactionAwareSessionStorage<T>(): PersistStorage<T> {
  return {
    getItem: (name) => {
      const value = sessionStorage.getItem(name);

      return value ? (JSON.parse(value) as StorageValue<T>) : null;
    },
    removeItem: (name) => sessionStorage.removeItem(name),
    setItem: (name, value) => {
      if (isStorageHistoryTransactionActive) {
        return;
      }

      try {
        sessionStorage.setItem(name, JSON.stringify(value));
      } catch (error) {
        if (error instanceof DOMException && error.name === "QuotaExceededError") {
          sessionStorage.removeItem(name);
          return;
        }

        throw error;
      }
    },
  };
}

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
  snapshot: HistorySnapshot,
  currentState: WorkspaceStore
) {
  return participants.reduce<Partial<WorkspaceStore>>((restorePatch, participant) => {
    if (!(participant.id in snapshot)) {
      return restorePatch;
    }

    return {
      ...restorePatch,
      ...participant.restore(snapshot[participant.id], currentState),
    };
  }, {});
}

function areHistorySnapshotsEqual(firstSnapshot: HistorySnapshot, secondSnapshot: HistorySnapshot) {
  return JSON.stringify(firstSnapshot) === JSON.stringify(secondSnapshot);
}

function createHistorySlice(
  participants: Array<HistoryParticipant<WorkspaceStore>>
): StateCreator<WorkspaceStore, [], [], HistorySlice> {
  return (set, get) => ({
    activeHistoryTransaction: null,
    beginHistoryTransaction: (scope = DEFAULT_HISTORY_TRANSACTION_SCOPE) =>
      set((state) => {
        if (state.activeHistoryTransaction) {
          return state;
        }

        beginStorageHistoryTransaction();

        return {
          activeHistoryTransaction: {
            scope,
            snapshot: captureHistorySnapshot(participants, state),
          },
        };
      }),
    cancelHistoryTransaction: (scope) =>
      set((state) => {
        if (
          scope &&
          state.activeHistoryTransaction &&
          state.activeHistoryTransaction.scope !== scope
        ) {
          return state;
        }

        endStorageHistoryTransaction();

        return { activeHistoryTransaction: null };
      }),
    commitHistoryTransaction: (scope) =>
      set((state) => {
        const transaction = state.activeHistoryTransaction;

        if (scope && transaction && transaction.scope !== scope) {
          return state;
        }

        endStorageHistoryTransaction();

        if (!transaction) {
          return state;
        }

        const currentSnapshot = captureHistorySnapshot(participants, state);

        if (areHistorySnapshotsEqual(transaction.snapshot, currentSnapshot)) {
          return {
            activeHistoryTransaction: null,
          };
        }

        return {
          activeHistoryTransaction: null,
          historyFuture: [],
          historyPast: pushHistorySnapshot(state.historyPast, transaction.snapshot),
        };
      }),
    createHistoryCheckpoint: (state) => {
      endStorageHistoryTransaction();

      return {
        activeHistoryTransaction: null,
        historyFuture: [],
        historyPast: pushHistorySnapshot(
          state.historyPast,
          state.activeHistoryTransaction?.snapshot ?? captureHistorySnapshot(participants, state),
        ),
      };
    },
    historyFuture: [],
    historyPast: [],
    isHistoryTransactionActive: (scope) => {
      const transaction = get().activeHistoryTransaction;

      if (!transaction) {
        return false;
      }

      return scope ? transaction.scope === scope : true;
    },
    redoHistory: () =>
      set((state) => {
        endStorageHistoryTransaction();

        const next = state.historyFuture[0];

        if (!next) {
          return state;
        }

        return {
          ...restoreHistorySnapshot(participants, next, state),
          activeHistoryTransaction: null,
          historyFuture: state.historyFuture.slice(1),
          historyPast: pushHistorySnapshot(
            state.historyPast,
            captureHistorySnapshot(participants, state)
          ),
        };
      }),
    undoHistory: () =>
      set((state) => {
        endStorageHistoryTransaction();

        const previous = state.historyPast[state.historyPast.length - 1];

        if (!previous) {
          return state;
        }

        return {
          ...restoreHistorySnapshot(participants, previous, state),
          activeHistoryTransaction: null,
          historyFuture: unshiftHistorySnapshot(
            state.historyFuture,
            captureHistorySnapshot(participants, state)
          ),
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
        cameraRotationMode: state.cameraRotationMode,
        effectLayers: omitRuntimeImageLayerData(state.effectLayers),
        fieldGradient: state.fieldGradient,
        gradient: state.gradient,
        image: omitRuntimeImageData(state.image),
        sceneRenderMode: state.sceneRenderMode === "texture-baked" ? "live" : state.sceneRenderMode,
        selectedLayerId: state.selectedLayerId,
        skyGeometryType: state.skyGeometryType,
        showGroundPlaneHelper: state.showGroundPlaneHelper,
        showOrientationGizmo: state.showOrientationGizmo,
        showSkyGeometry: state.showSkyGeometry,
      }),
      storage: createTransactionAwareSessionStorage<PersistedWorkspacePreferences>(),
      version: 2,
    }
  )
);

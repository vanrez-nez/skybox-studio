import { create } from "zustand";

export type WorkspaceView = "editor" | "preview";
export type MenuId = "file" | "edit";
export type MenuCommandId = "file.export" | "file.load";
export type MenuEventId = MenuId | MenuCommandId;
export type GradientMode = "linear" | "radial";

export type GradientStop = {
  color: string;
  id: string;
  location: number;
  opacity: number;
};

export type GradientState = {
  mode: GradientMode;
  rotation: number;
  selectedStopId: string;
  stops: GradientStop[];
};

type MenuEvent = {
  id: MenuEventId;
  issuedAt: number;
};

type WorkspaceStore = {
  activeView: WorkspaceView;
  gradient: GradientState;
  lastMenuEvent: MenuEvent | null;
  emitMenuEvent: (id: MenuEventId) => void;
  removeGradientStop: (id: string) => void;
  selectGradientStop: (id: string) => void;
  setActiveView: (view: WorkspaceView) => void;
  setGradientMode: (mode: GradientMode) => void;
  setGradientRotation: (rotation: number) => void;
  updateGradientStop: (id: string, update: Partial<Omit<GradientStop, "id">>) => void;
};

export const workspaceViews: Array<{ id: WorkspaceView; label: string }> = [
  { id: "editor", label: "Editor" },
  { id: "preview", label: "Preview" },
];

const defaultGradientStops: GradientStop[] = [
  { id: "start", color: "#ff6a00", location: 0, opacity: 100 },
  { id: "middle", color: "#ffd000", location: 50, opacity: 100 },
  { id: "end", color: "#ff8a00", location: 100, opacity: 100 },
];

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  activeView: "editor",
  gradient: {
    mode: "radial",
    rotation: 0,
    selectedStopId: "middle",
    stops: defaultGradientStops,
  },
  lastMenuEvent: null,
  emitMenuEvent: (id) => set({ lastMenuEvent: { id, issuedAt: Date.now() } }),
  removeGradientStop: (id) =>
    set((state) => {
      if (state.gradient.stops.length <= 2) {
        return state;
      }

      const nextStops = state.gradient.stops.filter((stop) => stop.id !== id);

      return {
        gradient: {
          ...state.gradient,
          selectedStopId:
            state.gradient.selectedStopId === id ? nextStops[0].id : state.gradient.selectedStopId,
          stops: nextStops,
        },
      };
    }),
  selectGradientStop: (id) =>
    set((state) => ({
      gradient: {
        ...state.gradient,
        selectedStopId: id,
      },
    })),
  setActiveView: (view) => set({ activeView: view }),
  setGradientMode: (mode) =>
    set((state) => ({
      gradient: {
        ...state.gradient,
        mode,
      },
    })),
  setGradientRotation: (rotation) =>
    set((state) => ({
      gradient: {
        ...state.gradient,
        rotation,
      },
    })),
  updateGradientStop: (id, update) =>
    set((state) => ({
      gradient: {
        ...state.gradient,
        stops: state.gradient.stops.map((stop) =>
          stop.id === id
            ? {
                ...stop,
                ...update,
                location:
                  update.location === undefined ? stop.location : clampPercent(update.location),
                opacity: update.opacity === undefined ? stop.opacity : clampPercent(update.opacity),
              }
            : stop
        ),
      },
    })),
}));

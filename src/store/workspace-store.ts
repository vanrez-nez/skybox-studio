import { create } from "zustand";

export type WorkspaceView = "editor" | "preview";
export type MenuId = "file" | "edit";
export type MenuCommandId = "file.export" | "file.load";
export type MenuEventId = MenuId | MenuCommandId;
export type GradientMode = "linear" | "radial";
export type FieldGradientMode = "inverse-distance" | "gaussian";

export type GradientStop = {
  color: string;
  id: string;
  location: number;
  opacity: number;
};

export type DirectionTuple = [number, number, number];

export type GradientState = {
  center: DirectionTuple;
  maxAngle: number;
  mode: GradientMode;
  rotation: number;
  selectedStopId: string;
  stops: GradientStop[];
};

export type FieldGradientAnchor = {
  color: string;
  id: string;
  x: number;
  y: number;
};

export type FieldGradientState = {
  amplitude: number;
  anchors: FieldGradientAnchor[];
  frequency: number;
  mode: FieldGradientMode;
  power: number;
  selectedAnchorId: string;
};

type MenuEvent = {
  id: MenuEventId;
  issuedAt: number;
};

type WorkspaceStore = {
  activeView: WorkspaceView;
  fieldGradient: FieldGradientState;
  gradient: GradientState;
  lastMenuEvent: MenuEvent | null;
  addFieldGradientAnchor: (anchor: Omit<FieldGradientAnchor, "id">) => void;
  addGradientStop: (stop: Omit<GradientStop, "id">) => void;
  emitMenuEvent: (id: MenuEventId) => void;
  randomizeFieldGradient: () => void;
  removeFieldGradientAnchor: (id: string) => void;
  removeGradientStop: (id: string) => void;
  resetFieldGradient: () => void;
  selectFieldGradientAnchor: (id: string) => void;
  selectGradientStop: (id: string) => void;
  setActiveView: (view: WorkspaceView) => void;
  setFieldGradientAmplitude: (amplitude: number) => void;
  setFieldGradientFrequency: (frequency: number) => void;
  setFieldGradientMode: (mode: FieldGradientMode) => void;
  setFieldGradientPower: (power: number) => void;
  setGradientCenter: (center: DirectionTuple) => void;
  setGradientMaxAngle: (maxAngle: number) => void;
  setGradientMode: (mode: GradientMode) => void;
  setGradientRotation: (rotation: number) => void;
  updateFieldGradientAnchor: (id: string, update: Partial<Omit<FieldGradientAnchor, "id">>) => void;
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

const defaultFieldGradientAnchors: FieldGradientAnchor[] = [
  { id: "cyan", color: "#35c4e0", x: 0.12, y: 0.2 },
  { id: "blue", color: "#2f80d1", x: 0.07, y: 0.52 },
  { id: "yellow", color: "#f5cc42", x: 0.6, y: 0.44 },
  { id: "orange", color: "#f08a28", x: 0.88, y: 0.78 },
];
const FIELD_GRADIENT_MAX_ANCHORS = 8;

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

function clampRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeDirection(direction: DirectionTuple): DirectionTuple {
  const length = Math.hypot(direction[0], direction[1], direction[2]);

  if (length <= 0) {
    return [0, 1, 0];
  }

  return [direction[0] / length, direction[1] / length, direction[2] / length];
}

function randomHexColor() {
  return `#${Array.from({ length: 3 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0")
  ).join("")}`;
}

function createRandomFieldAnchors(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    color: randomHexColor(),
    id: `field-${Date.now()}-${index}`,
    x: Math.random(),
    y: 0.12 + Math.random() * 0.76,
  }));
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  activeView: "editor",
  fieldGradient: {
    amplitude: 0.12,
    anchors: defaultFieldGradientAnchors,
    frequency: 1.2,
    mode: "inverse-distance",
    power: 2.2,
    selectedAnchorId: "yellow",
  },
  gradient: {
    center: [0, 1, 0],
    maxAngle: Math.PI / 2,
    mode: "radial",
    rotation: 0,
    selectedStopId: "middle",
    stops: defaultGradientStops,
  },
  lastMenuEvent: null,
  addFieldGradientAnchor: (anchor) =>
    set((state) => {
      if (state.fieldGradient.anchors.length >= FIELD_GRADIENT_MAX_ANCHORS) {
        return state;
      }

      const nextAnchor = {
        ...anchor,
        id: `field-${Date.now()}`,
        x: clampUnit(anchor.x),
        y: clampUnit(anchor.y),
      };

      return {
        fieldGradient: {
          ...state.fieldGradient,
          anchors: [...state.fieldGradient.anchors, nextAnchor],
          selectedAnchorId: nextAnchor.id,
        },
      };
    }),
  addGradientStop: (stop) =>
    set((state) => {
      const nextStop = {
        ...stop,
        id: `stop-${Date.now()}`,
        location: clampPercent(stop.location),
        opacity: clampPercent(stop.opacity),
      };

      return {
        gradient: {
          ...state.gradient,
          selectedStopId: nextStop.id,
          stops: [...state.gradient.stops, nextStop],
        },
      };
    }),
  emitMenuEvent: (id) => set({ lastMenuEvent: { id, issuedAt: Date.now() } }),
  randomizeFieldGradient: () =>
    set((state) => {
      const nextAnchors = createRandomFieldAnchors(state.fieldGradient.anchors.length);

      return {
        fieldGradient: {
          ...state.fieldGradient,
          anchors: nextAnchors,
          selectedAnchorId: nextAnchors[0].id,
        },
      };
    }),
  removeFieldGradientAnchor: (id) =>
    set((state) => {
      if (state.fieldGradient.anchors.length <= 1) {
        return state;
      }

      const nextAnchors = state.fieldGradient.anchors.filter((anchor) => anchor.id !== id);

      return {
        fieldGradient: {
          ...state.fieldGradient,
          anchors: nextAnchors,
          selectedAnchorId:
            state.fieldGradient.selectedAnchorId === id
              ? nextAnchors[0].id
              : state.fieldGradient.selectedAnchorId,
        },
      };
    }),
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
  resetFieldGradient: () =>
    set((state) => ({
      fieldGradient: {
        ...state.fieldGradient,
        amplitude: 0.12,
        anchors: defaultFieldGradientAnchors,
        frequency: 1.2,
        mode: "inverse-distance",
        power: 2.2,
        selectedAnchorId: "yellow",
      },
    })),
  selectFieldGradientAnchor: (id) =>
    set((state) => ({
      fieldGradient: {
        ...state.fieldGradient,
        selectedAnchorId: id,
      },
    })),
  selectGradientStop: (id) =>
    set((state) => ({
      gradient: {
        ...state.gradient,
        selectedStopId: id,
      },
    })),
  setActiveView: (view) => set({ activeView: view }),
  setFieldGradientAmplitude: (amplitude) =>
    set((state) => ({
      fieldGradient: {
        ...state.fieldGradient,
        amplitude: clampRange(amplitude, 0, 0.6),
      },
    })),
  setFieldGradientFrequency: (frequency) =>
    set((state) => ({
      fieldGradient: {
        ...state.fieldGradient,
        frequency: clampRange(frequency, 0.3, 4),
      },
    })),
  setFieldGradientMode: (mode) =>
    set((state) => ({
      fieldGradient: {
        ...state.fieldGradient,
        mode,
      },
    })),
  setFieldGradientPower: (power) =>
    set((state) => ({
      fieldGradient: {
        ...state.fieldGradient,
        power: clampRange(power, 0.4, 6),
      },
    })),
  setGradientCenter: (center) =>
    set((state) => ({
      gradient: {
        ...state.gradient,
        center: normalizeDirection(center),
      },
    })),
  setGradientMaxAngle: (maxAngle) =>
    set((state) => ({
      gradient: {
        ...state.gradient,
        maxAngle: clampRange(maxAngle, 0.1, Math.PI),
      },
    })),
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
  updateFieldGradientAnchor: (id, update) =>
    set((state) => ({
      fieldGradient: {
        ...state.fieldGradient,
        anchors: state.fieldGradient.anchors.map((anchor) =>
          anchor.id === id
            ? {
                ...anchor,
                ...update,
                x: update.x === undefined ? anchor.x : clampUnit(update.x),
                y: update.y === undefined ? anchor.y : clampUnit(update.y),
              }
            : anchor
        ),
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

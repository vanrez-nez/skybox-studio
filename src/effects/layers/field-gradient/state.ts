export type FieldGradientMode = "inverse-distance" | "gaussian";

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

const defaultFieldGradientAnchors: FieldGradientAnchor[] = [
  { id: "red", color: "#ff0000", x: 0.5, y: 0.5 },
];

export const FIELD_GRADIENT_MAX_ANCHORS = 8;

function randomHexColor() {
  return `#${Array.from({ length: 3 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0")
  ).join("")}`;
}

export function createRandomFieldAnchors(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    color: randomHexColor(),
    id: `field-${Date.now()}-${index}`,
    x: Math.random(),
    y: 0.12 + Math.random() * 0.76,
  }));
}

export function createDefaultFieldGradientState(): FieldGradientState {
  return {
    amplitude: 0.12,
    anchors: defaultFieldGradientAnchors.map((anchor) => ({ ...anchor })),
    frequency: 1.2,
    mode: "inverse-distance",
    power: 2.2,
    selectedAnchorId: "red",
  };
}

export function cloneFieldGradientState(fieldGradient: FieldGradientState): FieldGradientState {
  return {
    ...fieldGradient,
    anchors: fieldGradient.anchors.map((anchor) => ({ ...anchor })),
  };
}

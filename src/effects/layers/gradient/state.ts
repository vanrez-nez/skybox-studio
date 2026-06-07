import type { GradientStop } from "@/effects/layers/primitives";

export type GradientMode = "linear";

export type GradientState = {
  mode: GradientMode;
  rotation: number;
  selectedStopId: string;
  stops: GradientStop[];
};

const defaultGradientStops: GradientStop[] = [
  { id: "start", color: "#00ff00", location: 0, midpoint: 50, opacity: 100 },
  { id: "end", color: "#00ff00", location: 100, midpoint: 50, opacity: 100 },
];

export function createDefaultGradientState(): GradientState {
  return {
    mode: "linear",
    rotation: 0,
    selectedStopId: "start",
    stops: defaultGradientStops.map((stop) => ({ ...stop })),
  };
}

export function cloneGradientState(gradient: GradientState): GradientState {
  return {
    ...gradient,
    stops: gradient.stops.map((stop) => ({
      ...stop,
      midpoint: stop.midpoint ?? 50,
    })),
  };
}

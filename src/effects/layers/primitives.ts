// Shared primitives for self-contained effect layers. Layer addons and panels
// depend on these rather than reaching into the store, so a layer folder stays
// decoupled from store internals.

export type GradientStop = {
  color: string;
  id: string;
  location: number;
  midpoint: number;
  opacity: number;
};

export function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function clampMidpoint(value: number) {
  return Math.min(99, Math.max(1, value));
}

export function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function clampRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

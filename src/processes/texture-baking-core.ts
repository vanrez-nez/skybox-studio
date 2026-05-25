import type { GradientState, GradientStop } from "@/store/workspace-store";

export const DEFAULT_BAKE_WIDTH = 1024;

const TWO_PI = Math.PI * 2;

type Rgb = [number, number, number];

type LinearStop = {
  color: Rgb;
  opacity: number;
  t: number;
};

type BakeOptions = {
  width?: number;
};

export type BakedGradientImage = {
  data: Uint8ClampedArray<ArrayBuffer>;
  height: number;
  width: number;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function srgbChannelToLinear(channel: number) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearChannelToSrgb(channel: number) {
  const clampedChannel = clamp(channel);

  return clampedChannel <= 0.0031308
    ? clampedChannel * 12.92
    : 1.055 * clampedChannel ** (1 / 2.4) - 0.055;
}

function parseHexColor(color: string): Rgb {
  const hexColor = color.trim().replace(/^#/, "");
  const normalizedColor =
    hexColor.length === 3
      ? hexColor
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : hexColor;

  if (!/^[0-9a-fA-F]{6}$/.test(normalizedColor)) {
    return [1, 1, 1];
  }

  return [0, 2, 4].map((offset) =>
    srgbChannelToLinear(Number.parseInt(normalizedColor.slice(offset, offset + 2), 16) / 255)
  ) as Rgb;
}

function prepareStops(stops: GradientStop[]): LinearStop[] {
  return stops
    .map((stop) => ({
      color: parseHexColor(stop.color),
      opacity: clamp(stop.opacity / 100),
      t: clamp(stop.location / 100),
    }))
    .sort((firstStop, secondStop) => firstStop.t - secondStop.t);
}

function mix(firstValue: number, secondValue: number, amount: number) {
  return firstValue + (secondValue - firstValue) * amount;
}

function applyOpacity(color: Rgb, opacity: number): Rgb {
  return [color[0] * opacity, color[1] * opacity, color[2] * opacity];
}

function sampleGradient(stops: LinearStop[], t: number): Rgb {
  if (stops.length === 0) {
    return [0, 0, 0];
  }

  const clampedT = clamp(t);
  const firstStop = stops[0];
  const lastStop = stops[stops.length - 1];

  if (clampedT <= firstStop.t) {
    return applyOpacity(firstStop.color, firstStop.opacity);
  }

  if (clampedT >= lastStop.t) {
    return applyOpacity(lastStop.color, lastStop.opacity);
  }

  for (let stopIndex = 0; stopIndex < stops.length - 1; stopIndex += 1) {
    const currentStop = stops[stopIndex];
    const nextStop = stops[stopIndex + 1];

    if (clampedT < currentStop.t || clampedT > nextStop.t) {
      continue;
    }

    const span = nextStop.t - currentStop.t;
    const localT = span <= 0 ? 0 : (clampedT - currentStop.t) / span;
    const opacity = mix(currentStop.opacity, nextStop.opacity, localT);

    return applyOpacity(
      [
        mix(currentStop.color[0], nextStop.color[0], localT),
        mix(currentStop.color[1], nextStop.color[1], localT),
        mix(currentStop.color[2], nextStop.color[2], localT),
      ],
      opacity
    );
  }

  return applyOpacity(lastStop.color, lastStop.opacity);
}

function getLinearGradientAxis(rotation: number): Rgb {
  const radians = (rotation * Math.PI) / 180;

  return [Math.sin(radians), Math.cos(radians), 0];
}

function getDirectionParameter(direction: Rgb, gradient: GradientState) {
  const axis = getLinearGradientAxis(gradient.rotation);
  const dot = direction[0] * axis[0] + direction[1] * axis[1] + direction[2] * axis[2];

  return dot * 0.5 + 0.5;
}

export function bakeDirectionSpaceGradientData(
  gradient: GradientState,
  options: BakeOptions = {}
): BakedGradientImage {
  const width = options.width ?? DEFAULT_BAKE_WIDTH;
  const height = Math.max(1, Math.floor(width / 2));
  const stops = prepareStops(gradient.stops);
  const linearBuffer = new Float32Array(width * height * 3);
  const data = new Uint8ClampedArray(width * height * 4) as Uint8ClampedArray<ArrayBuffer>;

  for (let y = 0; y < height; y += 1) {
    const uvY = (y + 0.5) / height;
    const phi = (uvY - 0.5) * Math.PI;
    const cosPhi = Math.cos(phi);

    for (let x = 0; x < width; x += 1) {
      const uvX = (x + 0.5) / width;
      const lambda = (uvX - 0.5) * TWO_PI;
      const direction: Rgb = [
        cosPhi * Math.cos(lambda),
        Math.sin(phi),
        cosPhi * Math.sin(lambda),
      ];
      const t = getDirectionParameter(direction, gradient);
      const linearColor = sampleGradient(stops, t);
      const pixelIndex = y * width + x;
      const bufferIndex = pixelIndex * 3;

      linearBuffer[bufferIndex] = linearColor[0];
      linearBuffer[bufferIndex + 1] = linearColor[1];
      linearBuffer[bufferIndex + 2] = linearColor[2];
    }
  }

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const bufferIndex = pixelIndex * 3;
    const imageIndex = pixelIndex * 4;

    data[imageIndex] = Math.round(linearChannelToSrgb(linearBuffer[bufferIndex]) * 255);
    data[imageIndex + 1] = Math.round(linearChannelToSrgb(linearBuffer[bufferIndex + 1]) * 255);
    data[imageIndex + 2] = Math.round(linearChannelToSrgb(linearBuffer[bufferIndex + 2]) * 255);
    data[imageIndex + 3] = 255;
  }

  return { data, height, width };
}

export function drawBakedGradientToCanvas(
  canvas: HTMLCanvasElement,
  bakedImage: BakedGradientImage
) {
  const context = canvas.getContext("2d");

  canvas.width = bakedImage.width;
  canvas.height = bakedImage.height;

  if (!context) {
    return;
  }

  context.putImageData(
    new ImageData(bakedImage.data, bakedImage.width, bakedImage.height),
    0,
    0
  );
}

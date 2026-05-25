import type { GradientState } from "@/store/modules/layers";
import type {
  SkyboxFieldGradientParams,
  SkyboxGradientParams,
  SkyboxGradientStop,
  SkyboxManifestLayer,
  SkyboxManifestV1,
} from "@/runtime";

export const DEFAULT_BAKE_WIDTH = 1024;

const TWO_PI = Math.PI * 2;

type Rgb = [number, number, number];

type LinearStop = {
  alpha: number;
  color: Rgb;
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

function prepareStops(stops: SkyboxGradientStop[]): LinearStop[] {
  return stops
    .map((stop) => ({
      alpha: clamp(stop.opacity / 100),
      color: parseHexColor(stop.color),
      t: clamp(stop.location / 100),
    }))
    .sort((firstStop, secondStop) => firstStop.t - secondStop.t);
}

function mix(firstValue: number, secondValue: number, amount: number) {
  return firstValue + (secondValue - firstValue) * amount;
}

function sampleGradient(stops: LinearStop[], t: number): { alpha: number; color: Rgb } {
  if (stops.length === 0) {
    return { alpha: 0, color: [0, 0, 0] };
  }

  const clampedT = clamp(t);
  const firstStop = stops[0];
  const lastStop = stops[stops.length - 1];

  if (clampedT <= firstStop.t) {
    return { alpha: firstStop.alpha, color: firstStop.color };
  }

  if (clampedT >= lastStop.t) {
    return { alpha: lastStop.alpha, color: lastStop.color };
  }

  for (let stopIndex = 0; stopIndex < stops.length - 1; stopIndex += 1) {
    const currentStop = stops[stopIndex];
    const nextStop = stops[stopIndex + 1];

    if (clampedT < currentStop.t || clampedT > nextStop.t) {
      continue;
    }

    const span = nextStop.t - currentStop.t;
    const localT = span <= 0 ? 0 : (clampedT - currentStop.t) / span;
    const alpha = mix(currentStop.alpha, nextStop.alpha, localT);

    return {
      alpha,
      color: [
        mix(currentStop.color[0], nextStop.color[0], localT),
        mix(currentStop.color[1], nextStop.color[1], localT),
        mix(currentStop.color[2], nextStop.color[2], localT),
      ],
    };
  }

  return { alpha: lastStop.alpha, color: lastStop.color };
}

function getLinearGradientAxis(rotation: number): Rgb {
  const radians = (rotation * Math.PI) / 180;

  return [Math.sin(radians), Math.cos(radians), 0];
}

function getDirectionParameter(direction: Rgb, gradient: Pick<GradientState, "rotation">) {
  const axis = getLinearGradientAxis(gradient.rotation);
  const dot = direction[0] * axis[0] + direction[1] * axis[1] + direction[2] * axis[2];

  return dot * 0.5 + 0.5;
}

function sampleGradientLayer(direction: Rgb, params: SkyboxGradientParams) {
  const t = getDirectionParameter(direction, params);

  return sampleGradient(prepareStops(params.stops), t);
}

function equirectPointToDirection(x: number, y: number): Rgb {
  const lambda = (x - 0.5) * TWO_PI;
  const phi = (0.5 - y) * Math.PI;
  const cosPhi = Math.cos(phi);

  return [cosPhi * Math.cos(lambda), Math.sin(phi), cosPhi * Math.sin(lambda)];
}

function normalizeDirection(direction: Rgb): Rgb {
  const length = Math.hypot(direction[0], direction[1], direction[2]);

  if (length <= 0) {
    return [0, 1, 0];
  }

  return [direction[0] / length, direction[1] / length, direction[2] / length];
}

function warpDirection(direction: Rgb, amplitude: number, frequency: number): Rgb {
  if (amplitude <= 0) {
    return direction;
  }

  const safeFrequency = Math.max(0.0001, frequency);
  const offset: Rgb = [
    Math.sin((direction[1] * safeFrequency + 0.23) * TWO_PI) *
      Math.cos((direction[2] * safeFrequency + 0.41) * TWO_PI),
    Math.cos((direction[2] * safeFrequency + 0.17) * TWO_PI) *
      Math.sin((direction[0] * safeFrequency + 0.37) * TWO_PI),
    Math.sin((direction[0] * safeFrequency - 0.31) * TWO_PI) *
      Math.cos((direction[1] * safeFrequency + 0.29) * TWO_PI),
  ];

  return normalizeDirection([
    direction[0] + offset[0] * amplitude,
    direction[1] + offset[1] * amplitude,
    direction[2] + offset[2] * amplitude,
  ]);
}

function angularFieldDistance(firstDirection: Rgb, secondDirection: Rgb) {
  const dot =
    firstDirection[0] * secondDirection[0] +
    firstDirection[1] * secondDirection[1] +
    firstDirection[2] * secondDirection[2];

  return 1 - clamp(dot, -1, 1);
}

function sampleFieldGradientLayer(direction: Rgb, params: SkyboxFieldGradientParams) {
  if (params.anchors.length === 0) {
    return { alpha: 0, color: [0, 0, 0] as Rgb };
  }

  const fieldDirection = warpDirection(
    direction,
    clamp(params.amplitude, 0, 0.6),
    Math.max(0.0001, params.frequency)
  );
  let red = 0;
  let green = 0;
  let blue = 0;
  let weightSum = 0;

  params.anchors.forEach((anchor) => {
    const distance = angularFieldDistance(
      fieldDirection,
      equirectPointToDirection(anchor.x, anchor.y)
    );
    const weight =
      params.mode === "gaussian"
        ? Math.exp(-(distance * distance) / (2 * (0.46 / params.power) ** 2))
        : 1 / (distance + 0.0005) ** params.power;
    const color = parseHexColor(anchor.color);

    red += color[0] * weight;
    green += color[1] * weight;
    blue += color[2] * weight;
    weightSum += weight;
  });

  if (weightSum <= 0) {
    return { alpha: 0, color: [0, 0, 0] as Rgb };
  }

  return {
    alpha: 1,
    color: [red / weightSum, green / weightSum, blue / weightSum] as Rgb,
  };
}

function sampleLayer(direction: Rgb, layer: SkyboxManifestLayer) {
  return layer.type === "gradient"
    ? sampleGradientLayer(direction, layer.params)
    : sampleFieldGradientLayer(direction, layer.params);
}

function blendLayerChannel(destination: number, source: number, alpha: number, layer: SkyboxManifestLayer) {
  let blended = source;

  if (layer.blendMode === "additive") {
    blended = destination + source;
  }

  if (layer.blendMode === "subtractive") {
    blended = destination - source;
  }

  if (layer.blendMode === "multiply") {
    blended = destination * source;
  }

  return blended * alpha + destination * (1 - alpha);
}

function getRenderableLayers(manifest: SkyboxManifestV1) {
  return manifest.layers.filter((layer) => layer.enabled).reverse();
}

export function bakeSkyboxManifestData(
  manifest: SkyboxManifestV1,
  options: BakeOptions = {}
): BakedGradientImage {
  const width = options.width ?? DEFAULT_BAKE_WIDTH;
  const height = Math.max(1, Math.floor(width / 2));
  const layers = getRenderableLayers(manifest);
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
      const linearColor: Rgb = [0, 0, 0];

      layers.forEach((layer) => {
        const sample = sampleLayer(direction, layer);
        const alpha = clamp(sample.alpha * (layer.opacity / 100));

        linearColor[0] = blendLayerChannel(linearColor[0], sample.color[0], alpha, layer);
        linearColor[1] = blendLayerChannel(linearColor[1], sample.color[1], alpha, layer);
        linearColor[2] = blendLayerChannel(linearColor[2], sample.color[2], alpha, layer);
      });

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

export function bakeDirectionSpaceGradientData(
  gradient: GradientState,
  options: BakeOptions = {}
): BakedGradientImage {
  return bakeSkyboxManifestData(
    {
      composition: { mode: "alpha-over", order: "bottom-to-top" },
      layers: [
        {
          blendMode: "normal",
          enabled: true,
          id: "gradient",
          name: "Gradient",
          opacity: 100,
          params: gradient,
          type: "gradient",
        },
      ],
      version: 1,
    },
    options
  );
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

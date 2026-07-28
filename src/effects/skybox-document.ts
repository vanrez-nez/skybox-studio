import {
  loadEffectLayer,
  serializeEffectLayer,
  stripEffectLayerRuntimeData,
  type EffectLayer,
  type SerializedEffectLayer,
} from "@/effects/effect-layer";
import type { SkyGeometryType } from "@/store/modules/scene";

// The editable document — the layer stack plus the sky geometry it's authored against.
//
// Deliberately NOT the runtime manifest (SkyboxManifestV2): the manifest is the export format and is
// lossy for editing (toManifestParams drops `locked` and editor-only param state). Documents round-trip
// through the addon serialize/load pair instead, which is exactly what the editor needs back.
//
// Image pixels never land here — layers are stripped via the addon `stripRuntimeParams` hook, so a
// document only carries the `assetId`, and the blob is rehydrated from IndexedDB on load.
export const SKYBOX_DOCUMENT_VERSION = 1;

export type SkyboxDocumentMetadata = {
  title?: string;
};

export type SkyboxDocument = {
  geometry: SkyGeometryType;
  layers: SerializedEffectLayer[];
  metadata?: SkyboxDocumentMetadata;
  version: number;
};

export function createSkyboxDocument(
  effectLayers: EffectLayer[],
  geometry: SkyGeometryType,
  title?: string
): SkyboxDocument {
  return {
    geometry,
    layers: stripEffectLayerRuntimeData(effectLayers).map(serializeEffectLayer),
    ...(title ? { metadata: { title } } : {}),
    version: SKYBOX_DOCUMENT_VERSION,
  };
}

export function cloneSkyboxDocument(document: SkyboxDocument): SkyboxDocument {
  return structuredClone(document);
}

// Rebuild editor layers from a document. Callers are responsible for migrating first.
export function readSkyboxDocumentLayers(document: SkyboxDocument): EffectLayer[] {
  return document.layers.map(loadEffectLayer);
}

// Sequential, idempotent upgrade steps gated on the stored version — same shape as the runtime's
// migrateManifestToV2. v1 is the initial format so there is nothing to do yet; the seam exists so the
// first real schema change has somewhere to live before documents are in the wild.
export function migrateSkyboxDocument(document: SkyboxDocument): SkyboxDocument {
  const next = cloneSkyboxDocument(document);

  // if ((document.version ?? 0) < 2) migrateToV2(next);

  next.version = SKYBOX_DOCUMENT_VERSION;

  return next;
}

function isSerializedEffectLayer(value: unknown): value is SerializedEffectLayer {
  if (!value || typeof value !== "object") {
    return false;
  }

  const layer = value as Partial<SerializedEffectLayer>;
  const effect = layer.effect as { type?: unknown; params?: unknown } | undefined;

  return (
    typeof layer.id === "string" &&
    typeof layer.name === "string" &&
    typeof layer.enabled === "boolean" &&
    typeof effect?.type === "string" &&
    Boolean(effect.params) &&
    typeof effect.params === "object"
  );
}

// Shape check for untrusted input (a file the user picked). Documents from a FUTURE version are
// rejected rather than migrated — we can't know what changed.
export function isSkyboxDocument(value: unknown): value is SkyboxDocument {
  if (!value || typeof value !== "object") {
    return false;
  }

  const document = value as Partial<SkyboxDocument>;

  if (typeof document.version !== "number" || document.version > SKYBOX_DOCUMENT_VERSION) {
    return false;
  }

  if (document.geometry !== "box" && document.geometry !== "sphere") {
    return false;
  }

  return Array.isArray(document.layers) && document.layers.every(isSerializedEffectLayer);
}

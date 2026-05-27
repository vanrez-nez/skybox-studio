import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three/webgpu";

import { useWorkspaceStore } from "@/store/app";
import { getImageAsset } from "@/lib/image-assets";
import type {
  CameraRotationMode,
  SceneRenderMode,
  WorkspaceView,
} from "@/store/modules/scene";
import { RotationGizmo } from "@/components/workspace/RotationGizmo";
import { createSkyboxManifest } from "@/effects/skybox-manifest";
import { getEffectLayerFocusTarget, type EffectLayer } from "@/effects/effect-layer";
import {
  createAngularDecalPlacement,
  createSkyboxWireGeometry,
  type ImageProjectionUv,
  normalizeVector,
  projectDirectionToImageUv,
  Skybox,
  type SkyboxManifest,
  spotContainsDirection,
} from "@/runtime/index";
import { SkyboxOrbitControls } from "@/components/workspace/SkyboxOrbitControls";
import {
  IMAGE_PLACEMENT_TRANSACTION_SCOPE,
  type ImagePlacement,
} from "@/store/modules/layers";

type ThreeWorkspaceSceneProps = {
  mode: WorkspaceView;
};

type QuaternionTuple = [number, number, number, number];
type VectorTuple = [number, number, number];
type SceneLayerHit = {
  layerId: string;
  type: EffectLayer["type"];
  uv?: ImageProjectionUv;
};

const INITIAL_CAMERA_ROTATION = new THREE.Euler(0.08, -0.35, 0, "YXZ");
const AXIS_ANIMATION_DURATION_MS = 320;
const AXIS_TOGGLE_DOT_THRESHOLD = 0.985;

function quaternionToTuple(quaternion: THREE.Quaternion): QuaternionTuple {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}

function easeOutCubic(progress: number) {
  return 1 - (1 - progress) ** 3;
}

function vectorToTuple(vector: THREE.Vector3): VectorTuple {
  return [vector.x, vector.y, vector.z];
}

function tupleToVector(tuple: VectorTuple) {
  return new THREE.Vector3(...tuple);
}

function createImagePlacement(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
  image: { height: number; width: number },
  direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
): ImagePlacement | null {
  const centerDirection = direction.clone().normalize();

  if (centerDirection.lengthSq() <= 0 || image.width <= 0 || image.height <= 0) {
    return null;
  }

  const radiansPerPixel = THREE.MathUtils.degToRad(camera.fov) / Math.max(1, canvas.height);
  const angularHeight = Math.max(0.001, image.height * radiansPerPixel);
  const angularWidth = Math.max(0.001, angularHeight * (image.width / image.height));

  return createAngularDecalPlacement({
    angularHeight,
    angularWidth,
    centerDirection: vectorToTuple(centerDirection),
  });
}

function getPlacementDirectionFallback(placement: unknown) {
  const rawPlacement = placement as {
    center?: [number, number, number];
    centerDirection?: [number, number, number];
    normal?: [number, number, number];
  } | null;
  const tuple = rawPlacement?.centerDirection ?? rawPlacement?.normal ?? rawPlacement?.center;

  return tuple ? tupleToVector(tuple).normalize() : undefined;
}

function createSkyboxManifestDependencyKey(
  layers: EffectLayer[],
  previewBlendMode: ReturnType<typeof useWorkspaceStore.getState>["previewEffectLayerBlendMode"],
  geometryType: string
) {
  return JSON.stringify({
    geometryType,
    layers: layers.map((layer) => {
      const blendMode =
        previewBlendMode?.layerId === layer.id ? previewBlendMode.blendMode : layer.blendMode;

      if (layer.type === "image") {
        return {
          blendMode,
          enabled: layer.enabled,
          hasSrc: Boolean(layer.params.src),
          height: layer.params.height,
          id: layer.id,
          name: layer.name,
          opacity: layer.opacity,
          type: layer.type,
          width: layer.params.width,
        };
      }

      return {
        blendMode,
        enabled: layer.enabled,
        id: layer.id,
        name: layer.name,
        opacity: layer.opacity,
        params: layer.params,
        type: layer.type,
      };
    }),
  });
}

function createImagePlacementKey(placement: ImagePlacement | null) {
  return placement ? JSON.stringify(placement) : "null";
}

function getProjectedOffset(
  direction: VectorTuple,
  centerDirection: VectorTuple,
  angularRadius: number
) {
  const frame = createAngularDecalPlacement({
    angularHeight: angularRadius * 2,
    angularWidth: angularRadius * 2,
    centerDirection,
  });
  const projectedDirection = normalizeVector(direction);
  const denom = Math.max(
    0.000001,
    projectedDirection[0] * frame.centerDirection[0] +
      projectedDirection[1] * frame.centerDirection[1] +
      projectedDirection[2] * frame.centerDirection[2]
  );

  return {
    x:
      (projectedDirection[0] * frame.tangentX[0] +
        projectedDirection[1] * frame.tangentX[1] +
        projectedDirection[2] * frame.tangentX[2]) /
      denom,
    y:
      (projectedDirection[0] * frame.tangentY[0] +
        projectedDirection[1] * frame.tangentY[1] +
        projectedDirection[2] * frame.tangentY[2]) /
      denom,
  };
}

function getDraggedCenterDirection(
  pointerDirection: VectorTuple,
  angularRadius: number,
  offsetX: number,
  offsetY: number
) {
  const frame = createAngularDecalPlacement({
    angularHeight: angularRadius * 2,
    angularWidth: angularRadius * 2,
    centerDirection: pointerDirection,
  });

  return normalizeVector([
    pointerDirection[0] - frame.tangentX[0] * offsetX - frame.tangentY[0] * offsetY,
    pointerDirection[1] - frame.tangentX[1] * offsetX - frame.tangentY[1] * offsetY,
    pointerDirection[2] - frame.tangentX[2] * offsetX - frame.tangentY[2] * offsetY,
  ]);
}

const SPOT_PLACEMENT_TRANSACTION_SCOPE = "spot-placement";

export function ThreeWorkspaceScene({ mode }: ThreeWorkspaceSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderRef = useRef<(() => void) | null>(null);
  const syncImagePlacementsRef = useRef<(() => void) | null>(null);
  const syncImageLayerPlacementsRef = useRef<((layers: EffectLayer[]) => void) | null>(null);
  const syncImageTexturesRef = useRef<((layers: EffectLayer[]) => void) | null>(null);
  const syncEditorImageStateRef = useRef<
    ((layers: EffectLayer[], selectedLayerId: string) => void) | null
  >(null);
  const setCameraRotationModeRef = useRef<((mode: CameraRotationMode) => void) | null>(null);
  const setGroundPlaneHelperVisibleRef = useRef<((visible: boolean) => void) | null>(null);
  const setSkyGeometryVisibleRef = useRef<((visible: boolean) => void) | null>(null);
  const updateSkyboxRef = useRef<
    ((nextManifest: SkyboxManifest, nextRenderMode: SceneRenderMode) => void) | null
  >(null);
  const lookAtAxisDirectionRef = useRef<((direction: VectorTuple) => void) | null>(null);
  const focusLayerRef = useRef<((layerId: string) => void) | null>(null);
  const resetOrientationRef = useRef<(() => void) | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [gizmoOrientation, setGizmoOrientation] = useState<QuaternionTuple>(() =>
    quaternionToTuple(new THREE.Quaternion().setFromEuler(INITIAL_CAMERA_ROTATION))
  );
  const effectLayers = useWorkspaceStore((state) => state.effectLayers);
  const effectLayersRef = useRef(effectLayers);
  const selectedLayerIdRef = useRef("");
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const cameraRotationMode = useWorkspaceStore((state) => state.cameraRotationMode);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);
  const selectEffectLayer = useWorkspaceStore((state) => state.selectEffectLayer);
  const selectedLayerId = useWorkspaceStore((state) => state.selectedLayerId);
  const setImageAssetSource = useWorkspaceStore((state) => state.setImageAssetSource);
  const setImagePlacement = useWorkspaceStore((state) => state.setImagePlacement);
  const setSpotPosition = useWorkspaceStore((state) => state.setSpotPosition);
  const toggleEffectLayerEnabled = useWorkspaceStore((state) => state.toggleEffectLayerEnabled);
  const lastLayerFocusRequest = useWorkspaceStore((state) => state.lastLayerFocusRequest);
  const previewEffectLayerBlendMode = useWorkspaceStore(
    (state) => state.previewEffectLayerBlendMode
  );
  const sceneRenderMode = useWorkspaceStore((state) => state.sceneRenderMode);
  const skyGeometryType = useWorkspaceStore((state) => state.skyGeometryType);
  const showGroundPlaneHelper = useWorkspaceStore((state) => state.showGroundPlaneHelper);
  const showOrientationGizmo = useWorkspaceStore((state) => state.showOrientationGizmo);
  const showSkyGeometry = useWorkspaceStore((state) => state.showSkyGeometry);
  const skyboxManifestDependencyKey = useMemo(
    () =>
      createSkyboxManifestDependencyKey(
        effectLayers,
        previewEffectLayerBlendMode,
        skyGeometryType
      ),
    [effectLayers, previewEffectLayerBlendMode, skyGeometryType]
  );
  const skyboxManifest = useMemo(
    () =>
      createSkyboxManifest(
        effectLayers,
        previewEffectLayerBlendMode,
        { type: skyGeometryType }
      ),
    [skyboxManifestDependencyKey]
  );

  useEffect(() => {
    effectLayersRef.current = effectLayers;
    selectedLayerIdRef.current = selectedLayerId;
    syncImagePlacementsRef.current?.();
    syncImageLayerPlacementsRef.current?.(effectLayers);
    syncImageTexturesRef.current?.(effectLayers);
    syncEditorImageStateRef.current?.(effectLayers, selectedLayerId);
  }, [effectLayers, selectedLayerId]);

  const handleGizmoAxisSelect = useCallback((direction: VectorTuple) => {
    lookAtAxisDirectionRef.current?.(direction);
  }, []);

  const handleGizmoReset = useCallback(() => {
    resetOrientationRef.current?.();
  }, []);

  useEffect(() => {
    renderRef.current?.();
  }, [mode]);

  useEffect(() => {
    setCameraRotationModeRef.current?.(cameraRotationMode);
  }, [cameraRotationMode]);

  useEffect(() => {
    if (!lastLayerFocusRequest) {
      return;
    }

    focusLayerRef.current?.(lastLayerFocusRequest.layerId);
  }, [lastLayerFocusRequest?.layerId, lastLayerFocusRequest?.issuedAt]);

  useEffect(() => {
    setSkyGeometryVisibleRef.current?.(showSkyGeometry);
  }, [showSkyGeometry]);

  useEffect(() => {
    setGroundPlaneHelperVisibleRef.current?.(showGroundPlaneHelper);
  }, [showGroundPlaneHelper]);

  useEffect(() => {
    if (!updateSkyboxRef.current) {
      return;
    }

    updateSkyboxRef.current(skyboxManifest, sceneRenderMode);
  }, [sceneRenderMode, skyboxManifest]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;

    if (!container || !canvas) {
      return;
    }

    const renderer = new THREE.WebGPURenderer({
      antialias: true,
      canvas,
    });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    let currentSkyGeometryType = skyboxManifest.version === 2
      ? skyboxManifest.geometry?.type ?? "box"
      : "box";
    let disposed = false;
    let rendererReady = false;
    const imageTextureRecords = new Map<
      string,
      { ready: boolean; src: string; texture: THREE.Texture }
    >();
    const imageAssetUrlRecords = new Map<string, { assetId: string; src: string }>();
    const pendingAssetLoads = new Set<string>();
    const imagePlacementKeys = new Map<string, string>();
    let pendingImagePlacementLayerId = "";
    let pendingImagePlacement: ImagePlacement | null = null;
    let pendingImagePlacementFrame: number | null = null;
    const liveSkybox = new Skybox()
      .setRenderer(renderer)
      .fromManifest(skyboxManifest)
      .setEditorPresentationEnabled(true)
      .load();
    const skyGeometry = new THREE.LineSegments(
      createSkyboxWireGeometry({ type: currentSkyGeometryType }),
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        depthTest: false,
        depthWrite: false,
        opacity: 0.55,
        toneMapped: false,
        transparent: true,
      })
    );
    const groundPlaneHelper = new THREE.GridHelper(1.8, 32, 0x22c55e, 0x22c55e);
    const groundPlaneHelperMaterials = Array.isArray(groundPlaneHelper.material)
      ? groundPlaneHelper.material
      : [groundPlaneHelper.material];
    const raycaster = new THREE.Raycaster();
    const imageDragState = {
      angularHeight: 0,
      angularWidth: 0,
      baseAngularHeight: 0,
      baseAngularWidth: 0,
      hasMoved: false,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      layerId: "",
      placement: null as ImagePlacement | null,
      pointerId: -1,
    };
    const spotDragState = {
      angularRadius: 0,
      hasMoved: false,
      layerId: "",
      offsetX: 0,
      offsetY: 0,
      pointerId: -1,
    };
    let hoveredImageLayerId: string | null = null;
    let selectedImageLayerId: string | null = null;
    const cameraRotation = INITIAL_CAMERA_ROTATION.clone();
    camera.position.set(0, 0, 0);
    camera.rotation.copy(cameraRotation);
    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    skyGeometry.renderOrder = 10;
    skyGeometry.visible = showSkyGeometry;
    groundPlaneHelper.position.set(0, -0.1, 0);
    groundPlaneHelper.renderOrder = 9;
    groundPlaneHelper.visible = showGroundPlaneHelper;
    groundPlaneHelperMaterials.forEach((material) => {
      material.depthTest = false;
      material.depthWrite = false;
      material.opacity = 0.45;
      material.toneMapped = false;
      material.transparent = true;
    });
    scene.add(skyGeometry);
    scene.add(groundPlaneHelper);

    const render = () => {
      if (!rendererReady || disposed) {
        return;
      }

      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, canvas.width, canvas.height);
      renderer.render(scene, camera);
    };

    renderRef.current = render;
    setSkyGeometryVisibleRef.current = (visible) => {
      skyGeometry.visible = visible;
      render();
    };
    setGroundPlaneHelperVisibleRef.current = (visible) => {
      groundPlaneHelper.visible = visible;
      render();
    };

    const getEditorImageLayerId = (layers: EffectLayer[], layerId: string) => {
      const layer = layers.find((effectLayer) => effectLayer.id === layerId);

      return layer?.type === "image" && layer.enabled ? layer.id : null;
    };

    const setEditorImageState = (nextState: {
      hoveredImageLayerId?: string | null;
      selectedImageLayerId?: string | null;
    }) => {
      const nextHoveredImageLayerId = Object.prototype.hasOwnProperty.call(nextState, "hoveredImageLayerId")
        ? nextState.hoveredImageLayerId ?? null
        : hoveredImageLayerId;
      const nextSelectedImageLayerId = Object.prototype.hasOwnProperty.call(nextState, "selectedImageLayerId")
        ? nextState.selectedImageLayerId ?? null
        : selectedImageLayerId;

      if (
        hoveredImageLayerId === nextHoveredImageLayerId &&
        selectedImageLayerId === nextSelectedImageLayerId
      ) {
        return;
      }

      hoveredImageLayerId = nextHoveredImageLayerId;
      selectedImageLayerId = nextSelectedImageLayerId;
      liveSkybox.setEditorImageState({
        hoveredImageLayerId,
        selectedImageLayerId,
      });
      render();
    };

    const setHoveredImageLayerId = (layerId: string | null) => {
      setEditorImageState({ hoveredImageLayerId: layerId });
    };

    const setSelectedImageLayerId = (layerId: string | null) => {
      setEditorImageState({ selectedImageLayerId: layerId });
    };

    syncEditorImageStateRef.current = (layers, nextSelectedLayerId) => {
      const nextHoveredImageLayerId = hoveredImageLayerId
        ? getEditorImageLayerId(layers, hoveredImageLayerId)
        : null;
      const nextSelectedImageLayerId = nextSelectedLayerId
        ? getEditorImageLayerId(layers, nextSelectedLayerId)
        : null;

      setEditorImageState({
        hoveredImageLayerId: nextHoveredImageLayerId,
        selectedImageLayerId: nextSelectedImageLayerId,
      });
    };
    syncEditorImageStateRef.current(effectLayersRef.current, selectedLayerId);

    const configureImageTexture = (texture: THREE.Texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.flipY = false;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
    };

    const pushImageTexturesToSkybox = () => {
      liveSkybox.setImageTextures(
        Object.fromEntries(
          Array.from(imageTextureRecords.entries())
            .filter(([, record]) => record.ready)
            .map(([layerId, record]) => [
              layerId,
              record.texture,
            ])
        )
      );
    };

    const syncImageTextures = (layers: EffectLayer[]) => {
      let changed = false;
      const activeImageLayerIds = new Set<string>();

      layers.forEach((layer) => {
        if (layer.type !== "image") {
          return;
        }

        activeImageLayerIds.add(layer.id);

        if (!layer.params.src && layer.params.assetId && !pendingAssetLoads.has(layer.id)) {
          pendingAssetLoads.add(layer.id);
          void getImageAsset(layer.params.assetId).then((blob) => {
            pendingAssetLoads.delete(layer.id);

            if (!blob || disposed) {
              return;
            }

            const existingAssetUrlRecord = imageAssetUrlRecords.get(layer.id);

            if (existingAssetUrlRecord) {
              URL.revokeObjectURL(existingAssetUrlRecord.src);
            }

            const src = URL.createObjectURL(blob);

            imageAssetUrlRecords.set(layer.id, {
              assetId: layer.params.assetId ?? "",
              src,
            });
            setImageAssetSource(layer.id, src);
          });
          return;
        }

        if (!layer.params.src) {
          return;
        }

        const existingRecord = imageTextureRecords.get(layer.id);

        if (existingRecord?.src === layer.params.src) {
          return;
        }

        existingRecord?.texture.dispose();
        const imageElement = new window.Image();
        const texture = new THREE.Texture(imageElement);
        const src = layer.params.src;

        configureImageTexture(texture);
        imageTextureRecords.set(layer.id, {
          ready: false,
          src,
          texture,
        });

        imageElement.addEventListener("load", () => {
          const record = imageTextureRecords.get(layer.id);

          if (!record || record.src !== src) {
            return;
          }

          record.ready = true;
          texture.needsUpdate = true;
          pushImageTexturesToSkybox();

          if (!disposed) {
            render();
          }
        });
        imageElement.addEventListener("error", () => {
          const record = imageTextureRecords.get(layer.id);

          if (!record || record.src !== src) {
            return;
          }

          record.texture.dispose();
          imageTextureRecords.delete(layer.id);
          pushImageTexturesToSkybox();

          if (!disposed) {
            render();
          }
        });

        imageElement.src = src;
        if (imageElement.complete && imageElement.naturalWidth > 0) {
          const record = imageTextureRecords.get(layer.id);

          if (record && record.src === src) {
            record.ready = true;
          }

          texture.needsUpdate = true;
          window.queueMicrotask(() => {
            if (!disposed) {
              pushImageTexturesToSkybox();
              render();
            }
          });
        }

        changed = true;
      });

      Array.from(imageTextureRecords.entries()).forEach(([layerId, record]) => {
        if (activeImageLayerIds.has(layerId)) {
          return;
        }

        record.texture.dispose();
        imageTextureRecords.delete(layerId);
        const assetUrlRecord = imageAssetUrlRecords.get(layerId);

        if (assetUrlRecord) {
          URL.revokeObjectURL(assetUrlRecord.src);
          imageAssetUrlRecords.delete(layerId);
        }
        changed = true;
      });

      if (changed) {
        pushImageTexturesToSkybox();
      }
    };

    syncImageTexturesRef.current = syncImageTextures;
    syncImageTextures(effectLayersRef.current);

    const syncImageLayerPlacements = (layers: EffectLayer[]) => {
      let changed = false;
      const activeImageLayerIds = new Set<string>();

      layers.forEach((layer) => {
        if (layer.type !== "image") {
          return;
        }

        activeImageLayerIds.add(layer.id);
        const placementKey = createImagePlacementKey(layer.params.placement);

        if (imagePlacementKeys.get(layer.id) === placementKey) {
          return;
        }

        imagePlacementKeys.set(layer.id, placementKey);
        liveSkybox.setImageLayerPlacement(layer.id, layer.params.placement);
        changed = true;
      });

      Array.from(imagePlacementKeys.keys()).forEach((layerId) => {
        if (activeImageLayerIds.has(layerId)) {
          return;
        }

        imagePlacementKeys.delete(layerId);
        liveSkybox.setImageLayerPlacement(layerId, null);
        changed = true;
      });

      if (changed) {
        render();
      }
    };

    syncImageLayerPlacementsRef.current = syncImageLayerPlacements;
    syncImageLayerPlacements(effectLayersRef.current);

    const syncSkyGeometry = (nextManifest: SkyboxManifest) => {
      const nextSkyGeometryType = nextManifest.version === 2
        ? nextManifest.geometry?.type ?? "box"
        : "box";

      if (nextSkyGeometryType === currentSkyGeometryType) {
        return;
      }

      const previousGeometry = skyGeometry.geometry;

      skyGeometry.geometry = createSkyboxWireGeometry({ type: nextSkyGeometryType });
      previousGeometry.dispose();
      currentSkyGeometryType = nextSkyGeometryType;
      syncImagePlacementsRef.current?.();
      render();
    };

    const syncImagePlacements = () => {
      const unplacedImageLayer = effectLayersRef.current.find(
        (layer): layer is Extract<EffectLayer, { type: "image" }> =>
          layer.type === "image" &&
          Boolean(layer.params.src) &&
          (!layer.params.placement || layer.params.placement.projection !== "angular-decal")
      );

      if (unplacedImageLayer) {
        const previousPlacement = unplacedImageLayer.params.placement;
        const placement = createImagePlacement(
          camera,
          canvas,
          unplacedImageLayer.params,
          getPlacementDirectionFallback(previousPlacement)
        );

        if (placement) {
          setImagePlacement(unplacedImageLayer.id, placement, previousPlacement ? { history: "skip" } : undefined);
          return;
        }
      }
    };

    syncImagePlacementsRef.current = syncImagePlacements;

    const syncGizmoOrientation = () => {
      setGizmoOrientation(quaternionToTuple(camera.quaternion));
    };

    const cancelCameraAnimation = () => {
      if (animationFrameRef.current === null) {
        return;
      }

      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };

    const orbitControls = new SkyboxOrbitControls(camera, canvas);
    orbitControls.rotationMode = cameraRotationMode;

    orbitControls.addEventListener("start", cancelCameraAnimation);
    orbitControls.addEventListener("change", () => {
      syncGizmoOrientation();
      render();
    });

    const applySceneRenderMode = (
      nextManifest: SkyboxManifest,
      nextRenderMode: SceneRenderMode
    ) => {
      syncSkyGeometry(nextManifest);
      scene.background = null;
      liveSkybox.setManifest(nextManifest);

      if (!liveSkybox.parent) {
        scene.add(liveSkybox);
      }

      render();
    };

    updateSkyboxRef.current = applySceneRenderMode;
    setCameraRotationModeRef.current = (nextRotationMode) => {
      orbitControls.rotationMode = nextRotationMode;
      orbitControls.stop();
      canvas.style.cursor = "grab";
    };

    const getDirectionQuaternion = (direction: VectorTuple) => {
      const targetDirection = new THREE.Vector3(...direction).normalize();
      const fallbackUp = Math.abs(targetDirection.y) > 0.98
        ? new THREE.Vector3(0, 0, targetDirection.y > 0 ? -1 : 1)
        : new THREE.Vector3(0, 1, 0);
      const targetCamera = camera.clone();

      targetCamera.position.set(0, 0, 0);
      targetCamera.up.copy(fallbackUp);
      targetCamera.lookAt(targetDirection);

      return targetCamera.quaternion;
    };

    const getAxisQuaternion = (direction: VectorTuple) => {
      const requestedDirection = new THREE.Vector3(...direction).normalize();
      const currentForwardDirection = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(camera.quaternion)
        .normalize();
      const axisDirection =
        currentForwardDirection.dot(requestedDirection) > AXIS_TOGGLE_DOT_THRESHOLD
          ? requestedDirection.negate()
          : requestedDirection;

      return getDirectionQuaternion(vectorToTuple(axisDirection));
    };

    const lookAtAxisDirection = (direction: VectorTuple) => {
      const startQuaternion = camera.quaternion.clone();
      const targetQuaternion = getAxisQuaternion(direction);
      const startedAt = performance.now();

      orbitControls.stop();
      cancelCameraAnimation();

      const tick = (time: number) => {
        const progress = Math.min(1, (time - startedAt) / AXIS_ANIMATION_DURATION_MS);
        const easedProgress = easeOutCubic(progress);

        camera.quaternion.copy(startQuaternion).slerp(targetQuaternion, easedProgress);
        syncGizmoOrientation();
        render();

        if (progress < 1) {
          animationFrameRef.current = window.requestAnimationFrame(tick);
          return;
        }

        animationFrameRef.current = null;
      };

      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    const animateToQuaternion = (targetQuaternion: THREE.Quaternion) => {
      const startQuaternion = camera.quaternion.clone();
      const startedAt = performance.now();

      orbitControls.stop();
      cancelCameraAnimation();

      const tick = (time: number) => {
        const progress = Math.min(1, (time - startedAt) / AXIS_ANIMATION_DURATION_MS);
        const easedProgress = easeOutCubic(progress);

        camera.quaternion.copy(startQuaternion).slerp(targetQuaternion, easedProgress);
        syncGizmoOrientation();
        render();

        if (progress < 1) {
          animationFrameRef.current = window.requestAnimationFrame(tick);
          return;
        }

        animationFrameRef.current = null;
      };

      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    const resetOrientation = () => {
      animateToQuaternion(new THREE.Quaternion().setFromEuler(INITIAL_CAMERA_ROTATION));
    };

    const focusLayer = (layerId: string) => {
      const layer = effectLayersRef.current.find((effectLayer) => effectLayer.id === layerId);
      const focusTarget = getEffectLayerFocusTarget(layer);

      if (!focusTarget || focusTarget.type !== "direction") {
        return;
      }

      animateToQuaternion(getDirectionQuaternion(focusTarget.direction));
    };

    const setRaycasterFromPointer = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      raycaster.setFromCamera(pointer, camera);
    };

    const getSceneLayerHits = (event: MouseEvent): SceneLayerHit[] => {
      setRaycasterFromPointer(event);
      const direction = vectorToTuple(raycaster.ray.direction);
      const hits: SceneLayerHit[] = [];

      for (const layer of effectLayersRef.current) {
        if (!layer.enabled || layer.locked) {
          continue;
        }

        if (layer.type === "spot") {
          if (spotContainsDirection(direction, layer.params)) {
            hits.push({ layerId: layer.id, type: layer.type });
          }
          continue;
        }

        if (layer.type !== "image") {
          hits.push({ layerId: layer.id, type: layer.type });
          continue;
        }

        if (!layer.params.src || !layer.params.placement) {
          continue;
        }

        const uv = projectDirectionToImageUv(direction, layer.params.placement);

        if (uv) {
          hits.push({ layerId: layer.id, type: layer.type, uv });
        }
      }

      return hits;
    };

    const updateHoveredImageLayerFromPointer = (event: PointerEvent) => {
      const imageHit = getSceneLayerHits(event).find((hit) => hit.type === "image");

      setHoveredImageLayerId(imageHit?.layerId ?? null);
    };

    const syncImageLayerPlacementLive = (layerId: string, placement: ImagePlacement | null) => {
      imagePlacementKeys.set(layerId, createImagePlacementKey(placement));
      liveSkybox.setImageLayerPlacement(layerId, placement);
      render();
    };

    const flushPendingImagePlacementStoreUpdate = () => {
      if (pendingImagePlacementFrame !== null) {
        window.cancelAnimationFrame(pendingImagePlacementFrame);
        pendingImagePlacementFrame = null;
      }

      if (!pendingImagePlacementLayerId || !pendingImagePlacement) {
        return;
      }

      setImagePlacement(pendingImagePlacementLayerId, pendingImagePlacement, { history: "skip" });
      pendingImagePlacementLayerId = "";
      pendingImagePlacement = null;
    };

    const scheduleImagePlacementStoreUpdate = (
      layerId: string,
      placement: ImagePlacement
    ) => {
      pendingImagePlacementLayerId = layerId;
      pendingImagePlacement = placement;

      if (pendingImagePlacementFrame !== null) {
        return;
      }

      pendingImagePlacementFrame = window.requestAnimationFrame(() => {
        pendingImagePlacementFrame = null;
        flushPendingImagePlacementStoreUpdate();
      });
    };

    const updateImageDragPlacement = (event: PointerEvent) => {
      if (imageDragState.pointerId !== event.pointerId || !imageDragState.layerId) {
        return;
      }

      setRaycasterFromPointer(event);
      const pointerDirection = vectorToTuple(raycaster.ray.direction.clone().normalize());
      const pointerPlacement = createAngularDecalPlacement({
        angularHeight: imageDragState.angularHeight,
        angularWidth: imageDragState.angularWidth,
        baseAngularHeight: imageDragState.baseAngularHeight,
        baseAngularWidth: imageDragState.baseAngularWidth,
        centerDirection: pointerDirection,
        rotation: imageDragState.rotation,
      });
      const centerDirection = normalizeVector([
        pointerDirection[0] -
          pointerPlacement.tangentX[0] * imageDragState.offsetX -
          pointerPlacement.tangentY[0] * imageDragState.offsetY,
        pointerDirection[1] -
          pointerPlacement.tangentX[1] * imageDragState.offsetX -
          pointerPlacement.tangentY[1] * imageDragState.offsetY,
        pointerDirection[2] -
          pointerPlacement.tangentX[2] * imageDragState.offsetX -
          pointerPlacement.tangentY[2] * imageDragState.offsetY,
      ]);

      const placement: ImagePlacement = createAngularDecalPlacement({
        angularHeight: imageDragState.angularHeight,
        angularWidth: imageDragState.angularWidth,
        baseAngularHeight: imageDragState.baseAngularHeight,
        baseAngularWidth: imageDragState.baseAngularWidth,
        centerDirection,
        rotation: imageDragState.rotation,
      });

      imageDragState.placement = placement;
      syncImageLayerPlacementLive(imageDragState.layerId, placement);
      scheduleImagePlacementStoreUpdate(imageDragState.layerId, placement);
    };

    const updateSpotDragPosition = (event: PointerEvent) => {
      if (spotDragState.pointerId !== event.pointerId || !spotDragState.layerId) {
        return;
      }

      setRaycasterFromPointer(event);
      const pointerDirection = vectorToTuple(raycaster.ray.direction.clone().normalize());
      const centerDirection = getDraggedCenterDirection(
        pointerDirection,
        spotDragState.angularRadius,
        spotDragState.offsetX,
        spotDragState.offsetY
      );

      setSpotPosition(centerDirection, { history: "skip" });
      const state = useWorkspaceStore.getState();
      liveSkybox.setManifest(createSkyboxManifest(
        state.effectLayers,
        state.previewEffectLayerBlendMode,
        { type: state.skyGeometryType }
      ));
      render();
    };

    lookAtAxisDirectionRef.current = lookAtAxisDirection;
    focusLayerRef.current = focusLayer;
    resetOrientationRef.current = resetOrientation;
    syncGizmoOrientation();

    const releaseImagePointer = (event: PointerEvent) => {
      if (imageDragState.pointerId !== event.pointerId) {
        return;
      }

      if (imageDragState.hasMoved) {
        updateImageDragPlacement(event);
      }

      flushPendingImagePlacementStoreUpdate();
      imageDragState.layerId = "";
      imageDragState.placement = null;
      imageDragState.pointerId = -1;
      imageDragState.angularWidth = 0;
      imageDragState.angularHeight = 0;
      imageDragState.baseAngularWidth = 0;
      imageDragState.baseAngularHeight = 0;
      imageDragState.rotation = 0;
      imageDragState.hasMoved = false;
      imageDragState.offsetX = 0;
      imageDragState.offsetY = 0;
      commitHistoryTransaction(IMAGE_PLACEMENT_TRANSACTION_SCOPE);
      canvas.style.cursor = "grab";

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    const releaseSpotPointer = (event: PointerEvent) => {
      if (spotDragState.pointerId !== event.pointerId) {
        return;
      }

      if (spotDragState.hasMoved) {
        updateSpotDragPosition(event);
      }

      spotDragState.layerId = "";
      spotDragState.pointerId = -1;
      spotDragState.angularRadius = 0;
      spotDragState.offsetX = 0;
      spotDragState.offsetY = 0;
      spotDragState.hasMoved = false;
      commitHistoryTransaction(SPOT_PLACEMENT_TRANSACTION_SCOPE);
      canvas.style.cursor = "grab";

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    const selectSceneLayerHit = (hit: SceneLayerHit) => {
      selectedLayerIdRef.current = hit.layerId;
      selectEffectLayer(hit.layerId);
      setSelectedImageLayerId(hit.type === "image" ? hit.layerId : null);
    };

    const beginImageDrag = (event: PointerEvent, hit: SceneLayerHit) => {
      if (hit.type !== "image") {
        return false;
      }

      const hitLayer = effectLayersRef.current.find(
        (layer): layer is Extract<EffectLayer, { type: "image" }> =>
          layer.id === hit.layerId && layer.type === "image"
      );
      const placement = hitLayer?.params.placement;

      if (!placement) {
        return false;
      }

      const halfWidth = Math.tan(placement.angularWidth / 2);
      const halfHeight = Math.tan(placement.angularHeight / 2);

      selectSceneLayerHit(hit);
      setHoveredImageLayerId(hit.layerId);
      beginHistoryTransaction(IMAGE_PLACEMENT_TRANSACTION_SCOPE);
      imageDragState.layerId = hit.layerId;
      imageDragState.pointerId = event.pointerId;
      imageDragState.placement = placement;
      imageDragState.angularWidth = placement.angularWidth;
      imageDragState.angularHeight = placement.angularHeight;
      imageDragState.baseAngularWidth = placement.baseAngularWidth;
      imageDragState.baseAngularHeight = placement.baseAngularHeight;
      imageDragState.rotation = placement.rotation ?? 0;
      imageDragState.hasMoved = false;
      imageDragState.offsetX = hit.uv ? (hit.uv.u - 0.5) * halfWidth * 2 : 0;
      imageDragState.offsetY = hit.uv ? (0.5 - hit.uv.v) * halfHeight * 2 : 0;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(event.pointerId);

      return true;
    };

    const beginSpotDrag = (event: PointerEvent, hit: SceneLayerHit) => {
      if (hit.type !== "spot") {
        return false;
      }

      const hitLayer = effectLayersRef.current.find(
        (layer): layer is Extract<EffectLayer, { type: "spot" }> =>
          layer.id === hit.layerId && layer.type === "spot"
      );

      if (!hitLayer) {
        return false;
      }

      setRaycasterFromPointer(event);
      const pointerDirection = vectorToTuple(raycaster.ray.direction.clone().normalize());
      const offset = getProjectedOffset(
        pointerDirection,
        hitLayer.params.centerDirection,
        hitLayer.params.angularRadius
      );

      selectSceneLayerHit(hit);
      beginHistoryTransaction(SPOT_PLACEMENT_TRANSACTION_SCOPE);
      spotDragState.layerId = hit.layerId;
      spotDragState.pointerId = event.pointerId;
      spotDragState.angularRadius = hitLayer.params.angularRadius;
      spotDragState.offsetX = offset.x;
      spotDragState.offsetY = offset.y;
      spotDragState.hasMoved = false;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(event.pointerId);

      return true;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      const hits = getSceneLayerHits(event);

      if (hits.length === 0) {
        return;
      }

      const hoveredImageHit = hits.find((hit) => hit.type === "image");
      setHoveredImageLayerId(hoveredImageHit?.layerId ?? null);

      const selectedImageHit = hits.find(
        (hit) => hit.type === "image" && hit.layerId === selectedLayerIdRef.current
      );

      if (selectedImageHit && beginImageDrag(event, selectedImageHit)) {
        return;
      }

      const selectedSpotHit = hits.find(
        (hit) => hit.type === "spot" && hit.layerId === selectedLayerIdRef.current
      );

      if (selectedSpotHit && beginSpotDrag(event, selectedSpotHit)) {
        return;
      }

      const topHit = hits[0];

      if (topHit.type === "image" && beginImageDrag(event, topHit)) {
        return;
      }

      if (topHit.type === "spot" && beginSpotDrag(event, topHit)) {
        return;
      }

      selectSceneLayerHit(topHit);
    };

    const onDoubleClick = (event: MouseEvent) => {
      event.preventDefault();
      const hits = getSceneLayerHits(event);

      if (hits.length === 0) {
        return;
      }

      const selectedHitIndex = hits.findIndex(
        (hit) => hit.layerId === selectedLayerIdRef.current
      );
      const peeledHitIndex = selectedHitIndex === -1 ? 0 : selectedHitIndex;
      const peeledHit = hits[peeledHitIndex];
      const nextHit = hits.length > 1
        ? hits[(peeledHitIndex + 1) % hits.length]
        : peeledHit;

      selectSceneLayerHit(nextHit);
      toggleEffectLayerEnabled(peeledHit.layerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (imageDragState.pointerId === event.pointerId) {
        event.preventDefault();
        imageDragState.hasMoved = true;
        updateImageDragPlacement(event);
        setHoveredImageLayerId(imageDragState.layerId);
        return;
      }

      if (spotDragState.pointerId === event.pointerId) {
        event.preventDefault();
        spotDragState.hasMoved = true;
        updateSpotDragPosition(event);
        return;
      }

      if (!orbitControls.isDragging) {
        updateHoveredImageLayerFromPointer(event);
        canvas.style.cursor = "grab";
      }
    };

    const clearHoveredImageLayer = () => {
      setHoveredImageLayerId(null);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("dblclick", onDoubleClick);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", clearHoveredImageLayer);
    const releaseScenePointer = (event: PointerEvent) => {
      releaseImagePointer(event);
      releaseSpotPointer(event);
    };

    canvas.addEventListener("pointerup", releaseScenePointer);
    canvas.addEventListener("pointercancel", releaseScenePointer);
    canvas.addEventListener("lostpointercapture", releaseScenePointer);

    const resize = () => {
      const { height, width } = container.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.floor(width));
      const nextHeight = Math.max(1, Math.floor(height));

      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight, false);
      render();
    };

    const resizeObserver = new ResizeObserver(resize);

    resizeObserver.observe(container);

    void renderer.init().then(() => {
      if (disposed) {
        return;
      }

      rendererReady = true;
      applySceneRenderMode(skyboxManifest, sceneRenderMode);
      resize();
    });

    return () => {
      disposed = true;
      renderRef.current = null;
      setGroundPlaneHelperVisibleRef.current = null;
      setSkyGeometryVisibleRef.current = null;
      setCameraRotationModeRef.current = null;
      syncImagePlacementsRef.current = null;
      syncImageLayerPlacementsRef.current = null;
      syncImageTexturesRef.current = null;
      syncEditorImageStateRef.current = null;
      updateSkyboxRef.current = null;
      lookAtAxisDirectionRef.current = null;
      focusLayerRef.current = null;
      resetOrientationRef.current = null;
      cancelCameraAnimation();
      if (pendingImagePlacementFrame !== null) {
        window.cancelAnimationFrame(pendingImagePlacementFrame);
        pendingImagePlacementFrame = null;
      }
      orbitControls.dispose();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("dblclick", onDoubleClick);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", clearHoveredImageLayer);
      canvas.removeEventListener("pointerup", releaseScenePointer);
      canvas.removeEventListener("pointercancel", releaseScenePointer);
      canvas.removeEventListener("lostpointercapture", releaseScenePointer);
      resizeObserver.disconnect();
      imageTextureRecords.forEach((record) => record.texture.dispose());
      imageTextureRecords.clear();
      imageAssetUrlRecords.forEach((record) => URL.revokeObjectURL(record.src));
      imageAssetUrlRecords.clear();
      liveSkybox.dispose();
      groundPlaneHelper.geometry.dispose();
      groundPlaneHelperMaterials.forEach((material) => material.dispose());
      skyGeometry.geometry.dispose();
      skyGeometry.material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 bg-background">
      <canvas
        ref={canvasRef}
        aria-label={`${mode === "editor" ? "Editor" : "Preview"} skybox scene`}
        className="block h-full w-full"
        data-workspace-scene="three"
      />
      {showOrientationGizmo ? (
        <RotationGizmo
          onAxisSelect={handleGizmoAxisSelect}
          onReset={handleGizmoReset}
          orientation={gizmoOrientation}
        />
      ) : null}
    </div>
  );
}

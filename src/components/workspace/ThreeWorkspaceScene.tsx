import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three/webgpu";

import { useWorkspaceStore } from "@/store/app";
import type { SceneRenderMode, WorkspaceView } from "@/store/modules/scene";
import { RotationGizmo } from "@/components/workspace/RotationGizmo";
import { createSkyboxManifest } from "@/effects/skybox-manifest";
import type { EffectLayer } from "@/effects/effect-layer";
import {
  createSkyboxWireGeometry,
  Skybox,
  type SkyboxManifest,
} from "@/runtime/index";
import { SkyboxOrbitControls } from "@/components/workspace/SkyboxOrbitControls";
import type { ImagePlacement } from "@/store/modules/layers";

type ThreeWorkspaceSceneProps = {
  mode: WorkspaceView;
};

type QuaternionTuple = [number, number, number, number];
type VectorTuple = [number, number, number];

const INITIAL_CAMERA_ROTATION = new THREE.Euler(0.08, -0.35, 0, "YXZ");
const AXIS_ANIMATION_DURATION_MS = 320;
const AXIS_TOGGLE_DOT_THRESHOLD = 0.985;

function quaternionToTuple(quaternion: THREE.Quaternion): QuaternionTuple {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}

function easeOutCubic(progress: number) {
  return 1 - (1 - progress) ** 3;
}

function createGroundPlaneHelperGeometry() {
  const planeGeometry = new THREE.PlaneGeometry(1.8, 1.8, 8, 8);
  const wireGeometry = new THREE.WireframeGeometry(planeGeometry);

  planeGeometry.dispose();

  return wireGeometry;
}

function vectorToTuple(vector: THREE.Vector3): VectorTuple {
  return [vector.x, vector.y, vector.z];
}

function tupleToVector(tuple: VectorTuple) {
  return new THREE.Vector3(...tuple);
}

function getPlacementTangents(camera: THREE.PerspectiveCamera, centerDirection: THREE.Vector3) {
  const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const tangentY = cameraUp.sub(
    centerDirection.clone().multiplyScalar(cameraUp.dot(centerDirection))
  );

  if (tangentY.lengthSq() < 0.000001) {
    tangentY.copy(
      Math.abs(centerDirection.y) > 0.98
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(0, 1, 0)
    );
    tangentY.sub(centerDirection.clone().multiplyScalar(tangentY.dot(centerDirection)));
  }

  tangentY.normalize();

  return {
    tangentX: new THREE.Vector3().crossVectors(centerDirection, tangentY).normalize(),
    tangentY,
  };
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

  const { tangentX, tangentY } = getPlacementTangents(camera, centerDirection);
  const radiansPerPixel = THREE.MathUtils.degToRad(camera.fov) / Math.max(1, canvas.height);
  const angularHeight = Math.max(0.001, image.height * radiansPerPixel);
  const angularWidth = Math.max(0.001, angularHeight * (image.width / image.height));

  return {
    angularHeight,
    angularWidth,
    centerDirection: vectorToTuple(centerDirection),
    projection: "angular-decal",
    tangentX: vectorToTuple(tangentX),
    tangentY: vectorToTuple(tangentY),
  };
}

function getImageProjectionUv(direction: THREE.Vector3, placement: ImagePlacement) {
  const centerDirection = tupleToVector(placement.centerDirection).normalize();
  const tangentX = tupleToVector(placement.tangentX).normalize();
  const tangentY = tupleToVector(placement.tangentY).normalize();
  const normalizedDirection = direction.clone().normalize();
  const denom = normalizedDirection.dot(centerDirection);

  if (denom <= 0) {
    return null;
  }

  const x = normalizedDirection.dot(tangentX) / denom;
  const y = normalizedDirection.dot(tangentY) / denom;
  const halfWidth = Math.tan(placement.angularWidth / 2);
  const halfHeight = Math.tan(placement.angularHeight / 2);

  if (
    halfWidth <= 0 ||
    halfHeight <= 0 ||
    x < -halfWidth ||
    x > halfWidth ||
    y < -halfHeight ||
    y > halfHeight
  ) {
    return null;
  }

  return {
    u: x / (2 * halfWidth) + 0.5,
    v: 0.5 - y / (2 * halfHeight),
  };
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

export function ThreeWorkspaceScene({ mode }: ThreeWorkspaceSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderRef = useRef<(() => void) | null>(null);
  const syncImagePlacementsRef = useRef<(() => void) | null>(null);
  const syncImageTexturesRef = useRef<((layers: EffectLayer[]) => void) | null>(null);
  const syncHoveredImageLayerRef = useRef<((layers: EffectLayer[]) => void) | null>(null);
  const setGroundPlaneHelperVisibleRef = useRef<((visible: boolean) => void) | null>(null);
  const setSkyGeometryVisibleRef = useRef<((visible: boolean) => void) | null>(null);
  const updateSkyboxRef = useRef<
    ((nextManifest: SkyboxManifest, nextRenderMode: SceneRenderMode) => void) | null
  >(null);
  const lookAtAxisDirectionRef = useRef<((direction: VectorTuple) => void) | null>(null);
  const resetOrientationRef = useRef<(() => void) | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [gizmoOrientation, setGizmoOrientation] = useState<QuaternionTuple>(() =>
    quaternionToTuple(new THREE.Quaternion().setFromEuler(INITIAL_CAMERA_ROTATION))
  );
  const effectLayers = useWorkspaceStore((state) => state.effectLayers);
  const effectLayersRef = useRef(effectLayers);
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);
  const selectEffectLayer = useWorkspaceStore((state) => state.selectEffectLayer);
  const setImagePlacement = useWorkspaceStore((state) => state.setImagePlacement);
  const previewEffectLayerBlendMode = useWorkspaceStore(
    (state) => state.previewEffectLayerBlendMode
  );
  const sceneRenderMode = useWorkspaceStore((state) => state.sceneRenderMode);
  const skyGeometryType = useWorkspaceStore((state) => state.skyGeometryType);
  const showGroundPlaneHelper = useWorkspaceStore((state) => state.showGroundPlaneHelper);
  const showOrientationGizmo = useWorkspaceStore((state) => state.showOrientationGizmo);
  const showSkyGeometry = useWorkspaceStore((state) => state.showSkyGeometry);
  const skyboxManifest = useMemo(
    () =>
      createSkyboxManifest(
        effectLayers,
        previewEffectLayerBlendMode,
        { type: skyGeometryType }
      ),
    [effectLayers, previewEffectLayerBlendMode, skyGeometryType]
  );

  useEffect(() => {
    effectLayersRef.current = effectLayers;
    syncImagePlacementsRef.current?.();
    syncImageTexturesRef.current?.(effectLayers);
    syncHoveredImageLayerRef.current?.(effectLayers);
  }, [effectLayers]);

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
    const liveSkybox = new Skybox().setRenderer(renderer).fromManifest(skyboxManifest).load();
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
    const groundPlaneHelper = new THREE.LineSegments(
      createGroundPlaneHelperGeometry(),
      new THREE.LineBasicMaterial({
        color: 0x22c55e,
        depthTest: false,
        depthWrite: false,
        opacity: 0.45,
        toneMapped: false,
        transparent: true,
      })
    );
    const raycaster = new THREE.Raycaster();
    const imageDragState = {
      angularHeight: 0,
      angularWidth: 0,
      layerId: "",
      placement: null as ImagePlacement | null,
      pointerId: -1,
    };
    let hoveredImageLayerId: string | null = null;
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
    groundPlaneHelper.rotation.x = -Math.PI / 2;
    groundPlaneHelper.renderOrder = 9;
    groundPlaneHelper.visible = showGroundPlaneHelper;
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

    const setHoveredImageLayerId = (layerId: string | null) => {
      if (hoveredImageLayerId === layerId) {
        return;
      }

      hoveredImageLayerId = layerId;
      liveSkybox.setHoveredImageLayerId(layerId);
      render();
    };

    syncHoveredImageLayerRef.current = (layers) => {
      if (
        hoveredImageLayerId &&
        !layers.some(
          (layer) =>
            layer.id === hoveredImageLayerId &&
            layer.type === "image" &&
            layer.enabled &&
            Boolean(layer.params.src)
        )
      ) {
        setHoveredImageLayerId(null);
      }
    };

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
        if (layer.type !== "image" || !layer.params.src) {
          return;
        }

        activeImageLayerIds.add(layer.id);
        const existingRecord = imageTextureRecords.get(layer.id);

        if (existingRecord?.src === layer.params.src) {
          return;
        }

        existingRecord?.texture.dispose();
        const imageElement = new window.Image();
        const texture = new THREE.Texture(imageElement);
        const src = layer.params.src;

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

        configureImageTexture(texture);
        imageTextureRecords.set(layer.id, {
          ready: imageElement.complete && imageElement.naturalWidth > 0,
          src,
          texture,
        });

        if (imageElement.complete && imageElement.naturalWidth > 0) {
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
        changed = true;
      });

      if (changed) {
        pushImageTexturesToSkybox();
      }
    };

    syncImageTexturesRef.current = syncImageTextures;
    syncImageTextures(effectLayersRef.current);

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

    const getAxisQuaternion = (direction: VectorTuple) => {
      const requestedDirection = new THREE.Vector3(...direction).normalize();
      const currentForwardDirection = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(camera.quaternion)
        .normalize();
      const axisDirection =
        currentForwardDirection.dot(requestedDirection) > AXIS_TOGGLE_DOT_THRESHOLD
          ? requestedDirection.negate()
          : requestedDirection;
      const fallbackUp = Math.abs(axisDirection.y) > 0.98
        ? new THREE.Vector3(0, 0, axisDirection.y > 0 ? -1 : 1)
        : new THREE.Vector3(0, 1, 0);
      const targetCamera = camera.clone();

      targetCamera.position.set(0, 0, 0);
      targetCamera.up.copy(fallbackUp);
      targetCamera.lookAt(axisDirection);

      return targetCamera.quaternion;
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

    const setRaycasterFromPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      raycaster.setFromCamera(pointer, camera);
    };

    const getImageLayerHit = (event: PointerEvent) => {
      setRaycasterFromPointer(event);

      for (const layer of effectLayersRef.current) {
        if (
          layer.type !== "image" ||
          !layer.enabled ||
          !layer.params.src ||
          !layer.params.placement
        ) {
          continue;
        }

        const placement = layer.params.placement;
        const uv = getImageProjectionUv(raycaster.ray.direction, placement);

        if (uv) {
          return layer.id;
        }
      }

      return null;
    };

    const updateHoveredImageLayerFromPointer = (event: PointerEvent) => {
      setHoveredImageLayerId(getImageLayerHit(event));
    };

    const updateImageDragPlacement = (event: PointerEvent) => {
      if (imageDragState.pointerId !== event.pointerId || !imageDragState.layerId) {
        return;
      }

      setRaycasterFromPointer(event);
      const centerDirection = raycaster.ray.direction.clone().normalize();
      const { tangentX, tangentY } = getPlacementTangents(camera, centerDirection);

      const placement: ImagePlacement = {
        angularHeight: imageDragState.angularHeight,
        angularWidth: imageDragState.angularWidth,
        centerDirection: vectorToTuple(centerDirection),
        projection: "angular-decal",
        tangentX: vectorToTuple(tangentX),
        tangentY: vectorToTuple(tangentY),
      };

      imageDragState.placement = placement;
      liveSkybox.setImageLayerPlacement(imageDragState.layerId, placement);
      render();
    };

    lookAtAxisDirectionRef.current = lookAtAxisDirection;
    resetOrientationRef.current = resetOrientation;
    syncGizmoOrientation();

    const releaseImagePointer = (event: PointerEvent) => {
      if (imageDragState.pointerId !== event.pointerId) {
        return;
      }

      updateImageDragPlacement(event);

      if (imageDragState.placement) {
        setImagePlacement(imageDragState.layerId, imageDragState.placement, { history: "skip" });
      }

      imageDragState.layerId = "";
      imageDragState.placement = null;
      imageDragState.pointerId = -1;
      imageDragState.angularWidth = 0;
      imageDragState.angularHeight = 0;
      commitHistoryTransaction();
      canvas.style.cursor = "grab";

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      const hitLayerId = getImageLayerHit(event);

      if (!hitLayerId) {
        return;
      }

      const hitLayer = effectLayersRef.current.find(
        (layer): layer is Extract<EffectLayer, { type: "image" }> =>
          layer.id === hitLayerId && layer.type === "image"
      );
      const placement = hitLayer?.params.placement;

      if (!placement) {
        return;
      }

      selectEffectLayer(hitLayerId);
      setHoveredImageLayerId(hitLayerId);
      beginHistoryTransaction();
      imageDragState.layerId = hitLayerId;
      imageDragState.pointerId = event.pointerId;
      imageDragState.placement = placement;
      imageDragState.angularWidth = placement.angularWidth;
      imageDragState.angularHeight = placement.angularHeight;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (imageDragState.pointerId === event.pointerId) {
        event.preventDefault();
        updateImageDragPlacement(event);
        setHoveredImageLayerId(imageDragState.layerId);
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
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", clearHoveredImageLayer);
    canvas.addEventListener("pointerup", releaseImagePointer);
    canvas.addEventListener("pointercancel", releaseImagePointer);
    canvas.addEventListener("lostpointercapture", releaseImagePointer);

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
      syncImagePlacementsRef.current = null;
      syncImageTexturesRef.current = null;
      syncHoveredImageLayerRef.current = null;
      updateSkyboxRef.current = null;
      lookAtAxisDirectionRef.current = null;
      resetOrientationRef.current = null;
      cancelCameraAnimation();
      orbitControls.dispose();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", clearHoveredImageLayer);
      canvas.removeEventListener("pointerup", releaseImagePointer);
      canvas.removeEventListener("pointercancel", releaseImagePointer);
      canvas.removeEventListener("lostpointercapture", releaseImagePointer);
      resizeObserver.disconnect();
      imageTextureRecords.forEach((record) => record.texture.dispose());
      imageTextureRecords.clear();
      liveSkybox.dispose();
      groundPlaneHelper.geometry.dispose();
      groundPlaneHelper.material.dispose();
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

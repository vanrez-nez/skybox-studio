import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import debounce from "lodash/debounce";
import * as THREE from "three/webgpu";

import {
  type BakedSkyboxTexture,
  createTextureBakingSkyboxTexture,
} from "@/processes/texture-baking";
import type { TextureBakeWorkerResponse } from "@/processes/texture-baking.worker";
import TextureBakingWorker from "@/processes/texture-baking.worker?worker";
import { useWorkspaceStore } from "@/store/app";
import type { SceneRenderMode, WorkspaceView } from "@/store/modules/scene";
import { RotationGizmo } from "@/components/workspace/RotationGizmo";
import { createSkyboxManifest } from "@/effects/skybox-manifest";
import { Skybox, type SkyboxManifestV1 } from "@/runtime/index";

type ThreeWorkspaceSceneProps = {
  mode: WorkspaceView;
};

type QuaternionTuple = [number, number, number, number];
type VectorTuple = [number, number, number];

const INITIAL_CAMERA_ROTATION = new THREE.Euler(0.08, -0.35, 0, "YXZ");
const AXIS_ANIMATION_DURATION_MS = 320;
const AXIS_TOGGLE_DOT_THRESHOLD = 0.985;
const SKYBOX_BAKE_DEBOUNCE_MS = 50;

function quaternionToTuple(quaternion: THREE.Quaternion): QuaternionTuple {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}

function easeOutCubic(progress: number) {
  return 1 - (1 - progress) ** 3;
}

export function ThreeWorkspaceScene({ mode }: ThreeWorkspaceSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderRef = useRef<(() => void) | null>(null);
  const skyboxTextureRef = useRef<BakedSkyboxTexture | null>(null);
  const updateSkyboxRef = useRef<
    ((nextManifest: SkyboxManifestV1, nextRenderMode: SceneRenderMode) => void) | null
  >(null);
  const lookAtAxisDirectionRef = useRef<((direction: VectorTuple) => void) | null>(null);
  const resetOrientationRef = useRef<(() => void) | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [gizmoOrientation, setGizmoOrientation] = useState<QuaternionTuple>(() =>
    quaternionToTuple(new THREE.Quaternion().setFromEuler(INITIAL_CAMERA_ROTATION))
  );
  const effectLayers = useWorkspaceStore((state) => state.effectLayers);
  const previewEffectLayerBlendMode = useWorkspaceStore(
    (state) => state.previewEffectLayerBlendMode
  );
  const sceneRenderMode = useWorkspaceStore((state) => state.sceneRenderMode);
  const showOrientationGizmo = useWorkspaceStore((state) => state.showOrientationGizmo);
  const skyboxManifest = useMemo(
    () => createSkyboxManifest(effectLayers, previewEffectLayerBlendMode),
    [effectLayers, previewEffectLayerBlendMode]
  );

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
    let bakeWorker: Worker | null = null;
    let latestBakeRequestId = 0;
    let currentRenderMode: SceneRenderMode = sceneRenderMode;
    let disposed = false;
    let rendererReady = false;
    const skyboxTexture = createTextureBakingSkyboxTexture();
    const liveSkybox = new Skybox().setRenderer(renderer).fromManifest(skyboxManifest).load();
    const cameraRotation = INITIAL_CAMERA_ROTATION.clone();
    const pointerState = {
      id: -1,
      pitch: cameraRotation.x,
      previousX: 0,
      previousY: 0,
      yaw: cameraRotation.y,
    };

    skyboxTextureRef.current = skyboxTexture;
    camera.position.set(0, 0, 0);
    camera.rotation.copy(cameraRotation);
    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const render = () => {
      if (!rendererReady || disposed) {
        return;
      }

      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, canvas.width, canvas.height);
      renderer.render(scene, camera);
    };

    renderRef.current = render;

    const syncGizmoOrientation = () => {
      setGizmoOrientation(quaternionToTuple(camera.quaternion));
    };

    const syncPointerRotation = () => {
      cameraRotation.setFromQuaternion(camera.quaternion, "YXZ");
      pointerState.pitch = cameraRotation.x;
      pointerState.yaw = cameraRotation.y;
    };

    const cancelCameraAnimation = () => {
      if (animationFrameRef.current === null) {
        return;
      }

      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };

    const handleBakeWorkerMessage = (event: MessageEvent<TextureBakeWorkerResponse>) => {
      if (
        disposed ||
        currentRenderMode !== "texture-baked" ||
        event.data.id !== latestBakeRequestId
      ) {
        return;
      }

      const currentTexture = skyboxTextureRef.current;

      if (!currentTexture) {
        return;
      }

      const nextTexture = createTextureBakingSkyboxTexture(undefined, {
        data: new Uint8ClampedArray(event.data.data),
        height: event.data.height,
        width: event.data.width,
      });

      scene.background = nextTexture;
      skyboxTextureRef.current = nextTexture;
      currentTexture.dispose();
      render();
    };

    const getBakeWorker = () => {
      if (!bakeWorker) {
        bakeWorker = new TextureBakingWorker();
        bakeWorker.onmessage = handleBakeWorkerMessage;
      }

      return bakeWorker;
    };

    const terminateBakeWorker = () => {
      if (!bakeWorker) {
        return;
      }

      bakeWorker.terminate();
      bakeWorker = null;
    };

    const sendSkyboxBake = debounce((id: number, nextManifest: SkyboxManifestV1) => {
      getBakeWorker().postMessage({
        id,
        manifest: nextManifest,
      });
    }, SKYBOX_BAKE_DEBOUNCE_MS);

    const requestSkyboxBake = (nextManifest: SkyboxManifestV1) => {
      latestBakeRequestId += 1;
      sendSkyboxBake(latestBakeRequestId, nextManifest);
    };

    const applySceneRenderMode = (
      nextManifest: SkyboxManifestV1,
      nextRenderMode: SceneRenderMode
    ) => {
      currentRenderMode = nextRenderMode;

      if (nextRenderMode === "live") {
        sendSkyboxBake.cancel();
        terminateBakeWorker();
        scene.background = null;
        liveSkybox.setManifest(nextManifest);

        if (!liveSkybox.parent) {
          scene.add(liveSkybox);
        }

        render();
        return;
      }

      if (liveSkybox.parent) {
        scene.remove(liveSkybox);
      }

      scene.background = skyboxTextureRef.current;
      requestSkyboxBake(nextManifest);
      render();
    };

    updateSkyboxRef.current = applySceneRenderMode;

    const rotateCameraFromPointerDelta = (deltaX: number, deltaY: number) => {
      cancelCameraAnimation();

      const yawQuaternion = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        -deltaX * 0.006
      );

      camera.quaternion.premultiply(yawQuaternion);

      const pitchAxis = new THREE.Vector3(1, 0, 0)
        .applyQuaternion(camera.quaternion)
        .normalize();
      const pitchQuaternion = new THREE.Quaternion().setFromAxisAngle(
        pitchAxis,
        -deltaY * 0.006
      );

      camera.quaternion.premultiply(pitchQuaternion);
      syncPointerRotation();
      syncGizmoOrientation();
      render();
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

      cancelCameraAnimation();

      const tick = (time: number) => {
        const progress = Math.min(1, (time - startedAt) / AXIS_ANIMATION_DURATION_MS);
        const easedProgress = easeOutCubic(progress);

        camera.quaternion.copy(startQuaternion).slerp(targetQuaternion, easedProgress);
        syncPointerRotation();
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

      cancelCameraAnimation();

      const tick = (time: number) => {
        const progress = Math.min(1, (time - startedAt) / AXIS_ANIMATION_DURATION_MS);
        const easedProgress = easeOutCubic(progress);

        camera.quaternion.copy(startQuaternion).slerp(targetQuaternion, easedProgress);
        syncPointerRotation();
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

    lookAtAxisDirectionRef.current = lookAtAxisDirection;
    resetOrientationRef.current = resetOrientation;
    syncGizmoOrientation();

    const releasePointer = (event: PointerEvent) => {
      if (pointerState.id !== event.pointerId) {
        return;
      }

      pointerState.id = -1;
      canvas.style.cursor = "grab";

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }

      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();

      pointerState.id = event.pointerId;
      pointerState.previousX = event.clientX;
      pointerState.previousY = event.clientY;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(event.pointerId);
      canvas.requestPointerLock?.();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pointerState.id !== event.pointerId) {
        canvas.style.cursor = "grab";
        return;
      }

      event.preventDefault();
      const isPointerLocked = document.pointerLockElement === canvas;

      if (isPointerLocked) {
        return;
      }

      const deltaX = event.clientX - pointerState.previousX;
      const deltaY = event.clientY - pointerState.previousY;

      pointerState.previousX = event.clientX;
      pointerState.previousY = event.clientY;
      rotateCameraFromPointerDelta(deltaX, deltaY);
    };

    const onLockedMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas || pointerState.id === -1) {
        return;
      }

      event.preventDefault();
      rotateCameraFromPointerDelta(event.movementX, event.movementY);
    };

    const onLockedMouseUp = () => {
      if (pointerState.id === -1) {
        return;
      }

      pointerState.id = -1;
      canvas.style.cursor = "grab";

      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", releasePointer);
    canvas.addEventListener("pointercancel", releasePointer);
    canvas.addEventListener("lostpointercapture", releasePointer);
    document.addEventListener("mousemove", onLockedMouseMove);
    document.addEventListener("mouseup", onLockedMouseUp);

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
      updateSkyboxRef.current = null;
      lookAtAxisDirectionRef.current = null;
      resetOrientationRef.current = null;
      cancelCameraAnimation();
      const referencedSkyboxTexture = skyboxTextureRef.current;
      skyboxTextureRef.current = null;
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", releasePointer);
      canvas.removeEventListener("pointercancel", releasePointer);
      canvas.removeEventListener("lostpointercapture", releasePointer);
      document.removeEventListener("mousemove", onLockedMouseMove);
      document.removeEventListener("mouseup", onLockedMouseUp);
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
      resizeObserver.disconnect();
      sendSkyboxBake.cancel();
      terminateBakeWorker();
      liveSkybox.dispose();
      const currentSkyboxTexture = scene.background;

      if (currentSkyboxTexture instanceof THREE.Texture) {
        currentSkyboxTexture.dispose();
      }

      if (referencedSkyboxTexture && referencedSkyboxTexture !== currentSkyboxTexture) {
        referencedSkyboxTexture.dispose();
      }

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

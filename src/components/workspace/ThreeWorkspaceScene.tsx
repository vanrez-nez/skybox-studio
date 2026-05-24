import { useEffect, useRef } from "react";
import * as THREE from "three";

import {
  type BakedSkyboxTexture,
  createTextureBakingSkyboxTexture,
} from "@/processes/texture-baking";
import {
  type GradientState,
  useWorkspaceStore,
  type WorkspaceView,
} from "@/store/workspace-store";

type ThreeWorkspaceSceneProps = {
  mode: WorkspaceView;
};

export function ThreeWorkspaceScene({ mode }: ThreeWorkspaceSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderRef = useRef<(() => void) | null>(null);
  const skyboxTextureRef = useRef<BakedSkyboxTexture | null>(null);
  const updateSkyboxRef = useRef<((nextGradient: GradientState) => void) | null>(null);
  const gradient = useWorkspaceStore((state) => state.gradient);

  useEffect(() => {
    renderRef.current?.();
  }, [mode]);

  useEffect(() => {
    if (!updateSkyboxRef.current) {
      return;
    }

    updateSkyboxRef.current(gradient);
  }, [gradient]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;

    if (!container || !canvas) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas,
      preserveDrawingBuffer: true,
    });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    const initialSkyboxTexture = createTextureBakingSkyboxTexture(gradient);
    const cameraRotation = new THREE.Euler(0.08, -0.35, 0, "YXZ");
    const pointerState = {
      id: -1,
      pitch: cameraRotation.x,
      previousX: 0,
      previousY: 0,
      yaw: cameraRotation.y,
    };

    scene.background = initialSkyboxTexture;
    skyboxTextureRef.current = initialSkyboxTexture;
    camera.position.set(0, 0, 0);
    camera.rotation.copy(cameraRotation);
    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const render = () => {
      renderer.render(scene, camera);
    };

    renderRef.current = render;

    updateSkyboxRef.current = (nextGradient) => {
      const previousTexture = skyboxTextureRef.current;
      const nextTexture = createTextureBakingSkyboxTexture(nextGradient);

      scene.background = nextTexture;
      skyboxTextureRef.current = nextTexture;
      previousTexture?.dispose();
      render();
    };

    const applyCameraRotation = () => {
      cameraRotation.set(pointerState.pitch, pointerState.yaw, 0, "YXZ");
      camera.rotation.copy(cameraRotation);
      render();
    };

    const releasePointer = (event: PointerEvent) => {
      if (pointerState.id !== event.pointerId) {
        return;
      }

      pointerState.id = -1;
      canvas.style.cursor = "grab";

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      pointerState.id = event.pointerId;
      pointerState.previousX = event.clientX;
      pointerState.previousY = event.clientY;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pointerState.id !== event.pointerId) {
        return;
      }

      event.preventDefault();
      const deltaX = event.clientX - pointerState.previousX;
      const deltaY = event.clientY - pointerState.previousY;
      const pitchLimit = Math.PI / 2 - 0.01;

      pointerState.previousX = event.clientX;
      pointerState.previousY = event.clientY;
      pointerState.yaw -= deltaX * 0.006;
      pointerState.pitch = THREE.MathUtils.clamp(
        pointerState.pitch - deltaY * 0.006,
        -pitchLimit,
        pitchLimit
      );
      applyCameraRotation();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", releasePointer);
    canvas.addEventListener("pointercancel", releasePointer);
    canvas.addEventListener("lostpointercapture", releasePointer);

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
    resize();

    return () => {
      renderRef.current = null;
      updateSkyboxRef.current = null;
      skyboxTextureRef.current = null;
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", releasePointer);
      canvas.removeEventListener("pointercancel", releasePointer);
      canvas.removeEventListener("lostpointercapture", releasePointer);
      resizeObserver.disconnect();
      const currentSkyboxTexture = scene.background;

      if (currentSkyboxTexture instanceof THREE.Texture) {
        currentSkyboxTexture.dispose();
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
    </div>
  );
}

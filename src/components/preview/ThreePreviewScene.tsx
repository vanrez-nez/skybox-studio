import { useEffect, useRef } from "react";
import * as THREE from "three";

export function ThreePreviewScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;

    if (!container || !canvas) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas,
    });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);

    camera.position.set(0, 0, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const render = () => {
      renderer.render(scene, camera);
    };

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
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-background"
    >
      <canvas
        ref={canvasRef}
        aria-label="Empty skybox preview scene"
        className="block h-full w-full"
      />
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-muted-foreground">
        <span>Preview</span>
      </div>
    </div>
  );
}

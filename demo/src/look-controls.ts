// Minimal drag-to-look + scroll-to-zoom controller for an at-origin skybox camera.
// Structurally typed so it works with both `three` and `three/webgpu` cameras
// (no THREE import — avoids cross-package type conflicts).
type LookCamera = {
  fov: number;
  lookAt: (x: number, y: number, z: number) => void;
  updateProjectionMatrix: () => void;
};

export function createLookControls(camera: LookCamera, dom: HTMLElement) {
  let lon = 0;
  let lat = 0;
  let dragging = false;
  let pointerX = 0;
  let pointerY = 0;

  const onPointerDown = (event: PointerEvent) => {
    dragging = true;
    pointerX = event.clientX;
    pointerY = event.clientY;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) {
      return;
    }

    lon -= (event.clientX - pointerX) * 0.15;
    lat += (event.clientY - pointerY) * 0.15;
    lat = Math.max(-85, Math.min(85, lat));
    pointerX = event.clientX;
    pointerY = event.clientY;
  };

  const onPointerUp = () => {
    dragging = false;
  };

  const onWheel = (event: WheelEvent) => {
    camera.fov = Math.max(30, Math.min(100, camera.fov + event.deltaY * 0.05));
    camera.updateProjectionMatrix();
  };

  dom.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  dom.addEventListener("wheel", onWheel, { passive: true });

  return {
    update() {
      const phi = ((90 - lat) * Math.PI) / 180;
      const theta = (lon * Math.PI) / 180;

      camera.lookAt(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
      );
    },
    dispose() {
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("wheel", onWheel);
    },
  };
}

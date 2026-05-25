import * as THREE from "three/webgpu";

type SkyboxOrbitControlsEvent = "change" | "end" | "start";
type SkyboxOrbitControlsListener = () => void;

const EPSILON = 0.000001;
const DEFAULT_DAMPING_FACTOR = 0.08;
const DEFAULT_ROTATE_SPEED = 0.006;
const RIGHT_MOUSE_BUTTON = 2;

const worldUp = new THREE.Vector3(0, 1, 0);
const cameraPitchAxis = new THREE.Vector3(1, 0, 0);
const yawQuaternion = new THREE.Quaternion();
const pitchQuaternion = new THREE.Quaternion();
const pitchAxis = new THREE.Vector3();

export class SkyboxOrbitControls {
  dampingFactor = DEFAULT_DAMPING_FACTOR;
  enabled = true;
  rotateSpeed = DEFAULT_ROTATE_SPEED;

  #animationFrameId: number | null = null;
  #camera: THREE.PerspectiveCamera;
  #domElement: HTMLElement;
  #listeners = new Map<SkyboxOrbitControlsEvent, Set<SkyboxOrbitControlsListener>>();
  #pointerId = -1;
  #previousX = 0;
  #previousY = 0;
  #velocityX = 0;
  #velocityY = 0;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.#camera = camera;
    this.#domElement = domElement;

    this.#domElement.addEventListener("contextmenu", this.#onContextMenu);
    this.#domElement.addEventListener("pointercancel", this.#onPointerEnd);
    this.#domElement.addEventListener("pointerdown", this.#onPointerDown);
    this.#domElement.addEventListener("lostpointercapture", this.#onPointerEnd);
    this.#domElement.addEventListener("pointermove", this.#onPointerMove);
    this.#domElement.addEventListener("pointerup", this.#onPointerEnd);
  }

  get isDragging() {
    return this.#pointerId !== -1;
  }

  addEventListener(type: SkyboxOrbitControlsEvent, listener: SkyboxOrbitControlsListener) {
    const listeners = this.#listeners.get(type) ?? new Set<SkyboxOrbitControlsListener>();

    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  dispose() {
    this.stop();
    this.#domElement.removeEventListener("contextmenu", this.#onContextMenu);
    this.#domElement.removeEventListener("pointercancel", this.#onPointerEnd);
    this.#domElement.removeEventListener("pointerdown", this.#onPointerDown);
    this.#domElement.removeEventListener("lostpointercapture", this.#onPointerEnd);
    this.#domElement.removeEventListener("pointermove", this.#onPointerMove);
    this.#domElement.removeEventListener("pointerup", this.#onPointerEnd);
    this.#listeners.clear();
  }

  removeEventListener(type: SkyboxOrbitControlsEvent, listener: SkyboxOrbitControlsListener) {
    this.#listeners.get(type)?.delete(listener);
  }

  stop() {
    const pointerId = this.#pointerId;

    if (pointerId !== -1 && this.#domElement.hasPointerCapture(pointerId)) {
      this.#domElement.releasePointerCapture(pointerId);
    }

    this.#velocityX = 0;
    this.#velocityY = 0;
    this.#pointerId = -1;

    if (this.#animationFrameId !== null) {
      window.cancelAnimationFrame(this.#animationFrameId);
      this.#animationFrameId = null;
    }
  }

  update() {
    if (this.isDragging || !this.enabled) {
      return false;
    }

    if (Math.abs(this.#velocityX) < EPSILON && Math.abs(this.#velocityY) < EPSILON) {
      this.#velocityX = 0;
      this.#velocityY = 0;
      return false;
    }

    this.#rotate(this.#velocityX, this.#velocityY);
    this.#velocityX *= 1 - this.dampingFactor;
    this.#velocityY *= 1 - this.dampingFactor;
    this.#dispatchEvent("change");

    return true;
  }

  #dispatchEvent(type: SkyboxOrbitControlsEvent) {
    this.#listeners.get(type)?.forEach((listener) => listener());
  }

  #onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  #onPointerDown = (event: PointerEvent) => {
    if (!this.enabled || event.button !== RIGHT_MOUSE_BUTTON || this.isDragging) {
      return;
    }

    event.preventDefault();
    this.stop();
    this.#pointerId = event.pointerId;
    this.#previousX = event.clientX;
    this.#previousY = event.clientY;
    this.#domElement.style.cursor = "grabbing";
    this.#domElement.setPointerCapture(event.pointerId);
    this.#dispatchEvent("start");
  };

  #onPointerEnd = (event: PointerEvent) => {
    if (event.pointerId !== this.#pointerId) {
      return;
    }

    this.#pointerId = -1;
    this.#domElement.style.cursor = "grab";

    if (this.#domElement.hasPointerCapture(event.pointerId)) {
      this.#domElement.releasePointerCapture(event.pointerId);
    }

    this.#dispatchEvent("end");
    this.#scheduleUpdate();
  };

  #onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.#pointerId) {
      return;
    }

    event.preventDefault();

    const deltaX = event.clientX - this.#previousX;
    const deltaY = event.clientY - this.#previousY;

    this.#previousX = event.clientX;
    this.#previousY = event.clientY;
    this.#velocityX = deltaX * this.rotateSpeed;
    this.#velocityY = deltaY * this.rotateSpeed;
    this.#rotate(this.#velocityX, this.#velocityY);
    this.#dispatchEvent("change");
  };

  #rotate(yaw: number, pitch: number) {
    yawQuaternion.setFromAxisAngle(worldUp, yaw);
    this.#camera.quaternion.premultiply(yawQuaternion);

    pitchAxis.copy(cameraPitchAxis).applyQuaternion(this.#camera.quaternion).normalize();
    pitchQuaternion.setFromAxisAngle(pitchAxis, pitch);
    this.#camera.quaternion.premultiply(pitchQuaternion);
    this.#camera.updateMatrixWorld();
  }

  #scheduleUpdate() {
    if (this.#animationFrameId !== null) {
      return;
    }

    const tick = () => {
      if (!this.update()) {
        this.#animationFrameId = null;
        return;
      }

      this.#animationFrameId = window.requestAnimationFrame(tick);
    };

    this.#animationFrameId = window.requestAnimationFrame(tick);
  }
}

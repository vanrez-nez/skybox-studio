import {
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

import { cn } from "@/lib/utils";

// Canvas bubble projection adapted from joezappie/three-orientation-gizmo (MIT).
type QuaternionTuple = [number, number, number, number];
type VectorTuple = [number, number, number];

type RotationGizmoProps = {
  onAxisSelect: (direction: VectorTuple) => void;
  onReset: () => void;
  orientation: QuaternionTuple;
};

type Bubble = {
  axis: string;
  color: [string, string];
  direction: THREE.Vector3;
  label?: string;
  line?: number;
  position: THREE.Vector3;
  size: number;
};

const GIZMO_SIZE = 90;
const GIZMO_PADDING = 8;
const PRIMARY_BUBBLE_SIZE = 10;
const SECONDARY_BUBBLE_SIZE = 7;
const LINE_WIDTH = 2;
const LABEL_FONT = "bold 10px Arial";
const CENTER = new THREE.Vector3(GIZMO_SIZE / 2, GIZMO_SIZE / 2, 0);
const RING_ACTIVE_INNER_RADIUS = GIZMO_SIZE / 2;

const BUBBLES: Bubble[] = [
  {
    axis: "x",
    color: ["#f73c3c", "#942424"],
    direction: new THREE.Vector3(1, 0, 0),
    label: "X",
    line: LINE_WIDTH,
    position: new THREE.Vector3(),
    size: PRIMARY_BUBBLE_SIZE,
  },
  {
    axis: "y",
    color: ["#6ccb26", "#417a17"],
    direction: new THREE.Vector3(0, 1, 0),
    label: "Y",
    line: LINE_WIDTH,
    position: new THREE.Vector3(),
    size: PRIMARY_BUBBLE_SIZE,
  },
  {
    axis: "z",
    color: ["#178cf0", "#0e5490"],
    direction: new THREE.Vector3(0, 0, 1),
    label: "Z",
    line: LINE_WIDTH,
    position: new THREE.Vector3(),
    size: PRIMARY_BUBBLE_SIZE,
  },
  {
    axis: "-x",
    color: ["#f73c3c", "#942424"],
    direction: new THREE.Vector3(-1, 0, 0),
    position: new THREE.Vector3(),
    size: SECONDARY_BUBBLE_SIZE,
  },
  {
    axis: "-y",
    color: ["#6ccb26", "#417a17"],
    direction: new THREE.Vector3(0, -1, 0),
    position: new THREE.Vector3(),
    size: SECONDARY_BUBBLE_SIZE,
  },
  {
    axis: "-z",
    color: ["#178cf0", "#0e5490"],
    direction: new THREE.Vector3(0, 0, -1),
    position: new THREE.Vector3(),
    size: SECONDARY_BUBBLE_SIZE,
  },
];

function getBubblePosition(position: THREE.Vector3) {
  const radius = CENTER.x - PRIMARY_BUBBLE_SIZE / 2 - GIZMO_PADDING;

  return new THREE.Vector3(
    position.x * radius + CENTER.x,
    CENTER.y - position.y * radius,
    position.z
  );
}

function drawCircle(
  context: CanvasRenderingContext2D,
  point: THREE.Vector3,
  radius: number,
  color: string
) {
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.closePath();
}

function drawLine(
  context: CanvasRenderingContext2D,
  start: THREE.Vector3,
  end: THREE.Vector3,
  width: number,
  color: string
) {
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.lineWidth = width;
  context.strokeStyle = color;
  context.stroke();
  context.closePath();
}

function drawCenteredText(context: CanvasRenderingContext2D, text: string, point: THREE.Vector3) {
  context.font = LABEL_FONT;
  context.fillStyle = "#151515";
  context.textAlign = "center";
  context.textBaseline = "alphabetic";

  const metrics = context.measureText(text);
  const centerOffset = (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;

  context.fillText(text, point.x, point.y + centerOffset);
}

function getCanvasPoint(event: MouseEvent<HTMLCanvasElement>) {
  const rect = event.currentTarget.getBoundingClientRect();

  return new THREE.Vector3(event.clientX - rect.left, event.clientY - rect.top, 0);
}

export function RotationGizmo({ onAxisSelect, onReset, orientation }: RotationGizmoProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedBubbleRef = useRef<Bubble | null>(null);
  const [mouse, setMouse] = useState<THREE.Vector3 | null>(null);
  const [isGizmoHovered, setIsGizmoHovered] = useState(false);
  const [isRingHovered, setIsRingHovered] = useState(false);
  const [isRingPressed, setIsRingPressed] = useState(false);
  const isRingActive = isRingHovered || isRingPressed;
  const layers = useMemo(() => {
    const inverseCameraQuaternion = new THREE.Quaternion(...orientation).invert();

    return BUBBLES.map((bubble) => ({
      ...bubble,
      position: getBubblePosition(bubble.direction.clone().applyQuaternion(inverseCameraQuaternion)),
    })).sort((firstBubble, secondBubble) => firstBubble.position.z - secondBubble.position.z);
  }, [orientation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const pixelRatio = Math.min(window.devicePixelRatio, 2);

    canvas.width = GIZMO_SIZE * pixelRatio;
    canvas.height = GIZMO_SIZE * pixelRatio;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, GIZMO_SIZE, GIZMO_SIZE);

    selectedBubbleRef.current = null;

    if (mouse) {
      let closestDistance = Number.POSITIVE_INFINITY;

      layers.forEach((bubble) => {
        const distance = mouse.distanceTo(bubble.position);

        if (distance < closestDistance) {
          closestDistance = distance;
          selectedBubbleRef.current = bubble;
        }
      });
    }

    layers.forEach((bubble) => {
      const isSelected = selectedBubbleRef.current === bubble;
      const color = isSelected
        ? "#ffffff"
        : bubble.position.z >= -0.01
          ? bubble.color[0]
          : bubble.color[1];

      drawCircle(context, bubble.position, bubble.size, color);

      if (bubble.line) {
        drawLine(context, CENTER, bubble.position, bubble.line, color);
      }

      if (bubble.label) {
        drawCenteredText(context, bubble.label, bubble.position);
      }
    });
  }, [layers, mouse]);

  const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    event.stopPropagation();

    const clickPoint = getCanvasPoint(event);
    let selectedBubble = selectedBubbleRef.current;

    if (!selectedBubble) {
      let closestDistance = Number.POSITIVE_INFINITY;

      layers.forEach((bubble) => {
        const distance = clickPoint.distanceTo(bubble.position);

        if (distance < closestDistance) {
          closestDistance = distance;
          selectedBubble = bubble;
        }
      });
    }

    if (!selectedBubble) {
      return;
    }

    onAxisSelect([
      selectedBubble.direction.x,
      selectedBubble.direction.y,
      selectedBubble.direction.z,
    ]);
  };

  const updateRingHover = (clientX: number, clientY: number) => {
    const root = rootRef.current;

    if (!root) {
      return false;
    }

    const rect = root.getBoundingClientRect();
    const x = clientX - rect.left - rect.width / 2;
    const y = clientY - rect.top - rect.height / 2;
    const distance = Math.hypot(x, y);
    const isHoveringRing = distance >= RING_ACTIVE_INNER_RADIUS && distance <= rect.width / 2;

    setIsRingHovered(isHoveringRing);

    return isHoveringRing;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    setIsRingPressed(updateRingHover(event.clientX, event.clientY));
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    setIsGizmoHovered(true);
    updateRingHover(event.clientX, event.clientY);
  };

  return (
    <div
      ref={rootRef}
      aria-label="Rotation gizmo"
      className={cn(
        "absolute top-3 right-3 z-10 flex size-[99px] cursor-pointer items-center justify-center rounded-full border-[3px] shadow-none transition-[background-color,border-color] duration-150 ease-out",
        isGizmoHovered ? "bg-card/50" : "bg-card/15",
        !isGizmoHovered
          ? "border-transparent"
          : isRingActive
            ? "border-white/80"
            : "border-card/60"
      )}
      onClick={onReset}
      onPointerCancel={() => setIsRingPressed(false)}
      onPointerDown={handlePointerDown}
      onPointerEnter={() => setIsGizmoHovered(true)}
      onPointerLeave={() => {
        setIsGizmoHovered(false);
        setIsRingHovered(false);
        setIsRingPressed(false);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={() => setIsRingPressed(false)}
      role="application"
    >
      <canvas
        ref={canvasRef}
        className="block size-[90px] cursor-pointer rounded-full"
        height={GIZMO_SIZE}
        onClick={handleClick}
        onMouseLeave={() => setMouse(null)}
        onMouseMove={(event) => {
          updateRingHover(event.clientX, event.clientY);
          setMouse(getCanvasPoint(event));
        }}
        width={GIZMO_SIZE}
      />
    </div>
  );
}

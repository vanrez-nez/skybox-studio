import { useEffect, useRef, useState } from "react";

export function AppFooter() {
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const lastSampleTimeRef = useRef(performance.now());

  useEffect(() => {
    let animationFrameId = 0;

    const sampleFps = (timestamp: number) => {
      frameCountRef.current += 1;

      const elapsed = timestamp - lastSampleTimeRef.current;

      if (elapsed >= 500) {
        setFps(Math.round((frameCountRef.current * 1000) / elapsed));
        frameCountRef.current = 0;
        lastSampleTimeRef.current = timestamp;
      }

      animationFrameId = window.requestAnimationFrame(sampleFps);
    };

    animationFrameId = window.requestAnimationFrame(sampleFps);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <footer
      aria-label="Status bar"
      className="h-9 w-full bg-sidebar px-2 py-1"
    >
      <strong>fps</strong>: {fps}
    </footer>
  );
}

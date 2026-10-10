"use client";

import { useEffect, useRef } from "react";
import { drawScene } from "@/core/rendering/canvas2d";
import type { SceneDocument } from "@/core/scenes/schema";

export function SceneCanvas({ scene, playing = true }: { scene: SceneDocument; playing?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const time = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = 0;
    let width = 1;
    let height = 1;
    let disposed = false;

    const render = (now: number) => {
      if (disposed) return;
      if (playing && last) time.current += Math.min((now - last) / 1000, 0.05);
      last = now;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawScene(ctx, width, height, scene, time.current);
      if (playing && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        raf = requestAnimationFrame(render);
      }
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      cancelAnimationFrame(raf);
      last = 0;
      raf = requestAnimationFrame(render);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [scene, playing]);

  return <div className="scene-frame"><canvas ref={ref} role="img" aria-label={"Visualization of " + scene.title} /></div>;
}

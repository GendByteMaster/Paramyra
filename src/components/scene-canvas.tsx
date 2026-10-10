"use client";

import { useEffect, useRef, type PointerEvent, type WheelEvent } from "react";
import { drawDocument, defaultView, type CanvasView } from "@/core/rendering/canvas2d";
import { documentFromScene, type MathDocument } from "@/core/document/schema";
import type { SceneDocument } from "@/core/scenes/schema";

type Props = {
  scene: SceneDocument | MathDocument;
  playing?: boolean;
  zoom?: number;
  view?: CanvasView;
  time?: number;
  duration?: number;
  speed?: number;
  seekVersion?: number;
  onTimeChange?: (time: number) => void;
  onPanChange?: (x: number, y: number) => void;
  onWheelZoom?: (nextZoom: number) => void;
};

export function SceneCanvas(props: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  const timeRef = useRef(props.time ?? 0);
  const drag = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  useEffect(() => { propsRef.current = props; });
  useEffect(() => {
    timeRef.current = props.time ?? 0;
    // Explicit scrubbing only. Ordinary time labels must not restart the animation clock.
  }, [props.seekVersion]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let width = 1, height = 1, raf = 0, last = 0, notified = 0, active = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const render = (now: number) => {
      if (!active) return;
      const p = propsRef.current;
      if (p.playing && !reduced.matches && last > 0) {
        const duration = p.duration ?? 12;
        timeRef.current = (timeRef.current + Math.min((now - last)/1000, .05) * (p.speed ?? 1)) % duration;
      }
      last = now;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      const doc = "layers" in p.scene ? p.scene : documentFromScene(p.scene);
      drawDocument(ctx, width, height, doc, timeRef.current, p.view ?? { ...defaultView, zoom: p.zoom ?? 1 });
      if (now - notified >= 100 && p.onTimeChange) {
        notified = now;
        p.onTimeChange(timeRef.current);
      }
      raf = requestAnimationFrame(render);
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    raf = requestAnimationFrame(render);
    return () => { active = false; cancelAnimationFrame(raf); observer.disconnect(); };
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!props.onPanChange || event.button !== 0) return;
    drag.current = { startX: event.clientX, startY: event.clientY, panX: props.view?.pan.x ?? 0, panY: props.view?.pan.y ?? 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current || !props.onPanChange) return;
    const d = drag.current;
    props.onPanChange(
      Math.max(-1600,Math.min(1600,d.panX + event.clientX - d.startX)),
      Math.max(-1600,Math.min(1600,d.panY + event.clientY - d.startY)),
    );
  };
  const onPointerUp = () => { drag.current = null; };
  const onWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    if (!props.onWheelZoom) return;
    // A non-passive React wheel event allows this interaction without page scroll.
    event.preventDefault();
    const current = props.view?.zoom ?? props.zoom ?? 1;
    props.onWheelZoom(Math.max(.5,Math.min(2, Math.round((current + (event.deltaY < 0 ? .1 : -.1))*100)/100)));
  };

  const name = "layers" in props.scene ? props.scene.title : props.scene.title;
  return <div className="scene-frame">
    <canvas
      ref={ref} role="img" aria-label={"Visualization of "+name}
      style={{ touchAction: props.onPanChange ? "none" : undefined, cursor: props.onPanChange ? "grab" : undefined }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onLostPointerCapture={onPointerUp}
      onWheel={onWheel}
    />
  </div>;
}

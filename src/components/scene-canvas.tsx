"use client";

import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { drawDocument, defaultView, type CanvasView } from "@/core/rendering/canvas2d";
import { clampZoom, hitTestLayer, pixelScale, zoomAt, type Camera, type Size } from "@/core/rendering/geometry";
import { documentFromScene, type MathDocument } from "@/core/document/schema";
import { resolveLiveScene, type CompiledGraph } from "@/core/graph/live";
import type { SceneDocument } from "@/core/scenes/schema";

type Props = {
  scene: SceneDocument | MathDocument;
  liveGraph?: CompiledGraph | null;
  playing?: boolean;
  zoom?: number;
  view?: CanvasView;
  time?: number;
  duration?: number;
  speed?: number;
  seekVersion?: number;
  tool?: "select" | "pan";
  selectedLayerId?: string;
  onSelectLayer?: (id: string) => void;
  onLayerOffsetChange?: (id: string, x: number, y: number) => void;
  onLayerMoveStart?: (id: string) => void;
  onLayerMoveEnd?: (id: string) => void;
  onSizeChange?: (size: Size) => void;
  onTimeChange?: (time: number) => void;
  onPanChange?: (x: number, y: number) => void;
  onCameraChange?: (camera: Camera) => void;
};

type Drag =
  | { mode: "pan"; pointerId: number; startX: number; startY: number; panX: number; panY: number }
  | { mode: "layer"; pointerId: number; startX: number; startY: number; layerId: string;
      offsetX: number; offsetY: number; scale: number };

const clampOffset = (v: number) => Math.round(Math.max(-2, Math.min(2, v)) * 10000) / 10000;

export function SceneCanvas(props: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  const timeRef = useRef(props.time ?? 0);
  const wakeRef = useRef<() => void>(() => {});
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    propsRef.current = props;
    wakeRef.current();
  }, [props]);
  useEffect(() => {
    timeRef.current = props.time ?? 0;
    wakeRef.current();
    // The displayed time label is throttled; only explicit seeks reset the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.seekVersion]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let width = 1, height = 1, raf = 0, last = 0, notified = 0, active = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wake = () => { if (active && !raf && !document.hidden) raf = requestAnimationFrame(render); };
    const render = (now: number) => {
      raf = 0;
      if (!active) return;
      const p = propsRef.current;
      if (p.playing && !reduced.matches && last > 0) {
        const duration = p.duration ?? 12;
        timeRef.current = (timeRef.current + Math.min((now - last) / 1000, .05) * (p.speed ?? 1)) % duration;
      }
      last = now;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const doc = "layers" in p.scene ? p.scene : documentFromScene(p.scene);
      const view = p.view ?? { ...defaultView, zoom: p.zoom ?? 1 };
      drawDocument(ctx, width, height, doc, timeRef.current, { ...view, selectedLayerId: p.selectedLayerId }, false, p.liveGraph);
      if (now - notified >= 100 && p.onTimeChange) {
        notified = now;
        p.onTimeChange(timeRef.current);
      }
      if (p.playing && !reduced.matches) wake();
    };
    wakeRef.current = wake;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      propsRef.current.onSizeChange?.({ width, height });
      wake();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    document.addEventListener("visibilitychange", wake);
    reduced.addEventListener("change", wake);
    return () => {
      active = false; wakeRef.current = () => {};
      cancelAnimationFrame(raf); observer.disconnect();
      document.removeEventListener("visibilitychange", wake);
      reduced.removeEventListener("change", wake);
    };
  }, []);

  const canvasPoint = (event: { clientX: number; clientY: number }) => {
    const rect = ref.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    const p = propsRef.current;
    const rect = event.currentTarget.getBoundingClientRect();
    const size = { width: rect.width, height: rect.height };
    const camera = p.view ?? { ...defaultView, zoom: p.zoom ?? 1 };
    const point = canvasPoint(event);
    const scene = "layers" in p.scene ? p.scene : documentFromScene(p.scene);
    const shouldPan = event.button === 1 || event.altKey || p.tool === "pan";
    const id = shouldPan ? null : hitTestLayer(resolveLiveScene(scene,timeRef.current,p.liveGraph??null).document, timeRef.current, size, camera, point);
    if (id && p.onLayerOffsetChange) {
      const layer = scene.layers.find(l => l.id === id)!;
      p.onLayerMoveStart?.(id);
      p.onSelectLayer?.(id);
      drag.current = { mode: "layer", pointerId: event.pointerId, startX: event.clientX,
        startY: event.clientY, layerId: id, offsetX: layer.offset.x, offsetY: layer.offset.y,
        scale: pixelScale(size, camera.zoom) };
    } else if (p.onPanChange) {
      drag.current = { mode: "pan", pointerId: event.pointerId, startX: event.clientX,
        startY: event.clientY, panX: camera.pan.x, panY: camera.pan.y };
    } else return;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d || event.pointerId !== d.pointerId) return;
    const p = propsRef.current;
    if (d.mode === "pan") {
      p.onPanChange?.(d.panX + event.clientX - d.startX, d.panY + event.clientY - d.startY);
    } else {
      p.onLayerOffsetChange?.(d.layerId,
        clampOffset(d.offsetX + (event.clientX - d.startX) / d.scale),
        clampOffset(d.offsetY - (event.clientY - d.startY) / d.scale));
    }
  };
  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (current.mode === "layer") propsRef.current.onLayerMoveEnd?.(current.layerId);
  };

  const onWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    if (!props.onCameraChange) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const camera = props.view ?? { ...defaultView, zoom: props.zoom ?? 1 };
    const next = clampZoom(camera.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12));
    props.onCameraChange(zoomAt(canvasPoint(event), { width: rect.width, height: rect.height }, camera, next));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (!props.selectedLayerId || !props.onLayerOffsetChange || event.altKey || event.ctrlKey || event.metaKey) return;
    const keys: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1],
    };
    const direction = keys[event.key];
    if (!direction || !("layers" in props.scene)) return;
    const layer = props.scene.layers.find(l => l.id === props.selectedLayerId);
    if (!layer) return;
    event.preventDefault();
    const step = event.shiftKey ? 0.2 : 0.05;
    props.onLayerOffsetChange(layer.id,
      clampOffset(layer.offset.x + direction[0] * step),
      clampOffset(layer.offset.y + direction[1] * step));
  };

  return <div className="scene-frame">
    <canvas
      ref={ref} role="img" tabIndex={0} aria-label={"Visualization of " + props.scene.title}
      title="Select a curve to move it; Alt+drag pans; arrow keys move the selected curve."
      style={{ touchAction: props.onPanChange ? "none" : undefined, cursor: props.tool === "pan" ? "grab" : "crosshair" }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onLostPointerCapture={onPointerUp}
      onWheel={onWheel} onKeyDown={onKeyDown}
    />
  </div>;
}

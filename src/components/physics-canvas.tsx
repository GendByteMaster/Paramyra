"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import type { PhysicsProject } from "@/core/physics/model/schema";
import type { SimulationFrame } from "@/core/physics/engine/simulation";
import { drawPhysicsScene, DARK_PHYSICS_PALETTE, LIGHT_PHYSICS_PALETTE } from "@/core/physics/rendering/canvas";
import { clampPhysicsZoom, fitPhysicsCamera, type PhysicsCamera, type PhysicsSize, zoomPhysicsAt } from "@/core/physics/rendering/geometry";

export type PhysicsCanvasProps = {
  project: PhysicsProject;
  frame: SimulationFrame | null;
  samples: SimulationFrame[];
  onCameraChange?: (camera: { x: number; y: number; zoom: number }) => void;
};

type PanGesture = Readonly<{ pointerId: number; clientX: number; clientY: number; camera: PhysicsCamera }>;

function readTheme(canvas: HTMLCanvasElement): typeof DARK_PHYSICS_PALETTE {
  const rootStyle = getComputedStyle(document.documentElement);
  const canvasStyle = getComputedStyle(canvas);
  const scheme = canvasStyle.colorScheme || rootStyle.colorScheme;
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false;
  const allowsLight = scheme.split(/\s+/).includes("light");
  const allowsDark = scheme.split(/\s+/).includes("dark");
  const isLight = scheme === "light" || (allowsLight && allowsDark && prefersLight) || (!allowsDark && prefersLight);
  return isLight ? LIGHT_PHYSICS_PALETTE : DARK_PHYSICS_PALETTE;
}

function frameDescription(frame: SimulationFrame | null): string {
  if (!frame) return "No simulation frame is selected. The canvas shows the experiment layout.";
  return `Time ${frame.time.toPrecision(4)} seconds. Position x ${frame.position.x.toPrecision(4)} metres, y ${frame.position.y.toPrecision(4)} metres. Step ${frame.step}${frame.terminated ? ". Simulation ended." : "."}`;
}

export function PhysicsCanvas({ project, frame, samples, onCameraChange }: PhysicsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ project, frame, samples });
  const sizeRef = useRef<PhysicsSize>({ width: 1, height: 1 });
  const cameraRef = useRef<PhysicsCamera>(project.scene.camera);
  const gestureRef = useRef<PanGesture | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const rafRef = useRef(0);
  const [camera, setCameraState] = useState<PhysicsCamera>(project.scene.camera);
  const descriptionId = useId();
  const sceneCameraX = project.scene.camera.x;
  const sceneCameraY = project.scene.camera.y;
  const sceneCameraZoom = project.scene.camera.zoom;

  const scheduleDraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      drawRef.current();
    });
  }, []);

  const updateCamera = useCallback((next: PhysicsCamera) => {
    const safe = {
      x: Number.isFinite(next.x) ? Math.max(-1_000_000, Math.min(1_000_000, next.x)) : 0,
      y: Number.isFinite(next.y) ? Math.max(-1_000_000, Math.min(1_000_000, next.y)) : 0,
      zoom: clampPhysicsZoom(next.zoom),
    };
    cameraRef.current = safe;
    setCameraState(safe);
    onCameraChange?.(safe);
    scheduleDraw();
  }, [onCameraChange, scheduleDraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let active = true;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      sizeRef.current = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(sizeRef.current.width * ratio);
      canvas.height = Math.round(sizeRef.current.height * ratio);
      scheduleDraw();
    };
    drawRef.current = () => {
      if (!active) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const current = propsRef.current;
      drawPhysicsScene(ctx, sizeRef.current, current.project, current.frame, current.samples, cameraRef.current, readTheme(canvas));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const themeObserver = new MutationObserver(scheduleDraw);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    const motion = window.matchMedia?.("(prefers-color-scheme: light)");
    motion?.addEventListener("change", scheduleDraw);
    resize();
    return () => {
      active = false;
      drawRef.current = () => {};
      observer.disconnect();
      themeObserver.disconnect();
      motion?.removeEventListener("change", scheduleDraw);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [scheduleDraw]);

  useEffect(() => {
    propsRef.current = { project, frame, samples };
    scheduleDraw();
  }, [project, frame, samples, scheduleDraw]);

  useEffect(() => {
    const saved = { x: sceneCameraX, y: sceneCameraY, zoom: sceneCameraZoom };
    if (saved.x !== cameraRef.current.x || saved.y !== cameraRef.current.y || saved.zoom !== cameraRef.current.zoom) {
      cameraRef.current = saved;
      setCameraState(saved);
      scheduleDraw();
    }
  }, [sceneCameraX, sceneCameraY, sceneCameraZoom, scheduleDraw]);

  const localPoint = (event: { clientX: number; clientY: number }, element: HTMLCanvasElement) => {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    gestureRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, camera: cameraRef.current };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const scale = Math.max(1e-6, Math.min(sizeRef.current.width, sizeRef.current.height, 800) / 8 * gesture.camera.zoom);
    updateCamera({
      ...gesture.camera,
      x: gesture.camera.x - (event.clientX - gesture.clientX) / scale,
      y: gesture.camera.y + (event.clientY - gesture.clientY) / scale,
    });
  };

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (gestureRef.current?.pointerId === event.pointerId) gestureRef.current = null;
  };

  const onWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const delta = Math.max(-500, Math.min(500, event.deltaY));
    const zoom = clampPhysicsZoom(cameraRef.current.zoom * Math.exp(-delta * 0.0015));
    updateCamera(zoomPhysicsAt(localPoint(event, event.currentTarget), sizeRef.current, cameraRef.current, zoom));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const current = cameraRef.current;
    const step = 40 / Math.max(1e-6, Math.min(sizeRef.current.width, sizeRef.current.height, 800) / 8 * current.zoom);
    if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      updateCamera({ ...current,
        x: current.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
        y: current.y + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0),
      });
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault(); updateCamera({ ...current, zoom: clampPhysicsZoom(current.zoom * 1.2) });
    } else if (event.key === "-") {
      event.preventDefault(); updateCamera({ ...current, zoom: clampPhysicsZoom(current.zoom / 1.2) });
    } else if (event.key === "0") {
      event.preventDefault(); updateCamera(project.scene.camera);
    } else if (event.key.toLowerCase() === "f") {
      event.preventDefault(); updateCamera(fitPhysicsCamera(project, samples, frame, sizeRef.current, current));
    }
  };

  const fit = () => updateCamera(fitPhysicsCamera(project, samples, frame, sizeRef.current, cameraRef.current));
  const reset = () => updateCamera(project.scene.camera);
  const buttonStyle = {
    minHeight: 44,
    padding: "0 13px",
    borderRadius: 9,
    border: "1px solid var(--border-strong, rgba(197, 217, 248, .24))",
    background: "var(--surface-raised, rgba(16, 25, 37, .96))",
    color: "var(--text, #f4f7ff)",
    fontSize: 12,
    fontWeight: 650,
    boxShadow: "0 3px 14px rgba(0, 0, 0, .16)",
  } as const;

  return <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 300, overflow: "hidden", borderRadius: 14, background: "var(--surface, #0b111a)" }}>
    <canvas
      ref={canvasRef}
      role="img"
      tabIndex={0}
      aria-label={`${project.model.kind === "projectile" ? "Projectile motion" : "Mass–spring oscillator"} physics visualization`}
      aria-describedby={descriptionId}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + - 0 F"
      title="Drag to pan. Use the wheel to zoom at the pointer. Arrow keys pan; + and − zoom; F fits the experiment; 0 resets the view."
      style={{ display: "block", width: "100%", height: "100%", minHeight: 300, touchAction: "none", cursor: "grab", outlineOffset: -3 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
    />
    <div style={{ position: "absolute", zIndex: 1, top: 12, left: 12, display: "flex", flexWrap: "wrap", gap: 8, maxWidth: "calc(100% - 24px)" }}>
      <button type="button" style={buttonStyle} onClick={fit} aria-label="Fit experiment in the canvas">Fit view</button>
      <button type="button" style={buttonStyle} onClick={reset} aria-label="Reset the canvas camera">Reset view</button>
      <output aria-label="Canvas zoom" style={{ alignSelf: "center", minHeight: 36, display: "inline-flex", alignItems: "center", padding: "0 10px", borderRadius: 9, background: "var(--surface-raised, rgba(16, 25, 37, .9))", border: "1px solid var(--border, rgba(197, 217, 248, .12))", color: "var(--text-muted, #a5b4c7)", font: "11px ui-monospace, monospace" }}>{Math.round(camera.zoom * 100)}%</output>
    </div>
    <span id={descriptionId} style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>{frameDescription(frame)}</span>
  </div>;
}

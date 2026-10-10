"use client";

import { useEffect, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowUpRight, Check, CircleDot, Download, Layers3, Pause, Play, RotateCcw, SlidersHorizontal, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { SceneCanvas } from "./scene-canvas";
import { presetFor, presets } from "@/core/scenes/presets";
import { sceneSchema, type SceneDocument, type SceneKind, type SceneParams } from "@/core/scenes/schema";

const KEY = "paramyra.scene.v1";
type NumericParam = keyof SceneParams;

const controls: readonly { key: NumericParam; label: string; min: number; max: number; step: number }[] = [
  { key: "frequencyX", label: "Frequency X", min: 1, max: 12, step: 1 },
  { key: "frequencyY", label: "Frequency Y", min: 1, max: 12, step: 1 },
  { key: "phase", label: "Phase", min: 0, max: 6.2832, step: 0.01 },
  { key: "amplitude", label: "Amplitude", min: 0.1, max: 1, step: 0.01 },
  { key: "strokeWidth", label: "Stroke width", min: 0.5, max: 4, step: 0.1 },
];

const subscribeNoop = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

type StudioProps = { initialKind?: SceneKind; mode?: "studio" | "playground" };

export function StudioClient(props: StudioProps) {
  // Server and first hydration render match. Mount the editable browser workspace afterward.
  const hydrated = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);
  if (!hydrated) return <div className="shell section" role="status">Loading workspace…</div>;
  return <StudioWorkspace {...props} />;
}

function StudioWorkspace({ initialKind, mode = "studio" }: StudioProps) {
  const [scene, setScene] = useState<SceneDocument>(() => {
    if (initialKind) return presetFor(initialKind);
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const parsed = sceneSchema.safeParse(JSON.parse(saved));
        if (parsed.success) return parsed.data;
      }
    } catch { /* unavailable or invalid local storage: use preset */ }
    return presetFor("lissajous");
  });
  const [playing, setPlaying] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(scene)); }
    catch { /* exporting JSON remains available */ }
  }, [scene]);

  const changeParam = (key: NumericParam, value: number) => {
    if (!Number.isFinite(value)) return;
    setScene((old) => ({ ...old, params: { ...old.params, [key]: value } }));
  };

  const changeKind = (kind: SceneKind) => {
    setScene(presetFor(kind));
    setNotice("");
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(scene, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "paramyra-" + scene.kind + ".json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importJSON = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 65536) { setNotice("File exceeds the 64 KB limit."); return; }
    try {
      const parsed = sceneSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) { setNotice("Invalid or unsupported scene document."); return; }
      setScene(parsed.data);
      setNotice("Scene imported.");
    } catch { setNotice("Unable to read scene JSON."); }
  };

  const equation = scene.kind === "lissajous" ? "x = A sin(at + δ), y = B sin(bt)" : scene.kind === "polar-rose" ? "r = a cos(kθ)" : "y = f(x, t)";
  return (
    <div className="shell studio-shell">
      <div className="studio-breadcrumb"><Link href="/explore"><ArrowLeft size={14} aria-hidden="true" /> Explore</Link><span>/</span><span>{mode === "studio" ? "Studio" : "Playground"}</span></div>
      <div className="work-heading">
        <div className="work-heading-main">
          <span className="eyebrow">PARAMYRA / {mode === "studio" ? "CREATIVE WORKSPACE" : "INTERACTIVE LAB"}</span>
          <h1>{mode === "studio" ? "Your mathematical studio" : "The mathematics playground"}<span className="brand-period">.</span></h1>
          <p className="work-subtitle">{mode === "studio" ? "A place for discovery, designed for experimentation." : "Explore how a single parameter can transform the whole equation."}</p>
        </div>
        <div className="studio-actions">
          <span className="saved-indicator"><span className="live-indicator"/> Browser project</span>
          <label className="btn secondary import-button"><Upload size={16} aria-hidden="true" /> Import JSON<input aria-label="Import scene JSON" type="file" accept=".json,application/json" className="sr-only" onChange={importJSON}/></label>
          <button type="button" className="btn primary" onClick={exportJSON}><Download size={16} aria-hidden="true" /> Export JSON</button>
        </div>
      </div>
      <div className="workspace">
        <div className="workspace-main">
          <section className="panel workspace-visual" aria-label="Visualization preview">
            <div className="workspace-topline"><div className="workspace-title"><span className="workspace-icon"><CircleDot size={17}/></span><div><strong>{scene.title}</strong><span>Mathematical canvas · realtime preview</span></div></div><div className="workspace-badges"><span className="badge-live"><span className="live-indicator"/> LIVE</span><span className="badge-2d">2D</span></div></div>
            <div className="workspace-canvas"><SceneCanvas scene={scene} playing={playing}/><span className="canvas-watermark" aria-hidden="true">PARAMYRA / CANVAS 01</span></div>
            <div className="workspace-transport">
              <div className="transport-equation"><span>ACTIVE EQUATION</span><code>{equation}</code></div>
              <div className="controls">
                <button type="button" className="btn transport-play" onClick={() => setPlaying((old) => !old)} aria-label={playing ? "Pause animation" : "Play animation"}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? "Pause" : "Play"}</button>
                <button type="button" className="btn transport-reset" onClick={() => { setScene(presetFor(scene.kind)); setNotice(""); }}><RotateCcw size={15} aria-hidden="true" /> Reset</button>
              </div>
            </div>
          </section>
          <section className="scene-presets" aria-label="Scene presets">
            <div className="presets-heading"><div><span className="eyebrow">QUICK SWITCH</span><h2>Explore another form</h2></div><span>03 SCENES</span></div>
            <div className="presets-grid">{presets.map((item, idx) => <button key={item.kind} type="button" aria-pressed={scene.kind === item.kind} className={"preset-button" + (scene.kind === item.kind ? " selected" : "")} onClick={() => changeKind(item.kind)}>
              <span className="preset-number">0{idx+1}</span><strong>{item.title}</strong>{scene.kind === item.kind ? <Check size={15} aria-label="Selected"/> : <ArrowUpRight size={15} aria-hidden="true"/>}
            </button>)}</div>
          </section>
        </div>
        <aside className="panel inspector" aria-label="Scene inspector">
          <div className="inspector-head"><span className="inspector-icon"><SlidersHorizontal size={21}/></span><div><span className="eyebrow">PROPERTIES</span><h2>Inspector</h2><p>Fine-tune your mathematical world.</p></div></div>
          <div className="inspector-group">
            <div className="inspector-section-title"><Layers3 size={16} aria-hidden="true"/><span>Scene</span><span className="section-index">01</span></div>
            <div className="field"><label htmlFor="scene-kind">Mathematical form</label><select id="scene-kind" value={scene.kind} onChange={(e) => changeKind(e.target.value as SceneKind)}>
              {presets.map((item) => <option key={item.kind} value={item.kind}>{item.title}</option>)}
            </select></div>
            <div className="inspector-code"><span>EXPRESSION</span><code>{equation}</code></div>
          </div>
          <div className="inspector-group">
            <div className="inspector-section-title"><Sparkles size={16} aria-hidden="true"/><span>Parameters</span><span className="section-index">02</span></div>
            {controls.map(({ key, label, min, max, step }) => <div key={key} className="field slider-field">
              <label htmlFor={key}><span>{label}</span><output>{scene.params[key].toFixed(key.startsWith("frequency") ? 0 : 2)}</output></label>
              <input type="range" id={key} min={min} max={max} step={step} value={scene.params[key]} onChange={(e) => changeParam(key, e.target.valueAsNumber)}/>
              <div className="slider-limits" aria-hidden="true"><span>{min}</span><span>{max}</span></div>
            </div>)}
          </div>
          <div className="inspector-group inspector-bottom">
            <div className="inspector-section-title"><ArrowDownToLine size={16} aria-hidden="true"/><span>Project</span><span className="section-index">03</span></div>
            <p className="status" role="status">{notice || (mode === "studio" ? "Changes are kept in your browser. Export a JSON file to keep a backup." : "You are editing the same scene format used by Studio.")}</p>
            <button type="button" className="inspector-export" onClick={exportJSON}>Export current scene <ArrowUpRight size={15} aria-hidden="true"/></button>
          </div>
        </aside>
      </div>
      <div className="studio-bottom-info"><span><span className="live-indicator"/> PARAMYRA ENGINE</span><span>Scene document v1</span><span>CANVAS 2D / LOCAL PROJECT</span></div>
    </div>
  );
}

"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Download, Pause, Play, RotateCcw, Upload } from "lucide-react";
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

export function StudioClient({ initialKind, mode = "studio" }: { initialKind?: SceneKind; mode?: "studio" | "playground" }) {
  const [scene, setScene] = useState<SceneDocument>(() => presetFor(initialKind ?? "lissajous"));
  const [playing, setPlaying] = useState(true);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    // When a specific gallery link is requested, it takes precedence over previous local work.
    if (!initialKind) {
      try {
        const saved = localStorage.getItem(KEY);
        if (saved) {
          const parsed = sceneSchema.safeParse(JSON.parse(saved));
          if (parsed.success) setScene(parsed.data);
        }
      } catch { /* invalid or unavailable browser storage: use preset */ }
    }
    setReady(true);
  }, [initialKind]);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(scene)); }
    catch { /* private browsing or full storage: exporting JSON remains available */ }
  }, [scene, ready]);

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

  return (
    <div className="shell">
      <div className="work-heading">
        <div><span className="eyebrow">{mode === "studio" ? "Creative workspace" : "Experiment freely"}</span><h1>{mode === "studio" ? "Studio" : "Playground"}</h1></div>
        <div className="controls">
          <label className="btn"><Upload size={16} aria-hidden="true" /> Import JSON<input aria-label="Import scene JSON" type="file" accept=".json,application/json" className="sr-only" onChange={importJSON} /></label>
          <button type="button" className="btn" onClick={exportJSON}><Download size={16} aria-hidden="true" /> Export JSON</button>
        </div>
      </div>
      <div className="workspace">
        <section className="panel workspace-visual" aria-label="Visualization preview">
          <SceneCanvas scene={scene} playing={playing} />
          <div className="workspace-caption"><span>{scene.title} · interactive scene</span><div className="controls">
            <button type="button" className="btn" onClick={() => setPlaying((old) => !old)} aria-label={playing ? "Pause animation" : "Play animation"}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "Pause" : "Play"}</button>
            <button type="button" className="btn" onClick={() => { setScene(presetFor(scene.kind)); setNotice(""); }}><RotateCcw size={16} aria-hidden="true" /> Reset</button>
          </div></div>
        </section>
        <aside className="panel inspector" aria-label="Scene inspector">
          <div><span className="eyebrow">Inspector</span><h2>Scene properties</h2></div>
          <div className="field"><label htmlFor="scene-kind">Scene type</label><select id="scene-kind" value={scene.kind} onChange={(e) => changeKind(e.target.value as SceneKind)}>
            {presets.map((item) => <option key={item.kind} value={item.kind}>{item.title}</option>)}
          </select></div>
          {controls.map(({ key, label, min, max, step }) => <div key={key} className="field">
            <label htmlFor={key}><span>{label}</span><output>{scene.params[key].toFixed(key.startsWith("frequency") ? 0 : 2)}</output></label>
            <input type="range" id={key} min={min} max={max} step={step} value={scene.params[key]} onChange={(e) => changeParam(key, e.target.valueAsNumber)} />
          </div>)}
          <p className="status" role="status">{notice || (mode === "studio" ? "Changes are saved locally in this browser. Export a JSON backup anytime." : "Parameters update the same rendering engine used by Studio.")}</p>
        </aside>
      </div>
      <div className="section"><p className="muted">Scene document v1 · Canvas 2D · live mathematical evaluation · no executable user code</p></div>
    </div>
  );
}

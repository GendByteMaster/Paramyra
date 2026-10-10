"use client";

import { useEffect, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, Check, ChevronDown, ChevronUp, CircleDot, Code2, Copy, Download, FileJson2, Info, ListFilter, Maximize2, Minus, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Pause, Play, Plus, RotateCcw, Search, SlidersHorizontal, Upload, Waves } from "lucide-react";
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
  const [libraryOpen, setLibraryOpen] = useState(() => window.matchMedia("(min-width: 960px)").matches);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [detailsTab, setDetailsTab] = useState<"overview" | "json">("overview");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [canvasRevision, setCanvasRevision] = useState(0);

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
    setCanvasRevision((current) => current + 1);
    setNotice("");
    if (window.matchMedia("(max-width: 959px)").matches) setLibraryOpen(false);
  };

  const resetScene = () => {
    setScene(presetFor(scene.kind));
    setCanvasRevision((current) => current + 1);
    setZoom(1);
    setNotice("");
  };

  const copyJSON = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(scene, null, 2));
      setNotice("Scene JSON copied.");
    } catch {
      setNotice("Clipboard unavailable. Use Export JSON.");
    }
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

  const equation = scene.kind === "lissajous" ? "x = A sin(at + δ), y = B sin(bt)" : scene.kind === "polar-rose" ? "r = A cos(kθ)" : "y = f(x, t)";
  const results = presets.filter((item) => (item.title + " " + item.kind).toLowerCase().includes(libraryQuery.toLowerCase().trim()));

  return (
    <div className="pm-workspace" data-mode={mode}>
      <div className="pm-projectbar" role="toolbar" aria-label="Workspace toolbar">
        <div className="pm-project-identity">
          <Link className="pm-icon-btn" href="/explore" aria-label="Back to Explore" title="Back to Explore"><ArrowLeft size={16}/></Link>
          <div className="pm-project-mark"><CircleDot size={19}/></div>
          <div className="pm-project-name">
            <span className="pm-label">PARAMYRA / {mode === "studio" ? "STUDIO" : "PLAYGROUND"}</span>
            <strong>{scene.title} <span className="pm-project-suffix">— Untitled experiment</span></strong>
          </div>
          <span className="pm-local-label"><span className="live-indicator" /> LOCAL</span>
        </div>
        <div className="pm-project-actions">
          <button className="pm-icon-btn" type="button" onClick={() => setLibraryOpen((s) => !s)} title="Toggle scene library" aria-label="Toggle scene library" aria-pressed={libraryOpen}>{libraryOpen ? <PanelLeftClose size={17}/> : <PanelLeftOpen size={17}/>}</button>
          <button className="pm-icon-btn" type="button" onClick={() => setInspectorOpen((s) => !s)} title="Toggle inspector" aria-label="Toggle inspector" aria-pressed={inspectorOpen}>{inspectorOpen ? <PanelRightClose size={17}/> : <PanelRightOpen size={17}/>}</button>
          <span className="pm-toolbar-rule"/>
          <label className="pm-action pm-action-quiet pm-import"><Upload size={15}/> Import <input aria-label="Import scene JSON" type="file" accept=".json,application/json" className="sr-only" onChange={importJSON}/></label>
          <button className="pm-action pm-action-primary" type="button" onClick={exportJSON}><Download size={15}/> Export JSON</button>
        </div>
      </div>

      <div className={"pm-grid" + (!libraryOpen ? " pm-no-library" : "") + (!inspectorOpen ? " pm-no-inspector" : "")}>
        {libraryOpen && <aside className="pm-sidebar" aria-label="Scene library">
          <header className="pm-sidebar-heading">
            <div className="pm-sidebar-mark"><BookOpen size={17}/></div>
            <div><span className="pm-label">LIBRARY</span><h2>Scene Library</h2><p>Explore the mathematical forms.</p></div>
          </header>
          <div className="pm-library-search"><Search size={16} aria-hidden="true"/><input type="search" aria-label="Search mathematical scenes" value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="Search scenes..."/></div>
          <div className="pm-library-group-heading"><span><ListFilter size={14}/> MATHEMATICAL FORMS</span><span>{results.length} / {presets.length}</span></div>
          <div className="pm-library-list">
            {results.map((item,idx)=><button key={item.kind} type="button" className={"pm-library-item" + (scene.kind === item.kind ? " active" : "")} onClick={() => changeKind(item.kind)} aria-pressed={scene.kind === item.kind}>
              <div className="pm-library-thumb"><CircleDot size={21} aria-hidden="true"/><span>0{idx+1}</span></div>
              <div className="pm-library-item-text"><strong>{item.title}</strong><small>{item.kind === "lissajous" ? "Parametric geometry" : item.kind === "wave" ? "Harmonic motion" : "Polar geometry"}</small></div>
              {scene.kind === item.kind ? <Check size={16} aria-label="Selected"/> : <ArrowUpRight size={15} aria-hidden="true"/>}
            </button>)}
            {results.length === 0 && <p className="pm-empty">No scenes match your search.</p>}
          </div>
          <div className="pm-sidebar-bottom">
            <span className="pm-label">CREATIVE WORKSPACE</span>
            <p>Choose a scene to edit its real mathematical parameters.</p>
            <Link href="/explore">View collection <ArrowUpRight size={15}/></Link>
          </div>
        </aside>}

        <div className="pm-center">
          <section className="pm-viewport-panel" aria-label="Visualization preview">
            <div className="pm-viewport-toolbar">
              <div className="pm-viewport-heading"><span className="pm-blue-dot"/><div><strong>{scene.title}</strong><small>Canvas 2D <span>·</span> Realtime mathematical model</small></div></div>
              <div className="pm-viewport-tools">
                <span className="pm-live"><span className="live-indicator"/> LIVE</span>
                <span className="pm-fps-label">SCENE 01 / 01</span>
                <button type="button" className="pm-icon-btn" onClick={() => setDetailsOpen((v)=>!v)} aria-label="Toggle scene details" aria-pressed={detailsOpen} title="Toggle scene details"><Info size={16}/></button>
              </div>
            </div>
            <div className="pm-canvas-area">
              <div className="pm-canvas-surface"><SceneCanvas key={scene.kind + "-" + canvasRevision} scene={scene} playing={playing} zoom={zoom} /></div>
              <div className="pm-canvas-corner" aria-hidden="true">PARAMYRA · 2D ENGINE</div>
              <div className="pm-zoom">
                <button type="button" aria-label="Zoom out" title="Zoom out" onClick={()=>setZoom((z)=>Math.max(0.5,Math.round((z-.25)*100)/100))}><Minus size={16}/></button>
                <output aria-label="Zoom level">{Math.round(zoom*100)}%</output>
                <button type="button" aria-label="Zoom in" title="Zoom in" onClick={()=>setZoom((z)=>Math.min(2,Math.round((z+.25)*100)/100))}><Plus size={16}/></button>
                <button type="button" aria-label="Reset zoom" title="Reset zoom" onClick={()=>setZoom(1)}><Maximize2 size={15}/></button>
              </div>
            </div>
            <div className="pm-transport">
              <div className="pm-transport-equation"><span className="pm-label">ACTIVE EQUATION</span><code>{equation}</code></div>
              <div className="pm-transport-buttons">
                <button type="button" className="pm-action pm-action-primary" onClick={()=>setPlaying(v=>!v)} aria-label={playing ? "Pause animation" : "Play animation"}>{playing ? <Pause size={15}/> : <Play size={15}/>} {playing ? "Pause" : "Play"}</button>
                <button type="button" className="pm-action pm-action-quiet" onClick={resetScene}><RotateCcw size={15}/> Reset</button>
              </div>
            </div>
          </section>

          {detailsOpen && <section className="pm-details" aria-label="Scene details">
            <div className="pm-details-header">
              <div className="pm-details-title"><span className="pm-details-symbol"><Code2 size={16}/></span><div><span className="pm-label">DOCUMENT</span><strong>Scene Details</strong></div></div>
              <button type="button" className="pm-icon-btn" aria-label="Collapse scene details" onClick={()=>setDetailsOpen(false)}><ChevronDown size={17}/></button>
            </div>
            <div className="pm-tabs" role="tablist" aria-label="Scene detail tabs">
              <button type="button" role="tab" aria-selected={detailsTab==="overview"} onClick={()=>setDetailsTab("overview")}> <Info size={14}/> Overview</button>
              <button type="button" role="tab" aria-selected={detailsTab==="json"} onClick={()=>setDetailsTab("json")}><FileJson2 size={14}/> Scene JSON</button>
              <span className="pm-tabs-meta">VERSION {scene.schemaVersion} · LOCAL ONLY</span>
            </div>
            {detailsTab==="overview" ? <div className="pm-detail-content" role="tabpanel">
              <div className="pm-detail-metric"><span>Type</span><strong>{scene.kind}</strong></div>
              <div className="pm-detail-metric"><span>Frequency X</span><strong>{scene.params.frequencyX}</strong></div>
              <div className="pm-detail-metric"><span>Frequency Y</span><strong>{scene.params.frequencyY}</strong></div>
              <div className="pm-detail-metric"><span>Amplitude</span><strong>{scene.params.amplitude.toFixed(2)}</strong></div>
              <div className="pm-detail-metric"><span>Phase</span><strong>{scene.params.phase.toFixed(2)} rad</strong></div>
            </div> : <div className="pm-json-view" role="tabpanel"><button type="button" className="pm-json-copy" onClick={()=>{void copyJSON();}}><Copy size={14}/> Copy JSON</button><pre>{JSON.stringify(scene,null,2)}</pre></div>}
          </section>}
          {!detailsOpen && <button type="button" className="pm-detail-reopen" onClick={()=>setDetailsOpen(true)}><ChevronUp size={16}/> Show scene details</button>}
        </div>

        {inspectorOpen && <aside className="pm-inspector" aria-label="Scene inspector">
          <header className="pm-inspector-top"><span className="pm-sidebar-mark"><SlidersHorizontal size={18}/></span><div><span className="pm-label">PROPERTIES</span><h2>Inspector</h2><p>Live scene configuration</p></div></header>
          <div className="pm-inspector-scroll">
            <section className="pm-inspector-section">
              <div className="pm-inspector-sectionhead"><span>01 / SCENE</span><CircleDot size={16}/></div>
              <div className="field"><label htmlFor="scene-kind">Mathematical form</label><select id="scene-kind" value={scene.kind} onChange={(e)=>changeKind(e.target.value as SceneKind)}>{presets.map(item=><option key={item.kind} value={item.kind}>{item.title}</option>)}</select></div>
              <div className="pm-math-snippet"><span className="pm-label">EXPRESSION</span><code>{equation}</code></div>
            </section>
            <section className="pm-inspector-section">
              <div className="pm-inspector-sectionhead"><span>02 / PARAMETERS</span><Waves size={16}/></div>
              {controls.map(({key,label,min,max,step})=><div className="field slider-field" key={key}><label htmlFor={key}><span>{label}</span><output>{scene.params[key].toFixed(key.startsWith("frequency") ? 0 : 2)}</output></label><input type="range" id={key} min={min} max={max} step={step} value={scene.params[key]} onChange={(e)=>changeParam(key,e.target.valueAsNumber)}/><div className="slider-limits" aria-hidden="true"><span>{min}</span><span>{max}</span></div></div>)}
            </section>
            <section className="pm-inspector-section">
              <div className="pm-inspector-sectionhead"><span>03 / PROJECT</span><FileJson2 size={16}/></div>
              <div className="pm-project-state"><span className="live-indicator"/><div><strong>Browser project</strong><p>Changes are stored locally. Export JSON for a portable backup.</p></div></div>
              <button type="button" className="pm-action pm-action-quiet pm-export-wide" onClick={exportJSON}><Download size={15}/> Export current scene</button>
              <p className="status" role="status">{notice || "Scene document v1 · no executable user code."}</p>
            </section>
          </div>
        </aside>}
      </div>
      <div className="pm-statusbar"><div><span className="pm-status-dot"/> PARAMYRA ENGINE <span className="pm-status-divider"/> {scene.title}</div><div>SCENE DOCUMENT V1 <span className="pm-status-divider"/> ZOOM {Math.round(zoom*100)}% <span className="pm-status-divider"/> LOCAL PROJECT</div></div>
    </div>
  );
}

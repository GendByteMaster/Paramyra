"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, ChevronUp, CircleDot, Copy, Download, Eye, EyeOff, FileJson2, Grid3X3, Info, Layers3, Maximize2, Minimize2, Minus, Move, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Pause, Play, Plus, Redo2, RotateCcw, Search, SlidersHorizontal, Trash2, Undo2, Upload, Waves } from "lucide-react";
import { SceneCanvas } from "./scene-canvas";
import { SceneGlyph } from "./scene-glyph";
import { presets, presetFor } from "@/core/scenes/presets";
import { defaultView, type CanvasView } from "@/core/rendering/canvas2d";
import { documentFromScene, parseDocument, layerById, layerFromScene, makeLayerId, type MathDocument } from "@/core/document/schema";
import { addLayer, removeLayer, duplicateLayer, moveLayer, updateLayer } from "@/core/document/operations";
import { initializeHistory, commitDocument, undoDocument, redoDocument } from "@/core/document/history";
import type { SceneKind, SceneParams } from "@/core/scenes/schema";

const DOCUMENT_KEY = "paramyra.document.v2";
const LEGACY_KEY = "paramyra.scene.v1";
const PRESET_KEY = "paramyra.presets.v2";
type Key = keyof SceneParams;
const fields: { key: Key; label: string; min: number; max: number; step: number }[] = [
  {key:"frequencyX",label:"Frequency X",min:1,max:12,step:1},
  {key:"frequencyY",label:"Frequency Y",min:1,max:12,step:1},
  {key:"phase",label:"Phase",min:0,max:6.2832,step:.01},
  {key:"amplitude",label:"Amplitude",min:.1,max:1,step:.01},
  {key:"strokeWidth",label:"Stroke width",min:.5,max:4,step:.1},
];

function loadDoc(kind?: SceneKind): MathDocument {
  if (kind) return documentFromScene(presetFor(kind));
  for (const key of [DOCUMENT_KEY, LEGACY_KEY]) {
    try {
      const saved = localStorage.getItem(key);
      const parsed = saved && parseDocument(JSON.parse(saved));
      if (parsed) return parsed;
    } catch { /* Storage unavailable, malformed JSON, or unsupported version. */ }
  }
  return documentFromScene(presetFor("lissajous"));
}
function loadPresets(): MathDocument[] {
  try {
    const json = localStorage.getItem(PRESET_KEY);
    const array: unknown = json ? JSON.parse(json) : [];
    return Array.isArray(array) ? array.slice(0,12).map(parseDocument).filter((d):d is MathDocument=>d!==null) : [];
  } catch { return []; }
}
function Numeric({label,value,min,max,step,change}:{label:string;value:number;min:number;max:number;step:number;change:(n:number)=>void}) {
  const [draft,setDraft]=useState<string|null>(null);
  const save=()=>{
    if(draft?.trim()){
      const n=Number(draft);
      if(Number.isFinite(n)){
        const bounded=Math.max(min,Math.min(max,n));
        change(Number(Math.max(min,Math.min(max,min+Math.round((bounded-min)/step)*step)).toFixed(4)));
      }
    }
    setDraft(null);
  };
  return <input type="number" className="pm-numeric-input" aria-label={"Set "+label+" numerically"} min={min} max={max} step={step}
    value={draft??String(value)} onChange={e=>setDraft(e.target.value)} onBlur={save}
    onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();if(e.key==="Escape")setDraft(null);}}/>;
}
const noSubscribe=()=>()=>{};
const client=()=>true;
const server=()=>false;
export function StudioClient(props:{initialKind?:SceneKind;mode?:"studio"|"playground"}) {
  const ready=useSyncExternalStore(noSubscribe,client,server);
  if(!ready)return <div className="shell section" role="status">Loading workspace…</div>;
  return <StudioWorkspace {...props}/>;
}
function StudioWorkspace({initialKind,mode="studio"}:{initialKind?:SceneKind;mode?:"studio"|"playground"}) {
  const root=useRef<HTMLDivElement>(null);
  const last=useRef({key:"",at:0});
  const [history,setHistory]=useState(()=>initializeHistory(loadDoc(initialKind)));
  const doc=history.present;
  const [selected,setSelected]=useState(()=>loadDoc(initialKind).layers[0].id);
  const layer=layerById(doc,selected);
  const [presetsSaved,setPresetsSaved]=useState<MathDocument[]>(loadPresets);
  const [presetName,setPresetName]=useState("");
  const [addKind,setAddKind]=useState<SceneKind>("polar-rose");
  const [filter,setFilter]=useState("");
  const [libraryOpen,setLibraryOpen]=useState(()=>window.matchMedia("(min-width:960px)").matches);
  const [inspectorOpen,setInspectorOpen]=useState(true);
  const [detailsOpen,setDetailsOpen]=useState(true);
  const [detailsTab,setDetailsTab]=useState<"overview"|"json">("overview");
  const [view,setView]=useState<CanvasView>(defaultView);
  const [playing,setPlaying]=useState(true);
  const [time,setTime]=useState(0);
  const [speed,setSpeed]=useState(1);
  const [seekVersion,setSeekVersion]=useState(0);
  const [fullscreen,setFullscreen]=useState(false);
  const [notice,setNotice]=useState("");

  useEffect(()=>{
    const listener=()=>setFullscreen(document.fullscreenElement===root.current);
    document.addEventListener("fullscreenchange",listener);
    return()=>document.removeEventListener("fullscreenchange",listener);
  },[]);
  useEffect(()=>{
    try{localStorage.setItem(DOCUMENT_KEY,JSON.stringify(doc));}
    catch{/* Explicit JSON export remains available. */}
  },[doc]);

  const commit=(fn:(d:MathDocument)=>MathDocument,key="")=>{
    // Timestamp is sampled only in user-triggered edit handlers, never during render.
    // eslint-disable-next-line react-hooks/purity
    const now=Date.now();
    const coalesce=!!key&&last.current.key===key&&now-last.current.at<500;
    setHistory(h=>commitDocument(h,fn(h.present),coalesce));
    last.current={key,at:now};
  };
  const undo=()=>{setHistory(undoDocument);last.current.key="";};
  const redo=()=>{setHistory(redoDocument);last.current.key="";};
  useEffect(()=>{
    const onKey=(event:globalThis.KeyboardEvent)=>{
      if(!(event.metaKey||event.ctrlKey)||event.key.toLowerCase()!=="z")return;
      const target=event.target as HTMLElement | null;
      if(target?.closest("input,textarea,select,[contenteditable=true]"))return;
      event.preventDefault();
      if(event.shiftKey){setHistory(redoDocument);}
      else{setHistory(undoDocument);}
      last.current.key="";
    };
    document.addEventListener("keydown",onKey);
    return()=>document.removeEventListener("keydown",onKey);
  },[]);
  const replace=(d:MathDocument)=>{
    commit(()=>d);
    setSelected(d.layers[0].id);setTime(0);setSeekVersion(n=>n+1);
  };
  const selectPreset=(kind:SceneKind)=>{
    replace(documentFromScene(presetFor(kind)));
    if(window.matchMedia("(max-width:959px)").matches)setLibraryOpen(false);
  };
  const param=(key:Key,value:number)=>{
    if(!Number.isFinite(value)||value===layer.params[key])return;
    commit(d=>updateLayer(d,layer.id,l=>({...l,params:{...l.params,[key]:value}})),"p:"+layer.id+":"+key);
  };
  const add=()=>{
    if(doc.layers.length>=12)return setNotice("Maximum 12 layers.");
    const item=layerFromScene(presetFor(addKind),makeLayerId());
    commit(d=>addLayer(d,item));setSelected(item.id);
  };
  const duplicate=()=>{
    if(doc.layers.length>=12)return setNotice("Maximum 12 layers.");
    const id=makeLayerId();
    commit(d=>duplicateLayer(d,layer.id,id));setSelected(id);
  };
  const remove=()=>{
    if(doc.layers.length<=1)return setNotice("At least one layer is required.");
    commit(d=>removeLayer(d,layer.id));setSelected(doc.layers.find(l=>l.id!==layer.id)!.id);
  };
  const download=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(doc,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="paramyra-"+doc.id+".json";a.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const importFile=async(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];e.target.value="";
    if(!file)return;
    if(file.size>262144)return setNotice("File exceeds 256 KB.");
    try{
      const parsed=parseDocument(JSON.parse(await file.text()));
      if(!parsed)return setNotice("Invalid or unsupported scene document.");
      replace(parsed);setNotice("Scene imported (version 2).");
    }catch{setNotice("Unable to read scene JSON.");}
  };
  const copy=async()=>{
    try{await navigator.clipboard.writeText(JSON.stringify(doc,null,2));setNotice("Scene JSON copied.");}
    catch{setNotice("Clipboard unavailable. Use Export JSON.");}
  };
  const savePreset=()=>{
    const name=(presetName.trim()||doc.title).slice(0,120);
    const next=[{...doc,id:makeLayerId(),title:name},...presetsSaved].slice(0,12);
    try{localStorage.setItem(PRESET_KEY,JSON.stringify(next));setPresetsSaved(next);setPresetName("");setNotice("Preset saved locally.");}
    catch{setNotice("Preset storage unavailable; use Export JSON.");}
  };
  const deletePreset=(id:string)=>{
    const next=presetsSaved.filter(p=>p.id!==id);
    try{localStorage.setItem(PRESET_KEY,JSON.stringify(next));setPresetsSaved(next);}catch{setNotice("Preset deletion failed.");}
  };
  const toggleFullscreen=async()=>{
    try{
      if(document.fullscreenElement===root.current)await document.exitFullscreen();
      else if(!document.fullscreenElement)await root.current?.requestFullscreen();
      else setNotice("Another element is in fullscreen.");
    }catch{setNotice("Browser blocked fullscreen.");}
  };
  const reset=()=>{replace(documentFromScene(presetFor(layer.kind)));setView(defaultView);setPlaying(true);};
  const guide=layer.kind==="lissajous"?"Two perpendicular waves create a closed curve. Their frequency ratio controls symmetry.":layer.kind==="polar-rose"?"The symmetry parameter controls the petals of the rose curve.":"Two sine components combine into a harmonic waveform.";
  const shownFields=fields.filter(f=>layer.kind!=="polar-rose"||f.key!=="frequencyY");
  const filtered=presets.filter(p=>p.title.toLowerCase().includes(filter.toLowerCase().trim()));
  const pattern=layer.kind==="polar-rose"?{label:"Petal count",value:String(layer.params.frequencyX%2?layer.params.frequencyX:layer.params.frequencyX*2)}
    :layer.kind==="lissajous"?{label:"Frequency ratio",value:layer.params.frequencyX+" : "+layer.params.frequencyY}
    :{label:"Harmonics",value:layer.params.frequencyX+" + "+layer.params.frequencyY};

  return <div className="pm-workspace" data-mode={mode} ref={root}>
    <header className="pm-projectbar" role="toolbar" aria-label="Workspace toolbar">
      <div className="pm-project-identity">
        <Link href="/explore" className="pm-icon-btn" aria-label="Back to Explore"><ArrowLeft size={16}/></Link>
        <div className="pm-project-mark"><CircleDot size={19}/></div>
        <div className="pm-project-name"><span className="pm-label">PARAMYRA / {mode.toUpperCase()}</span>
          <h1>{mode==="studio"?"Your mathematical studio":"The mathematics playground"}</h1>
          <strong>{doc.title} <span className="pm-project-suffix">— {doc.layers.length} layers</span></strong>
        </div>
        <span className="pm-local-label"><span className="live-indicator"/> LOCAL</span>
      </div>
      <div className="pm-project-actions">
        <button type="button" className="pm-icon-btn" aria-label="Undo" disabled={!history.past.length} onClick={undo}><Undo2 size={17}/></button>
        <button type="button" className="pm-icon-btn" aria-label="Redo" disabled={!history.future.length} onClick={redo}><Redo2 size={17}/></button>
        <span className="pm-toolbar-rule"/>
        <button type="button" className="pm-icon-btn" aria-label="Toggle scene library" aria-pressed={libraryOpen} onClick={()=>setLibraryOpen(v=>!v)}>{libraryOpen?<PanelLeftClose size={17}/>:<PanelLeftOpen size={17}/>}</button>
        <button type="button" className="pm-icon-btn" aria-label="Toggle inspector" aria-pressed={inspectorOpen} onClick={()=>setInspectorOpen(v=>!v)}>{inspectorOpen?<PanelRightClose size={17}/>:<PanelRightOpen size={17}/>}</button>
        <button type="button" className="pm-icon-btn pm-fullscreen-button" aria-label={fullscreen?"Exit fullscreen":"Enter fullscreen"} aria-pressed={fullscreen} onClick={()=>{void toggleFullscreen();}}>{fullscreen?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button>
        <span className="pm-toolbar-rule"/>
        <label className="pm-action pm-action-quiet pm-import"><Upload size={15}/> Import<input className="sr-only" type="file" aria-label="Import scene JSON" accept=".json,application/json" onChange={importFile}/></label>
        <button type="button" className="pm-action pm-action-primary" onClick={download}><Download size={15}/> Export JSON</button>
      </div>
    </header>
    <div className={"pm-grid"+(!libraryOpen?" pm-no-library":"")+(!inspectorOpen?" pm-no-inspector":"")}>
      {libraryOpen&&<button type="button" className="pm-library-backdrop" aria-label="Close scene library" onClick={()=>setLibraryOpen(false)}/>}
      {libraryOpen&&<aside className="pm-sidebar" aria-label="Scene library">
        <header className="pm-sidebar-heading"><span className="pm-sidebar-mark"><Layers3 size={18}/></span><div><span className="pm-label">LIBRARY</span><h2>Scene Library</h2><p>Models, layers and presets</p></div></header>
        <div className="pm-library-search"><Search size={16}/><input type="search" aria-label="Search mathematical scenes" placeholder="Search scenes..." value={filter} onChange={e=>setFilter(e.target.value)}/></div>
        <div className="pm-library-group-heading"><span>MATHEMATICAL FORMS</span><span>{filtered.length} / {presets.length}</span></div>
        <div className="pm-library-list">
          {filtered.map((p,index)=><button type="button" key={p.id} className={"pm-library-item"+(doc.layers.length===1&&layer.kind===p.kind?" active":"")}
            aria-pressed={doc.layers.length===1&&layer.kind===p.kind} onClick={()=>selectPreset(p.kind)}>
            <span className="pm-library-thumb"><SceneGlyph kind={p.kind}/><span>0{index+1}</span></span>
            <span className="pm-library-item-text"><strong>{p.title}</strong><small>{p.kind==="wave"?"Harmonic motion":p.kind==="polar-rose"?"Polar geometry":"Parametric geometry"}</small></span>
            <Check size={14}/>
          </button>)}
          {!filtered.length&&<p className="pm-empty">No scenes match your search.</p>}
        </div>
        <div className="pm-layers-panel">
          <div className="pm-layers-heading"><span><Layers3 size={14}/> Layers ({doc.layers.length}/12)</span><button type="button" aria-label="Add layer" disabled={doc.layers.length>=12} onClick={add}><Plus size={16}/></button></div>
          <select aria-label="New layer kind" value={addKind} onChange={e=>setAddKind(e.target.value as SceneKind)}>{presets.map(p=><option key={p.kind} value={p.kind}>{p.title}</option>)}</select>
          <div className="pm-layer-list">{doc.layers.map((l,index)=><div key={l.id} className={"pm-layer-row"+(selected===l.id?" selected":"")}>
            <button type="button" className="pm-layer-select" aria-label={"Select layer "+l.title} aria-pressed={selected===l.id} onClick={()=>setSelected(l.id)}><span>{index+1}</span><span>{l.title}</span></button>
            <button type="button" aria-label={"Toggle visibility "+l.title} onClick={()=>commit(d=>updateLayer(d,l.id,x=>({...x,visible:!x.visible})))}>{l.visible?<Eye size={15}/>:<EyeOff size={15}/>}</button>
          </div>)}</div>
        </div>
        <div className="pm-sidebar-bottom"><span className="pm-label">CUSTOM PRESETS</span>
          <div className="pm-save-preset"><input aria-label="Preset name" placeholder="Preset name" value={presetName} maxLength={120} onChange={e=>setPresetName(e.target.value)}/><button type="button" onClick={savePreset}>Save</button></div>
          {presetsSaved.length?presetsSaved.map(p=><div key={p.id} className="pm-user-preset"><button type="button" onClick={()=>replace(p)}>{p.title}</button><button type="button" aria-label={"Delete preset "+p.title} onClick={()=>deletePreset(p.id)}><Trash2 size={14}/></button></div>):<p>No saved presets yet.</p>}
        </div>
      </aside>}
      <div className="pm-center">
        <section className="pm-viewport-panel" aria-label="Visualization preview">
          <div className="pm-viewport-toolbar"><div className="pm-viewport-heading"><span className="pm-blue-dot"/><div><strong>{doc.title}</strong><small>Canvas 2D · {doc.layers.length} layers</small></div></div>
            <div className="pm-viewport-tools"><span className="pm-live" data-state={playing?"playing":"paused"}><span className="live-indicator"/>{playing?"LIVE":"PAUSED"}</span><span className="pm-fps-label">SCENE {doc.layers.length} LAYERS</span>
              <button type="button" className="pm-icon-btn" aria-label="Toggle scene details" aria-pressed={detailsOpen} onClick={()=>setDetailsOpen(v=>!v)}><Info size={16}/></button>
            </div></div>
          <div className="pm-canvas-area">
            <div className="pm-canvas-surface"><SceneCanvas scene={doc} playing={playing} view={view} time={time} duration={doc.duration} speed={speed} seekVersion={seekVersion} onTimeChange={setTime} onPanChange={(x,y)=>setView(v=>({...v,pan:{x,y}}))} onWheelZoom={zoom=>setView(v=>({...v,zoom}))}/></div>
            <div className="pm-canvas-corner">PARAMYRA · LAYERED ENGINE</div>
            <div className="pm-view-tools" role="toolbar" aria-label="Canvas tools">
              <button type="button" aria-label="Toggle grid" aria-pressed={view.grid} onClick={()=>setView(v=>({...v,grid:!v.grid}))}><Grid3X3 size={15}/></button>
              <button type="button" aria-label="Toggle axes" aria-pressed={view.axes} onClick={()=>setView(v=>({...v,axes:!v.axes}))}><Plus size={15}/></button>
              <button type="button" aria-label="Toggle curve style" aria-pressed={view.style==="glow"} onClick={()=>setView(v=>({...v,style:v.style==="glow"?"clean":"glow"}))}><Waves size={15}/></button>
              <span>Drag to pan</span>
            </div>
            <div className="pm-zoom">
              <button type="button" aria-label="Zoom out" onClick={()=>setView(v=>({...v,zoom:Math.max(.5,Math.round((v.zoom-.25)*100)/100)}))}><Minus size={16}/></button>
              <output aria-label="Zoom level">{Math.round(view.zoom*100)}%</output>
              <button type="button" aria-label="Zoom in" onClick={()=>setView(v=>({...v,zoom:Math.min(2,Math.round((v.zoom+.25)*100)/100)}))}><Plus size={16}/></button>
              <button type="button" aria-label="Reset zoom" onClick={()=>setView(v=>({...v,zoom:1}))}><Maximize2 size={15}/></button>
              <button type="button" aria-label="Fit scene" onClick={()=>setView(defaultView)}><Move size={15}/></button>
            </div>
          </div>
          <div className="pm-transport"><div className="pm-transport-equation"><span className="pm-label">SELECTED · {layer.title}</span><code>{layer.kind==="lissajous"?"x = A sin(at + δ), y = B sin(bt)":layer.kind==="polar-rose"?"r = A cos(kθ)":"y = f(x, t)"}</code></div>
            <div className="pm-transport-buttons"><button type="button" className="pm-action pm-action-primary" aria-label={playing?"Pause animation":"Play animation"} onClick={()=>setPlaying(v=>!v)}>{playing?<Pause size={15}/>:<Play size={15}/>} {playing?"Pause":"Play"}</button>
              <button type="button" className="pm-action pm-action-quiet" onClick={reset}><RotateCcw size={15}/> Reset</button>
            </div></div>
        </section>
        {detailsOpen&&<section className="pm-details" aria-label="Scene details">
          <div className="pm-details-header"><div className="pm-details-title"><span className="pm-details-symbol"><FileJson2 size={16}/></span><div><span className="pm-label">TIMELINE / DOCUMENT</span><strong>Scene Details</strong></div></div>
            <button type="button" className="pm-icon-btn" aria-label="Collapse scene details" onClick={()=>setDetailsOpen(false)}><ChevronDown size={16}/></button>
          </div>
          <div className="pm-timeline"><label htmlFor="timeline-position">Timeline</label><input id="timeline-position" aria-label="Timeline position" type="range" min="0" max={doc.duration} step=".05" value={Math.min(time,doc.duration)} onChange={e=>{setTime(e.target.valueAsNumber);setSeekVersion(v=>v+1);}}/>
            <output>{time.toFixed(1)} / {doc.duration}s</output><select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value=".25">0.25×</option><option value=".5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select>
          </div>
          <div className="pm-tabs" role="tablist" aria-label="Scene detail tabs">
            <button type="button" role="tab" aria-selected={detailsTab==="overview"} onClick={()=>setDetailsTab("overview")}><Info size={14}/> Overview</button>
            <button type="button" role="tab" aria-selected={detailsTab==="json"} onClick={()=>setDetailsTab("json")}><FileJson2 size={14}/> Scene JSON</button>
            <span className="pm-tabs-meta">VERSION {doc.schemaVersion} · LOCAL ONLY</span>
          </div>
          {detailsTab==="overview"?<div className="pm-detail-content" role="tabpanel">
            <div className="pm-detail-metric pm-pattern-metric"><span>{pattern.label}</span><strong>{pattern.value}</strong></div>
            <div className="pm-detail-metric"><span>Frequency X</span><strong>{layer.params.frequencyX}</strong></div>
            <div className="pm-detail-metric"><span>{layer.kind==="polar-rose"?"Curve type":"Frequency Y"}</span><strong>{layer.kind==="polar-rose"?"Polar rose":layer.params.frequencyY}</strong></div>
            <div className="pm-detail-metric"><span>Amplitude</span><strong>{layer.params.amplitude.toFixed(2)}</strong></div>
            <div className="pm-detail-metric"><span>Phase</span><strong>{layer.params.phase.toFixed(2)} rad</strong></div>
          </div>:<div className="pm-json-view" role="tabpanel"><button type="button" className="pm-json-copy" onClick={()=>{void copy();}}><Copy size={14}/> Copy JSON</button><pre>{JSON.stringify(doc,null,2)}</pre></div>}
        </section>}
        {!detailsOpen&&<button type="button" className="pm-detail-reopen" onClick={()=>setDetailsOpen(true)}><ChevronUp size={16}/> Show scene details</button>}
      </div>
      {inspectorOpen&&<aside className="pm-inspector" aria-label="Scene inspector">
        <header className="pm-inspector-top"><span className="pm-sidebar-mark"><SlidersHorizontal size={18}/></span><div><span className="pm-label">PROPERTIES</span><h2>Inspector</h2><p>Selected mathematical layer</p></div></header>
        <div className="pm-inspector-scroll">
          <section className="pm-inspector-section"><div className="pm-inspector-sectionhead"><span>01 / LAYER</span><Layers3 size={16}/></div>
            <div className="field"><label htmlFor="layer-title">Layer name</label><input id="layer-title" className="pm-textfield" value={layer.title} maxLength={120} onChange={e=>{if(e.target.value)commit(d=>updateLayer(d,layer.id,l=>({...l,title:e.target.value})),"title:"+layer.id);}}/></div>
            <div className="field"><label htmlFor="scene-kind">Mathematical form</label><select id="scene-kind" value={layer.kind} onChange={e=>{const next=presetFor(e.target.value as SceneKind);commit(d=>updateLayer(d,layer.id,l=>({...l,kind:next.kind,params:{...next.params}})));}}>{presets.map(p=><option key={p.kind} value={p.kind}>{p.title}</option>)}</select></div>
            <div className="pm-layer-actions"><button type="button" aria-label="Duplicate layer" disabled={doc.layers.length>=12} onClick={duplicate}><Copy size={14}/> Duplicate</button>
              <button type="button" aria-label="Move layer up" disabled={doc.layers.indexOf(layer)>=doc.layers.length-1} onClick={()=>commit(d=>moveLayer(d,layer.id,1))}>↑</button>
              <button type="button" aria-label="Move layer down" disabled={doc.layers.indexOf(layer)===0} onClick={()=>commit(d=>moveLayer(d,layer.id,-1))}>↓</button>
              <button type="button" aria-label="Delete layer" disabled={doc.layers.length===1} onClick={remove}><Trash2 size={15}/></button></div>
            <div className="pm-style-fields"><label>Color<input type="color" aria-label="Layer color" value={layer.color} onChange={e=>commit(d=>updateLayer(d,layer.id,l=>({...l,color:e.target.value})),"color:"+layer.id)}/></label>
              <label>Opacity<input type="range" aria-label="Layer opacity" min="0" max="1" step=".05" value={layer.opacity} onChange={e=>commit(d=>updateLayer(d,layer.id,l=>({...l,opacity:e.target.valueAsNumber})),"opacity:"+layer.id)}/></label>
            </div>
          </section>
          <section className="pm-inspector-section"><div className="pm-inspector-sectionhead"><span>02 / PARAMETERS</span><Waves size={16}/></div>
            {shownFields.map(({key,label,min,max,step})=>{
              const shownLabel=layer.kind==="polar-rose"&&key==="frequencyX"?"Symmetry (k)":label;
              const progress=(layer.params[key]-min)/(max-min)*100;
              return <div className="field slider-field" key={layer.id+key}>
                <label htmlFor={key}><span>{shownLabel}</span><Numeric label={shownLabel} value={layer.params[key]} min={min} max={max} step={step} change={v=>param(key,v)}/></label>
                <input type="range" id={key} aria-label={shownLabel} min={min} max={max} step={step} value={layer.params[key]} style={{backgroundImage:"linear-gradient(90deg,#80afff "+progress+"%,#263750 "+progress+"%)"}} onChange={e=>param(key,e.target.valueAsNumber)}/>
                <div className="slider-limits"><span>{min}</span><span>{max}</span></div>
              </div>;
            })}
            <div className="pm-offset-fields"><label>Offset X<Numeric label="Offset X" min={-2} max={2} step={.05} value={layer.offset.x} change={x=>commit(d=>updateLayer(d,layer.id,l=>({...l,offset:{...l.offset,x}})))}/></label>
              <label>Offset Y<Numeric label="Offset Y" min={-2} max={2} step={.05} value={layer.offset.y} change={y=>commit(d=>updateLayer(d,layer.id,l=>({...l,offset:{...l.offset,y}})))}/></label></div>
          </section>
          <section className="pm-inspector-section"><div className="pm-inspector-sectionhead"><span>03 / PROJECT</span><FileJson2 size={16}/></div>
            <div className="field"><label>Duration (seconds)</label><Numeric label="Duration" min={2} max={60} step={1} value={doc.duration} change={v=>commit(d=>({...d,duration:v}))}/></div>
            <div className="pm-project-state"><span className="live-indicator"/><div><strong>Browser project</strong><p>Changes are stored locally. Export JSON for backup.</p></div></div>
            <button className="pm-action pm-action-quiet pm-export-wide" type="button" onClick={download}><Download size={15}/> Export current scene</button>
            <p className="status" role="status">{notice||"Scene document v2 · no executable user code."}</p>
          </section>
          <section className="pm-inspector-guide" aria-label="Mathematical guide"><span className="pm-label">UNDERSTAND THE MATHEMATICS</span><strong>{layer.title}</strong><p>{guide}</p></section>
        </div>
      </aside>}
    </div>
    <div className="pm-statusbar"><div><span className="pm-status-dot"/> PARAMYRA ENGINE · {doc.layers.length} LAYERS</div><div>SCENE DOCUMENT V2 · ZOOM {Math.round(view.zoom*100)}% · LOCAL PROJECT</div></div>
  </div>;
}

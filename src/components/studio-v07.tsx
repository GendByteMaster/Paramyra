"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, Image as ImageIcon, Check, ChevronDown, ChevronUp, CircleDot, Copy, Download, Eye, EyeOff, FileJson2, GitBranch, Grid3X3, Info, Layers3, Maximize2, Minimize2, Minus, Move, MousePointer2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Pause, Play, Plus, Redo2, RotateCcw, Search, SlidersHorizontal, Trash2, Undo2, Upload, Waves } from "lucide-react";
import { SceneCanvas } from "./scene-canvas";
import { SceneGlyph } from "./scene-glyph";
import { FormulaEditor } from "./formula-editor";
import { CalculatorWindow } from "./calculator-window";
import { AnimationTimeline } from "./animation-timeline";
import { AnimationValueComparison } from "./animation-value-comparison";
import { compileGraph, resolveLiveScene } from "@/core/graph/live";
import { readStoredGraph } from "@/core/graph/storage";
import { GRAPH_KEY, LEGACY_GRAPH_KEY } from "@/core/graph/model";
import { savePng, saveSvg, type ExportBackground, type ExportSize } from "@/core/rendering/export";
import { defaultFormula, validateFormula } from "@/core/math/formula";
import { presets, presetFor } from "@/core/scenes/presets";
import { defaultView, type CanvasView } from "@/core/rendering/canvas2d";
import { clampZoom, fitCamera, type Size } from "@/core/rendering/geometry";
import { documentFromScene, parseDocument, layerById, layerFromScene, newFormulaLayer, makeLayerId, type MathDocument } from "@/core/document/schema";
import { addLayer, removeLayer, duplicateLayer, moveLayer, updateLayer } from "@/core/document/operations";
import { initializeHistory, commitDocument, undoDocument, redoDocument } from "@/core/document/history";
import type { SceneKind, SceneParams } from "@/core/scenes/schema";

const DOCUMENT_KEY = "paramyra.document.v3";
const PREVIOUS_DOCUMENT_KEY = "paramyra.document.v2";
const LEGACY_KEY = "paramyra.scene.v1";
const PRESET_KEY = "paramyra.presets.v3";
const PREVIOUS_PRESET_KEY = "paramyra.presets.v2";
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
  for (const key of [DOCUMENT_KEY, PREVIOUS_DOCUMENT_KEY, LEGACY_KEY]) {
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
    const json = localStorage.getItem(PRESET_KEY) ?? localStorage.getItem(PREVIOUS_PRESET_KEY);
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
  const centerRef=useRef<HTMLDivElement>(null);
  const returnCalculatorFocus=useRef<HTMLElement|null>(null);
  const last=useRef({key:"",at:0});
  const dragGroup=useRef<string|null>(null);
  const [history,setHistory]=useState(()=>initializeHistory(loadDoc(initialKind)));
  const doc=history.present;
  const [nodeGraph,setNodeGraph]=useState(readStoredGraph);
  const compiledGraph=useMemo(()=>compileGraph(nodeGraph),[nodeGraph]);
  const [selected,setSelected]=useState(()=>loadDoc(initialKind).layers[0].id);
  // Selection may reference a layer removed by Undo/Redo or replaced by import.
  // Keep Inspector, Canvas highlighting and Layer list aligned with the same fallback.
  const effectiveSelected=doc.layers.some(l=>l.id===selected)?selected:doc.layers[0].id;
  const layer=layerById(doc,effectiveSelected);
  const [presetsSaved,setPresetsSaved]=useState<MathDocument[]>(loadPresets);
  const [presetName,setPresetName]=useState("");
  const [addKind,setAddKind]=useState<SceneKind|"formula">("polar-rose");
  const [filter,setFilter]=useState("");
  const [libraryOpen,setLibraryOpen]=useState(()=>window.matchMedia("(min-width:960px)").matches);
  const [inspectorOpen,setInspectorOpen]=useState(true);
  const [detailsOpen,setDetailsOpen]=useState(true);
  const [detailsTab,setDetailsTab]=useState<"overview"|"animation"|"json">("overview");
  const [animationFocus,setAnimationFocus]=useState(false);
  const [animationPanelHeight,setAnimationPanelHeight]=useState(()=>Math.round(Math.max(350,window.innerHeight*.47)));
  const [centerHeight,setCenterHeight]=useState(()=>window.innerHeight);
  useEffect(()=>{
    const element=centerRef.current;
    if(!element)return;
    const observer=new ResizeObserver(entries=>{
      const height=Math.floor(entries[0]?.contentRect.height??0);
      if(height<=0)return;
      setCenterHeight(height);
      const maximum=Math.max(320,height-210);
      setAnimationPanelHeight(current=>Math.min(current,maximum));
    });
    observer.observe(element);
    return ()=>observer.disconnect();
  },[]);
  const animationResize=useRef<{pointerId:number;startY:number;height:number}|null>(null);
  const editorHeightMax=()=>Math.max(320,Math.floor((centerRef.current?.clientHeight??window.innerHeight)-210));
  const setEditorHeight=(value:number)=>setAnimationPanelHeight(Math.round(Math.max(300,Math.min(editorHeightMax(),value))));
  const resetEditorHeight=()=>setEditorHeight(Math.max(350,window.innerHeight*.47));
  const openAnimation=()=>{setDetailsOpen(true);setDetailsTab("animation");};
  const [view,setView]=useState<CanvasView>(defaultView);
  const [canvasSize,setCanvasSize]=useState<Size>({width:800,height:600});
  const [tool,setTool]=useState<"select"|"pan">("select");
  const [playing,setPlaying]=useState(true);
  const [time,setTime]=useState(0);
  const [speed,setSpeed]=useState(1);
  const [seekVersion,setSeekVersion]=useState(0);
  const liveAtPlayhead=useMemo(()=>resolveLiveScene(doc,time,compiledGraph),[doc,time,compiledGraph]);
  const [fullscreen,setFullscreen]=useState(false);
  const [notice,setNotice]=useState("");
  const [exportOpen,setExportOpen]=useState(false);
  const [exportSize,setExportSize]=useState<"1280x720"|"1920x1080">("1920x1080");
  const [exportBackground,setExportBackground]=useState<ExportBackground>("dark");
  const [calculatorOpen,setCalculatorOpen]=useState(false);
  const openCalculator=()=>{
    returnCalculatorFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    if(window.matchMedia("(max-width:959px)").matches)setLibraryOpen(false);
    setCalculatorOpen(true);
  };
  const closeCalculator=()=>{
    setCalculatorOpen(false);
    requestAnimationFrame(()=>returnCalculatorFocus.current?.isConnected&&returnCalculatorFocus.current.focus());
  };

  useEffect(()=>{
    const listener=()=>setFullscreen(document.fullscreenElement===root.current);
    document.addEventListener("fullscreenchange",listener);
    return()=>document.removeEventListener("fullscreenchange",listener);
  },[]);
  useEffect(()=>{
    const onGraphStorage=(event:StorageEvent)=>{
      if(event.key===GRAPH_KEY||event.key===LEGACY_GRAPH_KEY||event.key===null)
        setNodeGraph(readStoredGraph());
    };
    window.addEventListener("storage",onGraphStorage);
    return()=>window.removeEventListener("storage",onGraphStorage);
  },[]);
  useEffect(()=>{
    try{localStorage.setItem(DOCUMENT_KEY,JSON.stringify(doc));}
    catch{/* Explicit JSON export remains available. */}
  },[doc]);

  const commit=(fn:(d:MathDocument)=>MathDocument,key="")=>{
    // Timestamp is sampled only in user-triggered edit handlers, never during render.
    // eslint-disable-next-line react-hooks/purity
    const now=Date.now();
    const coalesce=!!key&&last.current.key===key&&(dragGroup.current===key||now-last.current.at<500);
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
    const item=addKind==="formula"?newFormulaLayer(makeLayerId()):layerFromScene(presetFor(addKind),makeLayerId());
    commit(d=>addLayer(d,item));setSelected(item.id);
  };
  const duplicate=()=>{
    if(doc.layers.length>=12)return setNotice("Maximum 12 layers.");
    const id=makeLayerId();
    commit(d=>duplicateLayer(d,layer.id,id));setSelected(id);
  };
  const removeById=(id:string)=>{
    const index=doc.layers.findIndex(l=>l.id===id);
    if(index<0)return;
    if(doc.layers.length<=1)return setNotice("At least one layer is required. Add another layer before deleting this one.");
    const remaining=doc.layers.filter(l=>l.id!==id);
    commit(d=>removeLayer(d,id));
    if(selected===id)setSelected(remaining[Math.min(index,remaining.length-1)].id);
    setNotice(doc.layers[index].title+" deleted. Use Undo to restore.");
  };
  const remove=()=>removeById(layer.id);
  const addFormula=()=>{
    if(doc.layers.length>=12)return setNotice("Maximum 12 layers.");
    const item=newFormulaLayer(makeLayerId());
    commit(d=>addLayer(d,item));
    setSelected(item.id);
    setInspectorOpen(true);
    setNotice("Formula layer added. Edit its expression in the Inspector.");
    if(window.matchMedia("(max-width:959px)").matches)setLibraryOpen(false);
    requestAnimationFrame(()=>root.current?.querySelector(".pm-formula-editor")?.scrollIntoView({block:"nearest",behavior:"smooth"}));
  };
  const plotFromCalculator=(expression:string):boolean=>{
    if(doc.layers.length>=12){setNotice("Maximum 12 layers.");return false;}
    const base=layer.kind==="formula"?layer.formula:defaultFormula("explicit");
    const formula={...defaultFormula("explicit"),a:base.a,b:base.b,c:base.c,exprY:expression};
    if(validateFormula(formula)){setNotice("Cannot plot: expected a valid y=f(x,t) expression.");return false;}
    const item={...newFormulaLayer(makeLayerId()),title:"Plot · "+expression.slice(0,80),formula};
    commit(d=>addLayer(d,item));
    setSelected(item.id);setInspectorOpen(true);
    setNotice("Graph layer added. Use Undo to restore.");
    return true;
  };
  const exportFrame=async(type:"png"|"svg")=>{
    const [width,height]=exportSize.split("x").map(Number);
    const size:ExportSize={width,height};
    try{
      if(type==="svg")saveSvg(doc,time,view,size,exportBackground,compiledGraph);
      else await savePng(doc,time,view,size,exportBackground,compiledGraph);
      setNotice("Exported "+type.toUpperCase()+" frame at "+time.toFixed(2)+"s.");
      setExportOpen(false);
    }catch{setNotice("Unable to export image. Please try again.");}
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
      replace(parsed);setNotice("Scene imported (version 3).");
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
  const resetLayer=()=>{
    if(layer.kind==="formula"){
      commit(d=>updateLayer(d,layer.id,l=>l.kind==="formula"?{...l,formula:defaultFormula(l.formula.mode),offset:{x:0,y:0}}:l));
    } else {
      const defaults=presetFor(layer.kind);
      commit(d=>updateLayer(d,layer.id,l=>({...l,params:{...defaults.params},offset:{x:0,y:0}})));
    }
  };
  const fit=()=>setView(v=>({...v,...fitCamera(liveAtPlayhead.document,time,canvasSize,v)}));
  const moveLayerOffset=(id:string,x:number,y:number)=>{
    const current=doc.layers.find(l=>l.id===id);
    if(!current||current.offset.x===x&&current.offset.y===y)return;
    if(compiledGraph?.graph.binding.enabled&&compiledGraph.graph.binding.layerId===id
      &&compiledGraph.outputs.some(node=>node.property==="offset.x"||node.property==="offset.y")){
      setNotice("Position is controlled by Live Graph. Disable its binding to drag this layer.");
      return;
    }
    if(current.keyframes?.some(frame=>frame.property==="offset.x"||frame.property==="offset.y")){
      setNotice("Position is animated. Edit its keyframes in Animation Timeline.");
      return;
    }
    commit(d=>updateLayer(d,id,l=>({...l,offset:{x,y}})),"drag:"+id);
  };
  const guide=layer.kind==="formula"?"Create explicit, parametric or polar curves using a safe expression grammar. Adjust parameters a, b, c and the domain to change their geometry.":layer.kind==="lissajous"?"Two perpendicular waves create a closed curve. Their frequency ratio controls symmetry.":layer.kind==="polar-rose"?"The symmetry parameter controls the petals of the rose curve.":"Two sine components combine into a harmonic waveform.";
  const shownFields=fields.filter(f=>layer.kind==="formula"?f.key==="strokeWidth":layer.kind!=="polar-rose"||f.key!=="frequencyY");
  const filtered=presets.filter(p=>p.title.toLowerCase().includes(filter.toLowerCase().trim()));
  const pattern=layer.kind==="formula"?{label:"Expression type",value:layer.formula.mode}:layer.kind==="polar-rose"?{label:"Petal count",value:String(layer.params.frequencyX%2?layer.params.frequencyX:layer.params.frequencyX*2)}
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
        <Link className="pm-action pm-action-quiet" href="/studio/graph" aria-label="Open Node Graph Workspace"><GitBranch size={15}/> Node Graph{nodeGraph.binding.enabled?" · LIVE":""}</Link>
        <button type="button" className="pm-icon-btn" aria-label="Undo" disabled={!history.past.length} onClick={undo}><Undo2 size={17}/></button>
        <button type="button" className="pm-icon-btn" aria-label="Redo" disabled={!history.future.length} onClick={redo}><Redo2 size={17}/></button>
        <span className="pm-toolbar-rule"/>
        <button type="button" className="pm-icon-btn" aria-label="Toggle scene library" aria-pressed={libraryOpen} onClick={()=>setLibraryOpen(v=>!v)}>{libraryOpen?<PanelLeftClose size={17}/>:<PanelLeftOpen size={17}/>}</button>
        <button type="button" className="pm-icon-btn" aria-label="Toggle inspector" aria-pressed={inspectorOpen} onClick={()=>setInspectorOpen(v=>!v)}>{inspectorOpen?<PanelRightClose size={17}/>:<PanelRightOpen size={17}/>}</button>
        <button type="button" className="pm-icon-btn pm-fullscreen-button" aria-label={fullscreen?"Exit fullscreen":"Enter fullscreen"} aria-pressed={fullscreen} onClick={()=>{void toggleFullscreen();}}>{fullscreen?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button>
        <span className="pm-toolbar-rule"/>
        <button type="button" className="pm-action pm-calculator-launch" aria-label="Open calculator window"
          aria-haspopup="dialog" aria-expanded={calculatorOpen} aria-controls="pm-scientific-calculator-window"
          onClick={openCalculator}><Calculator size={16}/><span className="pm-calc-launch-label">Calculator</span></button>
        <button type="button" className="pm-action pm-export-launch" aria-label="Open image export options"
          aria-expanded={exportOpen} onClick={()=>setExportOpen(v=>!v)}><ImageIcon size={15}/> Export Image</button>
        <label className="pm-action pm-action-quiet pm-import"><Upload size={15}/> Import<input className="sr-only" type="file" aria-label="Import scene JSON" accept=".json,application/json" onChange={importFile}/></label>
        <button type="button" className="pm-action pm-action-primary" onClick={download}><Download size={15}/> Export JSON</button>
      </div>
    </header>
    {exportOpen&&<div className="pm-export-panel" role="group" aria-label="Image export options">
      <span className="pm-label">FRAME EXPORT</span>
      <label>Resolution<select aria-label="Export resolution" value={exportSize} onChange={e=>setExportSize(e.target.value as "1280x720"|"1920x1080")}>
        <option value="1280x720">1280 × 720</option><option value="1920x1080">1920 × 1080</option>
      </select></label>
      <label>Background<select aria-label="Export background" value={exportBackground} onChange={e=>setExportBackground(e.target.value as ExportBackground)}>
        <option value="dark">Dark</option><option value="transparent">Transparent</option>
      </select></label>
      <button type="button" onClick={()=>{void exportFrame("png");}}><Download size={14}/> Download PNG</button>
      <button type="button" onClick={()=>{void exportFrame("svg");}}><Download size={14}/> Download SVG</button>
      <button type="button" className="pm-export-close" aria-label="Close image export" onClick={()=>setExportOpen(false)}>✕</button>
    </div>}
    <div className={"pm-grid"+(!libraryOpen?" pm-no-library":"")+(!inspectorOpen?" pm-no-inspector":"")+(animationFocus&&detailsOpen&&detailsTab==="animation"?" pm-animation-focus":"")}>
      {libraryOpen&&<button type="button" className="pm-library-backdrop" aria-label="Close scene library" onClick={()=>setLibraryOpen(false)}/>}
      {libraryOpen&&<aside className="pm-sidebar" aria-label="Scene library">
        <header className="pm-sidebar-heading"><span className="pm-sidebar-mark"><Layers3 size={18}/></span><div><span className="pm-label">LIBRARY</span><h2>Scene Library</h2><p>Models, layers and presets</p></div></header>
        <div className="pm-library-search"><Search size={16}/><input type="search" aria-label="Search mathematical scenes" placeholder="Search scenes..." value={filter} onChange={e=>setFilter(e.target.value)}/></div>
        <div className="pm-library-group-heading"><span>MATHEMATICAL FORMS</span><span>{filtered.length} / {presets.length}</span></div>
        <div className="pm-library-list">
          {filtered.map((p,index)=><button type="button" key={p.id} className={"pm-library-item"+(doc.layers.length===1&&layer.kind===p.kind?" active":"")}
            aria-pressed={doc.layers.length===1&&layer.kind===p.kind} title="Open template (replaces the current document)" onClick={()=>selectPreset(p.kind)}>
            <span className="pm-library-thumb"><SceneGlyph kind={p.kind}/><span>0{index+1}</span></span>
            <span className="pm-library-item-text"><strong>{p.title}</strong><small>{p.kind==="wave"?"Harmonic motion":p.kind==="polar-rose"?"Polar geometry":"Parametric geometry"}</small></span>
            <Check size={14}/>
          </button>)}
          {!filtered.length&&<p className="pm-empty">No scenes match your search.</p>}
        </div>
        <div className="pm-layers-panel">
          <div className="pm-layers-heading"><span><Layers3 size={14}/> Layers ({doc.layers.length}/12)</span><button type="button" aria-label="Add layer" disabled={doc.layers.length>=12} onClick={add}><Plus size={16}/></button></div>
          <div className="pm-layer-create">
            <select aria-label="New layer kind" value={addKind} onChange={e=>setAddKind(e.target.value as SceneKind|"formula")}>{presets.map(p=><option key={p.kind} value={p.kind}>{p.title}</option>)}<option value="formula">Custom Formula</option></select>
            <button type="button" className="pm-formula-add" aria-label="Add formula layer" title="Create a formula and open its editor" disabled={doc.layers.length>=12} onClick={addFormula}>ƒx Formula</button>
          </div>
          <div className="pm-layer-list">{doc.layers.map((l,index)=><div key={l.id} className={"pm-layer-row"+(effectiveSelected===l.id?" selected":"")}>
            <button type="button" className="pm-layer-select" aria-label={"Select layer "+l.title} aria-pressed={effectiveSelected===l.id} onClick={()=>setSelected(l.id)}><span>{index+1}</span><span>{l.title}</span></button>
            <button type="button" aria-label={"Toggle visibility "+l.title} title={l.visible?"Hide layer":"Show layer"} onClick={()=>commit(d=>updateLayer(d,l.id,x=>({...x,visible:!x.visible})))}>{l.visible?<Eye size={15}/>:<EyeOff size={15}/>}</button>
            <button type="button" className="pm-layer-remove" aria-label={"Delete layer "+l.title}
              title={doc.layers.length===1?"A document must contain at least one layer":"Delete layer — Undo to restore"}
              disabled={doc.layers.length===1} onClick={()=>removeById(l.id)}><Trash2 size={15}/></button>
          </div>)}</div>
          {doc.layers.length===1&&<p className="pm-layer-minimum">At least one layer is required.</p>}
        </div>
        <div className="pm-sidebar-bottom"><span className="pm-label">CUSTOM PRESETS</span>
          <div className="pm-save-preset"><input aria-label="Preset name" placeholder="Preset name" value={presetName} maxLength={120} onChange={e=>setPresetName(e.target.value)}/><button type="button" onClick={savePreset}>Save</button></div>
          {presetsSaved.length?presetsSaved.map(p=><div key={p.id} className="pm-user-preset"><button type="button" onClick={()=>replace(p)}>{p.title}</button><button type="button" aria-label={"Delete preset "+p.title} onClick={()=>deletePreset(p.id)}><Trash2 size={14}/></button></div>):<p>No saved presets yet.</p>}
        </div>
      </aside>}
      <div ref={centerRef} className={"pm-center"+(detailsOpen&&detailsTab==="animation"?" pm-animation-workspace":"")} style={detailsOpen&&detailsTab==="animation"?({"--pm-editor-height":animationPanelHeight+"px"} as CSSProperties):undefined}>
        <section className="pm-viewport-panel" aria-label="Visualization preview">
          <div className="pm-viewport-toolbar"><div className="pm-viewport-heading"><span className="pm-blue-dot"/><div><strong>{doc.title}</strong><small>Canvas 2D · {doc.layers.length} layers</small></div></div>
            <div className="pm-viewport-tools"><span className="pm-live" data-state={playing?"playing":"paused"}><span className="live-indicator"/>{playing?"LIVE":"PAUSED"}</span>
            {nodeGraph.binding.enabled&&<span className={liveAtPlayhead.error?"pm-graph-live-badge is-error":"pm-graph-live-badge"} role="status">
              <GitBranch size={13}/>{liveAtPlayhead.error?"GRAPH ERROR":"GRAPH LINKED"}
            </span>}
            <span className="pm-fps-label">SCENE {doc.layers.length} LAYERS</span>
              <button type="button" className="pm-icon-btn pm-animation-open" aria-label="Open animation workspace" title="Open Animation Workspace" aria-pressed={detailsOpen&&detailsTab==="animation"} onClick={openAnimation}><Waves size={16}/></button>
              <button type="button" className="pm-icon-btn" aria-label="Toggle scene details" aria-pressed={detailsOpen} onClick={()=>setDetailsOpen(v=>!v)}><Info size={16}/></button>
            </div></div>
          <div className="pm-canvas-area">
            <div className="pm-canvas-surface"><SceneCanvas scene={doc} liveGraph={compiledGraph} playing={playing} view={view} tool={tool} selectedLayerId={effectiveSelected}
              onSelectLayer={setSelected} onLayerOffsetChange={moveLayerOffset} onSizeChange={setCanvasSize}
              onLayerMoveStart={id=>{dragGroup.current="drag:"+id;last.current.key="";}}
              onLayerMoveEnd={id=>{if(dragGroup.current==="drag:"+id){dragGroup.current=null;last.current.key="";}}}
              time={time} duration={doc.duration} speed={speed} seekVersion={seekVersion}
              onTimeChange={setTime} onPanChange={(x,y)=>setView(v=>({...v,pan:{x,y}}))}
              onCameraChange={camera=>setView(v=>({...v,...camera}))}/></div>
            <div className="pm-canvas-corner">PARAMYRA · LAYERED ENGINE</div>
            <div className="pm-view-tools" role="toolbar" aria-label="Canvas tools">
              <button type="button" aria-label="Select and move curve" aria-pressed={tool==="select"} onClick={()=>setTool("select")}><MousePointer2 size={15}/></button>
              <button type="button" aria-label="Pan canvas" aria-pressed={tool==="pan"} onClick={()=>setTool("pan")}><Move size={15}/></button>
              <span className="pm-tool-divider"/>
              <button type="button" aria-label="Toggle grid" aria-pressed={view.grid} onClick={()=>setView(v=>({...v,grid:!v.grid}))}><Grid3X3 size={15}/></button>
              <button type="button" aria-label="Toggle axes" aria-pressed={view.axes} onClick={()=>setView(v=>({...v,axes:!v.axes}))}><Plus size={15}/></button>
              <button type="button" aria-label="Toggle curve style" aria-pressed={view.style==="glow"} onClick={()=>setView(v=>({...v,style:v.style==="glow"?"clean":"glow"}))}><Waves size={15}/></button>
              <span>{tool==="select"?"Drag curve to move · Alt+drag to pan":"Drag to pan"}</span>
            </div>
            <div className="pm-zoom">
              <button type="button" aria-label="Zoom out" onClick={()=>setView(v=>({...v,zoom:clampZoom(Math.round((v.zoom-.25)*100)/100)}))}><Minus size={16}/></button>
              <output aria-label="Zoom level">{Math.round(view.zoom*100)}%</output>
              <button type="button" aria-label="Zoom in" onClick={()=>setView(v=>({...v,zoom:clampZoom(Math.round((v.zoom+.25)*100)/100)}))}><Plus size={16}/></button>
              <button type="button" aria-label="Reset zoom" onClick={()=>setView(v=>({...v,zoom:1}))}><Maximize2 size={15}/></button>
              <button type="button" aria-label="Fit scene" onClick={fit}><Move size={15}/></button>
            </div>
          </div>
          <div className="pm-transport"><div className="pm-transport-equation"><span className="pm-label">SELECTED · {layer.title}</span><code>{layer.kind==="formula"?(layer.formula.mode==="parametric"?"x="+layer.formula.exprX+", y="+layer.formula.exprY:layer.formula.mode==="polar"?"r="+layer.formula.exprY:"y="+layer.formula.exprY):layer.kind==="lissajous"?"x = A sin(at + δ), y = B sin(bt)":layer.kind==="polar-rose"?"r = A cos(kθ)":"y = f(x, t)"}</code></div>
            <div className="pm-transport-buttons"><button type="button" className="pm-action pm-action-primary" aria-label={playing?"Pause animation":"Play animation"} onClick={()=>setPlaying(v=>!v)}>{playing?<Pause size={15}/>:<Play size={15}/>} {playing?"Pause":"Play"}</button>
              <button type="button" className="pm-action pm-action-quiet" onClick={resetLayer}><RotateCcw size={15}/> Reset layer</button>
            </div></div>
        </section>
        {detailsOpen&&<section className="pm-details" aria-label="Scene details">
          {detailsTab==="animation"&&<div className="pm-animation-resizer" role="separator" tabIndex={0}
            aria-label="Resize animation workspace" aria-orientation="horizontal" aria-valuemin={300}
            aria-valuemax={Math.max(320,centerHeight-210)} aria-valuenow={animationPanelHeight}
            title="Drag to resize • arrow keys to adjust" onPointerDown={event=>{
              if(event.button!==0)return;
              animationResize.current={pointerId:event.pointerId,startY:event.clientY,height:animationPanelHeight};
              event.currentTarget.setPointerCapture(event.pointerId);
            }} onPointerMove={event=>{
              const resizing=animationResize.current;
              if(resizing?.pointerId===event.pointerId)setEditorHeight(resizing.height+resizing.startY-event.clientY);
            }} onPointerUp={event=>{
              if(animationResize.current?.pointerId===event.pointerId)animationResize.current=null;
            }} onPointerCancel={()=>{animationResize.current=null;}}
            onKeyDown={event=>{
              if(event.key==="ArrowUp"||event.key==="ArrowDown"){
                event.preventDefault();setEditorHeight(animationPanelHeight+(event.key==="ArrowUp"?20:-20));
              } else if(event.key==="Home"){event.preventDefault();setEditorHeight(300);}
              else if(event.key==="End"){event.preventDefault();setEditorHeight(editorHeightMax());}
            }}><span/></div>}
          <div className="pm-details-header"><div className="pm-details-title"><span className="pm-details-symbol">{detailsTab==="animation"?<Waves size={16}/>:<FileJson2 size={16}/>}</span><div><span className="pm-label">{detailsTab==="animation"?"ANIMATION WORKSPACE":"TIMELINE / DOCUMENT"}</span><strong>{detailsTab==="animation"?"Timeline & Graph Editor":"Scene Details"}</strong></div></div>
            <div className="pm-animation-header-actions">
              {detailsTab==="animation"&&<><button type="button" aria-label={animationFocus?"Exit animation focus mode":"Focus animation workspace"} aria-pressed={animationFocus} onClick={()=>setAnimationFocus(v=>!v)}>{animationFocus?<Minimize2 size={14}/>:<Maximize2 size={14}/>} {animationFocus?"Exit Focus":"Focus"}</button>
                <button type="button" aria-label="Restore animation workspace height" onClick={resetEditorHeight}>Reset size</button></>}
              <button type="button" className="pm-icon-btn" aria-label="Collapse scene details" onClick={()=>setDetailsOpen(false)}><ChevronDown size={16}/></button>
            </div>
          </div>
          <div className="pm-timeline"><label htmlFor="timeline-position">Timeline</label><input id="timeline-position" aria-label="Timeline position" type="range" min="0" max={doc.duration} step=".05" value={Math.min(time,doc.duration)} onChange={e=>{setTime(e.target.valueAsNumber);setSeekVersion(v=>v+1);}}/>
            <output>{time.toFixed(1)} / {doc.duration}s</output><select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value=".25">0.25×</option><option value=".5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select>
          </div>
          <div className="pm-tabs" role="tablist" aria-label="Scene detail tabs">
            <button type="button" role="tab" aria-selected={detailsTab==="overview"} onClick={()=>{setDetailsTab("overview");setAnimationFocus(false);}}><Info size={14}/> Overview</button>
            <button type="button" role="tab" aria-selected={detailsTab==="animation"} onClick={openAnimation}><Waves size={14}/> Animation</button>
            <button type="button" role="tab" aria-selected={detailsTab==="json"} onClick={()=>{setDetailsTab("json");setAnimationFocus(false);}}><FileJson2 size={14}/> Scene JSON</button>
            <span className="pm-tabs-meta">VERSION {doc.schemaVersion} · LOCAL ONLY</span>
          </div>
          {detailsTab==="animation"?<div role="tabpanel" className="pm-animation-surface">
            <AnimationTimeline layer={layer} layers={doc.layers} duration={doc.duration} time={Math.min(time,doc.duration)}
              onSelectLayer={id=>{setPlaying(false);setSelected(id);}}
              onSeek={value=>{setPlaying(false);setTime(value);setSeekVersion(v=>v+1);}}
              onEdit={fn=>{setPlaying(false);commit(d=>updateLayer(d,layer.id,fn));}}/>
          </div>:detailsTab==="overview"?<div className="pm-detail-content" role="tabpanel">
            <div className="pm-detail-metric pm-pattern-metric"><span>{pattern.label}</span><strong>{pattern.value}</strong></div>
            {layer.kind==="formula"?<div className="pm-detail-metric"><span>Parameter a</span><strong>{layer.formula.a.toFixed(2)}</strong></div>:<div className="pm-detail-metric"><span>Frequency X</span><strong>{layer.params.frequencyX}</strong></div>}
            {layer.kind==="formula"?<div className="pm-detail-metric"><span>Parameter b</span><strong>{layer.formula.b.toFixed(2)}</strong></div>:<div className="pm-detail-metric"><span>{layer.kind==="polar-rose"?"Curve type":"Frequency Y"}</span><strong>{layer.kind==="polar-rose"?"Polar rose":layer.params.frequencyY}</strong></div>}
            {layer.kind==="formula"?<div className="pm-detail-metric"><span>Parameter c</span><strong>{layer.formula.c.toFixed(2)}</strong></div>:<div className="pm-detail-metric"><span>Amplitude</span><strong>{layer.params.amplitude.toFixed(2)}</strong></div>}
            {layer.kind==="formula"?<div className="pm-detail-metric"><span>Domain</span><strong>{layer.formula.min.toFixed(1)} … {layer.formula.max.toFixed(1)}</strong></div>:<div className="pm-detail-metric"><span>Phase</span><strong>{layer.params.phase.toFixed(2)} rad</strong></div>}
          </div>:<div className="pm-json-view" role="tabpanel"><button type="button" className="pm-json-copy" onClick={()=>{void copy();}}><Copy size={14}/> Copy JSON</button><pre>{JSON.stringify(doc,null,2)}</pre></div>}
        </section>}
        {!detailsOpen&&<button type="button" className="pm-detail-reopen" onClick={()=>setDetailsOpen(true)}><ChevronUp size={16}/> Show scene details</button>}
      </div>
      {inspectorOpen&&<aside className="pm-inspector" aria-label="Scene inspector">
        <header className="pm-inspector-top"><span className="pm-sidebar-mark"><SlidersHorizontal size={18}/></span><div><span className="pm-label">PROPERTIES</span><h2>Inspector</h2><p>Selected mathematical layer</p></div></header>
        <div className="pm-inspector-scroll">
          <section className="pm-inspector-section"><div className="pm-inspector-sectionhead"><span>01 / LAYER</span><Layers3 size={16}/></div>
            <div className="field"><label htmlFor="layer-title">Layer name</label><input id="layer-title" className="pm-textfield" value={layer.title} maxLength={120} onChange={e=>{if(e.target.value)commit(d=>updateLayer(d,layer.id,l=>({...l,title:e.target.value})),"title:"+layer.id);}}/></div>
            <div className="field"><label htmlFor="scene-kind">Mathematical form</label><select id="scene-kind" value={layer.kind} onChange={e=>{
              const selectedKind=e.target.value as SceneKind|"formula";
              commit(d=>updateLayer(d,layer.id,l=>{
                if(selectedKind==="formula")return {...newFormulaLayer(l.id),title:l.title,color:l.color,visible:l.visible,opacity:l.opacity,offset:{...l.offset}};
                const next=presetFor(selectedKind);
                return {...layerFromScene(next,l.id),title:l.title,color:l.color,visible:l.visible,opacity:l.opacity,offset:{...l.offset}};
              }));
            }}>{presets.map(p=><option key={p.kind} value={p.kind}>{p.title}</option>)}<option value="formula">Custom Formula</option></select></div>
            <div className="pm-layer-actions"><button type="button" aria-label="Duplicate layer" disabled={doc.layers.length>=12} onClick={duplicate}><Copy size={14}/> Duplicate</button>
              <button type="button" aria-label="Move layer up" disabled={doc.layers.indexOf(layer)>=doc.layers.length-1} onClick={()=>commit(d=>moveLayer(d,layer.id,1))}>↑</button>
              <button type="button" aria-label="Move layer down" disabled={doc.layers.indexOf(layer)===0} onClick={()=>commit(d=>moveLayer(d,layer.id,-1))}>↓</button>
              <button type="button" className="pm-inspector-delete" aria-label="Delete layer" title={doc.layers.length===1?"At least one layer is required":"Delete selected layer — Undo to restore"} disabled={doc.layers.length===1} onClick={remove}><Trash2 size={15}/> Delete</button></div>
            <div className="pm-style-fields"><label>Color<input type="color" aria-label="Layer color" value={layer.color} onChange={e=>commit(d=>updateLayer(d,layer.id,l=>({...l,color:e.target.value})),"color:"+layer.id)}/></label>
              <label>Opacity<input type="range" aria-label="Layer opacity" min="0" max="1" step=".05" value={layer.opacity} onChange={e=>commit(d=>updateLayer(d,layer.id,l=>({...l,opacity:e.target.valueAsNumber})),"opacity:"+layer.id)}/></label>
            </div>
          </section>
          <AnimationValueComparison layer={layer} time={Math.min(time,doc.duration)} onOpenAnimation={openAnimation}
            liveLayer={liveAtPlayhead.document.layers.find(l=>l.id===layer.id)}
            graphDriven={nodeGraph.binding.enabled&&nodeGraph.binding.layerId===layer.id?liveAtPlayhead.driven:[]}/>
          {nodeGraph.binding.enabled&&<section className="pm-live-inspector-status" aria-label="Live Graph status">
            <strong><GitBranch size={15}/> Live Node Graph</strong>
            <p>{liveAtPlayhead.error??("Target: "+(doc.layers.find(l=>l.id===nodeGraph.binding.layerId)?.title??"Unknown layer")+
              " · Keyframes win on the same property.")}</p>
            <Link href="/studio/graph">Edit live binding →</Link>
          </section>}
          {layer.kind==="formula"&&<FormulaEditor layerId={layer.id} formula={layer.formula} onOpenCalculator={openCalculator} onChange={formula=>commit(d=>updateLayer(d,layer.id,l=>l.kind==="formula"?{...l,formula}:l),"formula:"+layer.id)}/>}
          <section className="pm-inspector-section"><div className="pm-inspector-sectionhead"><span>{layer.kind==="formula"?"03 / STROKE & POSITION":"02 / PARAMETERS"}</span><Waves size={16}/></div>
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
          <section className="pm-inspector-section"><div className="pm-inspector-sectionhead"><span>{layer.kind==="formula"?"04 / PROJECT":"03 / PROJECT"}</span><FileJson2 size={16}/></div>
            <div className="field"><label>Duration (seconds)</label><Numeric label="Duration" min={2} max={60} step={1} value={doc.duration} change={v=>commit(d=>({...d,duration:v}))}/></div>
            <button type="button" className="pm-action pm-action-quiet" onClick={()=>setView(v=>({...v,zoom:1,pan:{x:0,y:0}}))}>Reset camera</button>
            <div className="pm-project-state"><span className="live-indicator"/><div><strong>Browser project</strong><p>Changes are stored locally. Export JSON for backup.</p></div></div>
            <button className="pm-action pm-action-quiet pm-export-wide" type="button" onClick={download}><Download size={15}/> Export current scene</button>
            <p className="status" role="status">{notice||"Scene document v3 · safe AST expressions."}</p>
          </section>
          <section className="pm-inspector-guide" aria-label="Mathematical guide"><span className="pm-label">UNDERSTAND THE MATHEMATICS</span><strong>{layer.title}</strong><p>{guide}</p></section>
        </div>
      </aside>}
    </div>
    <CalculatorWindow open={calculatorOpen} onClose={closeCalculator}
      formula={layer.kind==="formula"?layer.formula:defaultFormula()} onPlot={plotFromCalculator}/>
    <div className="pm-statusbar"><div><span className="pm-status-dot"/> PARAMYRA ENGINE · {doc.layers.length} LAYERS</div><div>SCENE DOCUMENT V3 · ZOOM {Math.round(view.zoom*100)}% · LOCAL PROJECT</div></div>
  </div>;
}

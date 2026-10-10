"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Braces, Check, ChevronRight, CircleDot, Download,
  Focus, GitBranch, Grid2X2, Layers3, Link2, Minus, MousePointer2,
  Play, Plus, Redo2, Search, SlidersHorizontal, Trash2, Undo2, Upload, X,
} from "lucide-react";
import { SceneCanvas } from "./scene-canvas";
import { compileGraph, resolveLiveScene } from "@/core/graph/live";
import { persistGraph, readStoredGraph } from "@/core/graph/storage";
import { commitGraph, initializeGraphHistory, redoGraph, undoGraph } from "@/core/graph/history";
import { documentFromScene, parseDocument, type MathDocument } from "@/core/document/schema";
import { presetFor } from "@/core/scenes/presets";
import { addGraphNode, connectGraph, createGraphNode,
  disconnectGraph, evaluateGraph, inputPorts, parseGraph, projectGraph,
  removeGraphNode, TARGET_PROPERTIES, updateGraphBinding, updateGraphNode,
  type GraphKind, type GraphPort, type GraphNode, type NodeGraph } from "@/core/graph/model";

const DOC_KEY = "paramyra.document.v3";
const WIDTH = 226;
const sync = () => () => {};
const client = () => true;
const server = () => false;
const kindNames: Record<GraphKind, string> = {
  constant: "Number", time: "Time", add: "Add", multiply: "Multiply", sine: "Sine", output: "Property Output",
};
const details: Record<GraphKind, string> = {
  constant: "Fixed numeric input", time: "Playhead time in seconds",
  add: "Sum of two numeric inputs", multiply: "Product of two inputs",
  sine: "sin(x), radians", output: "Send value to Studio layer",
};
const categories: readonly { title: string; kinds: GraphKind[] }[] = [
  { title: "INPUTS", kinds: ["constant", "time"] },
  { title: "OPERATORS", kinds: ["add", "multiply", "sine"] },
  { title: "OUTPUT", kinds: ["output"] },
];
const names: Record<string, string> = {
  opacity: "Opacity", "offset.x": "Position X", "offset.y": "Position Y",
  "params.strokeWidth": "Stroke Width", "formula.a": "Formula A",
  "formula.b": "Formula B", "formula.c": "Formula C",
};
function readDocument(): MathDocument {
  // Match Studio's migration preference before ever writing its authoritative v3 key.
  for (const key of [DOC_KEY, "paramyra.document.v2", "paramyra.scene.v1"]) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? parseDocument(JSON.parse(raw)) : null;
      if (parsed) return parsed;
    } catch { /* unavailable, malformed or unsupported: check next version */ }
  }
  return documentFromScene(presetFor("lissajous"));
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
function anchor(node: GraphNode, port?: GraphPort) {
  if (!port) return { x: node.x + WIDTH, y: node.y + 65 + inputPorts(node.kind).length * 34 };
  return { x: node.x, y: node.y + 65 + inputPorts(node.kind).indexOf(port) * 34 };
}
function fittedViewport(nodes: readonly GraphNode[], width: number, height: number) {
  const minX=Math.min(...nodes.map(node=>node.x));
  const minY=Math.min(...nodes.map(node=>node.y));
  const maxX=Math.max(...nodes.map(node=>node.x+WIDTH));
  const maxY=Math.max(...nodes.map(node=>node.y+170));
  const margin=48;
  const zoom=clamp(Math.min((width-margin*2)/(maxX-minX),(height-margin*2)/(maxY-minY)),.25,1.35);
  return {zoom,x:Math.round((width-(maxX-minX)*zoom)/2-minX*zoom),
    y:Math.round((height-(maxY-minY)*zoom)/2-minY*zoom)};
}
function curve(from: {x:number;y:number}, to:{x:number;y:number}) {
  const pull = Math.max(62, Math.abs(to.x - from.x) * 0.48);
  return "M" + from.x + " " + from.y + " C" + (from.x + pull) + " " + from.y +
    " " + (to.x - pull) + " " + to.y + " " + to.x + " " + to.y;
}
type Drag = { pointerId: number; id: string; clientX: number; clientY: number; x: number; y: number };
type Pan = { pointerId: number; x: number; y: number; clientX: number; clientY: number };

export function NodeGraphClient() {
  const hydrated = useSyncExternalStore(sync, client, server);
  if (!hydrated) return <div className="shell section" role="status">Opening Node Graph Workspace…</div>;
  return <GraphWorkspace />;
}
function GraphWorkspace() {
  const [history, setHistory] = useState(() => initializeGraphHistory(readStoredGraph()));
  const graph = history.present;
  const [documentModel, setDocumentModel] = useState(readDocument);
  const [selectedId, setSelectedId] = useState("product");
  const [layerId, setLayerId] = useState(() => readStoredGraph().binding.layerId ?? readDocument().layers[0].id);
  const [time, setTime] = useState(0);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("Graph edits are local. Apply an output to commit a static value to Studio.");
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [edgeId, setEdgeId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [viewport, setViewport] = useState({ x: 55, y: 90, zoom: 0.78 });
  const [dragPosition, setDragPosition] = useState<{id:string;x:number;y:number}|null>(null);
  const drag = useRef<Drag|null>(null);
  const pan = useRef<Pan|null>(null);
  const canvas = useRef<HTMLDivElement|null>(null);
  const firstGraphNodes = useRef(graph.nodes);
  const importRef = useRef<HTMLInputElement|null>(null);
  const selected = graph.nodes.find(node => node.id === selectedId) ?? null;
  const effectiveLayer = documentModel.layers.some(layer => layer.id === layerId) ? layerId : documentModel.layers[0].id;
  const projection = useMemo(() => projectGraph(documentModel, graph, effectiveLayer, time),
    [documentModel, graph, effectiveLayer, time]);
  const compiled = useMemo(() => compileGraph(graph), [graph]);
  const liveScene = useMemo(() => resolveLiveScene(documentModel,time,compiled),
    [documentModel,time,compiled]);
  const sceneError = graph.binding.enabled ? liveScene.error : projection.error;
  const values = projection.result.values;
  const evaluation = useMemo(() => evaluateGraph(graph, time), [graph, time]);

  useEffect(() => {
    persistGraph(graph);
  }, [graph]);
  useEffect(() => {
    const element=canvas.current;
    if (!element || typeof ResizeObserver==="undefined") return;
    let firstLayout=true;
    const observer=new ResizeObserver(()=>{
      if (!firstLayout)return;
      const rect=element.getBoundingClientRect();
      if (rect.width<100 || rect.height<100)return;
      firstLayout=false;
      setViewport(fittedViewport(firstGraphNodes.current,rect.width,rect.height));
    });
    observer.observe(element);
    return ()=>observer.disconnect();
  },[]);
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key === DOC_KEY) setDocumentModel(readDocument());
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement|null;
      if (target?.closest("input,textarea,select,[contenteditable=true]")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setHistory(event.shiftKey ? redoGraph : undoGraph);
      } else if (event.key === "Escape") {
        setActiveSource(null);
        setEdgeId(null);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        if (edgeId) { event.preventDefault(); setHistory(h => commitGraph(h, disconnectGraph(h.present, edgeId))); setEdgeId(null); }
        else if (selectedId) { event.preventDefault(); setHistory(h => commitGraph(h, removeGraphNode(h.present, selectedId))); setSelectedId(""); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [edgeId, selectedId]);
  const commit = (update:(current:NodeGraph)=>NodeGraph) => setHistory(h => commitGraph(h, update(h.present)));
  const toggleLive = () => {
    const enabled=!graph.binding.enabled;
    const next=updateGraphBinding(graph,{enabled,layerId:enabled?effectiveLayer:graph.binding.layerId,priority:"keyframes-win"});
    if(next===graph){setNotice("Unable to enable Live Graph on this layer.");return;}
    commit(()=>next);
    setNotice(enabled?"Live Graph enabled. Timeline keyframes have priority on conflicting channels.":
      "Live Graph disabled. Studio uses base values and keyframes.");
  };
  const add = (kind:GraphKind) => {
    const node = createGraphNode(kind, crypto.randomUUID(), 240 + graph.nodes.length * 26, 120 + graph.nodes.length * 22);
    const next = addGraphNode(graph, node);
    if (next === graph) return setNotice("Node limit reached or output property already in use. Choose a different target property.");
    commit(() => next);
    setSelectedId(node.id);
    setEdgeId(null);
    setNotice(kindNames[kind] + " node added.");
  };
  const connect = (source:string, target:string, port:GraphPort) => {
    const next = connectGraph(graph, source, target, port, crypto.randomUUID());
    if (next === graph) setNotice("Connection rejected: check input compatibility, cycles and duplicate slots.");
    else { commit(() => next); setNotice("Numeric connection created."); }
    setActiveSource(null);
  };
  const startMove = (event:ReactPointerEvent<HTMLElement>, node:GraphNode) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(node.id);
    setEdgeId(null);
    drag.current = { pointerId: event.pointerId, id: node.id, clientX:event.clientX, clientY:event.clientY, x:node.x, y:node.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveNode = (event:ReactPointerEvent<HTMLElement>) => {
    const state=drag.current;
    if (!state || event.pointerId !== state.pointerId) return;
    setDragPosition({ id:state.id,
      x:clamp(Math.round(state.x + (event.clientX-state.clientX)/viewport.zoom),0,2200),
      y:clamp(Math.round(state.y + (event.clientY-state.clientY)/viewport.zoom),0,1600) });
  };
  const finishMove = (event:ReactPointerEvent<HTMLElement>) => {
    const state=drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    drag.current=null;
    const x=clamp(Math.round(state.x+(event.clientX-state.clientX)/viewport.zoom),0,2200);
    const y=clamp(Math.round(state.y+(event.clientY-state.clientY)/viewport.zoom),0,1600);
    setDragPosition(null);
    if (x !== state.x || y !== state.y) commit(old => updateGraphNode(old,state.id,{x,y}));
  };
  const panStart=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if (event.button !== 0 || (event.target as HTMLElement).closest(".pm-ng-node,.pm-ng-minimap,.pm-ng-canvas-controls")) return;
    pan.current={pointerId:event.pointerId,x:viewport.x,y:viewport.y,clientX:event.clientX,clientY:event.clientY};
    setEdgeId(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const panMove=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if (!pan.current || pan.current.pointerId !== event.pointerId) return;
    const p=pan.current;
    setViewport(old=>({...old,x:p.x+event.clientX-p.clientX,y:p.y+event.clientY-p.clientY}));
  };
  const panEnd=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if (pan.current?.pointerId===event.pointerId) pan.current=null;
  };
  const fit=()=>{
    const rect=canvas.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    setViewport(fittedViewport(graph.nodes,rect.width,rect.height));
  };
  const apply=()=>{
    // Re-read the authoritative Studio document immediately before the write.
    const current=readDocument();
    const result=projectGraph(current,graph,current.layers.some(layer=>layer.id===effectiveLayer)?effectiveLayer:current.layers[0].id,time);
    if (graph.binding.enabled) return setNotice("Disable Live Graph before baking static values.");
    if (result.error) return setNotice("Not applied: "+result.error);
    if (result.document === current) return setNotice("No outputs to apply.");
    try {
      localStorage.setItem(DOC_KEY,JSON.stringify(result.document));
      setDocumentModel(result.document);
      setNotice("Applied static graph outputs to the Studio document. Open Studio to see the saved result.");
    } catch { setNotice("Local storage is unavailable; no Studio changes were saved."); }
  };
  const exportGraph=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(graph,null,2)],{type:"application/json"}));
    const a=document.createElement("a");
    a.href=url;a.download="paramyra-nodegraph.json";a.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const importGraph=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];
    event.target.value="";
    if (!file) return;
    if (file.size>65536) return setNotice("Graph file exceeds 64 KB.");
    try {
      const parsed=parseGraph(JSON.parse(await file.text()));
      if (!parsed) return setNotice("Invalid graph: schema, inputs, IDs or cycle validation failed.");
      commit(()=>parsed);
      setSelectedId("");
      setEdgeId(null);
      setActiveSource(null);
      setLayerId(parsed.binding.layerId??effectiveLayer);
      setNotice("Validated graph imported. Live binding state restored from the file.");
    } catch { setNotice("Unable to import graph JSON."); }
  };
  const graphPositions = useMemo(() => {
    const positioned=new Map(graph.nodes.map(node=>[node.id,node]));
    if (dragPosition) {
      const node=positioned.get(dragPosition.id);
      if (node) positioned.set(node.id,{...node,x:dragPosition.x,y:dragPosition.y});
    }
    return positioned;
  },[graph,dragPosition]);
  const selectedEdge = graph.edges.find(edge=>edge.id===edgeId);
  const connectedOutput = graph.nodes.filter(node=>node.kind==="output").length;

  return <div className="pm-ng-root" aria-label="Node Graph Workspace">
    <header className="pm-ng-projectbar">
      <div className="pm-ng-identity">
        <Link href="/studio" aria-label="Back to Studio" className="pm-ng-icon"><ArrowLeft size={17}/></Link>
        <span className="pm-ng-app-icon"><GitBranch size={21}/></span>
        <div className="pm-ng-title"><span>PARAMYRA / WORKSPACES</span><h1>Node Graph <small>v1.0 · M3</small></h1></div>
      </div>
      <nav className="pm-ng-modes" aria-label="Workspace modes">
        <Link href="/studio"><Layers3 size={15}/> Studio</Link>
        <Link href="/studio/graph" aria-current="page"><GitBranch size={15}/> Graph</Link>
      </nav>
      <div className="pm-ng-actions">
        <button type="button" className="pm-ng-icon" title="Undo" aria-label="Undo graph edit" disabled={!history.past.length} onClick={()=>setHistory(undoGraph)}><Undo2 size={17}/></button>
        <button type="button" className="pm-ng-icon" title="Redo" aria-label="Redo graph edit" disabled={!history.future.length} onClick={()=>setHistory(redoGraph)}><Redo2 size={17}/></button>
        <button type="button" className="pm-ng-icon" title="Toggle library" aria-label="Toggle graph library" aria-pressed={libraryOpen} onClick={()=>setLibraryOpen(open=>!open)}><Grid2X2 size={17}/></button>
        <button type="button" className="pm-ng-icon" title="Toggle inspector" aria-label="Toggle graph inspector" aria-pressed={inspectorOpen} onClick={()=>setInspectorOpen(open=>!open)}><SlidersHorizontal size={17}/></button>
        <input ref={importRef} type="file" accept=".json,application/json" className="sr-only" aria-label="Import graph JSON" onChange={importGraph}/>
        <button className="pm-ng-button" type="button" onClick={()=>importRef.current?.click()}><Upload size={15}/> Import</button>
        <button className="pm-ng-button" type="button" onClick={exportGraph}><Download size={15}/> Export</button>
        <button className="pm-ng-button pm-ng-primary" type="button" onClick={apply} disabled={!!projection.error||!connectedOutput||graph.binding.enabled}><Play size={15}/> Apply to Studio</button>
      </div>
    </header>
    <div className={"pm-ng-layout"+(!libraryOpen?" no-library":"")+(!inspectorOpen?" no-inspector":"")}>
      {libraryOpen&&<aside className="pm-ng-library" aria-label="Node library">
        <div className="pm-ng-pane-header"><span className="pm-ng-eyebrow">NODE LIBRARY</span><h2>Building blocks</h2><p>Compose mathematics with typed numeric ports.</p></div>
        <label className="pm-ng-search"><Search size={15}/><input type="search" aria-label="Search graph nodes" placeholder="Search nodes…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <div className="pm-ng-library-scroll">
        {categories.map(group=>{
          const kinds=group.kinds.filter(kind=>(kindNames[kind]+" "+details[kind]).toLowerCase().includes(query.toLowerCase()));
          return kinds.length?<section key={group.title}><h3>{group.title}</h3>{kinds.map(kind=><button type="button" key={kind} onClick={()=>add(kind)} className="pm-ng-library-item">
            <span className={"pm-ng-library-icon kind-"+kind}>{kind==="time"?<CircleDot size={17}/>:kind==="output"?<ArrowRight size={17}/>:<Braces size={17}/>}</span>
            <span><strong>{kindNames[kind]}</strong><small>{details[kind]}</small></span><Plus size={16}/>
          </button>)}</section>:null;
        })}
        </div>
        <div className="pm-ng-library-footer"><div className="pm-ng-info-mark"><Check size={14}/> Deterministic DAG</div><p>Only local numeric operations. No arbitrary JavaScript or network execution.</p></div>
      </aside>}
      <section className="pm-ng-center" aria-label="Graph editor">
        <div className="pm-ng-canvasbar">
          <div><span className="pm-ng-eyebrow">GRAPH CANVAS · LOCAL</span><h2>{graph.title}</h2></div>
          <div className="pm-ng-canvas-meta"><span>{graph.nodes.length} NODES</span><span>{graph.edges.length} LINKS</span><span className={sceneError?"pm-ng-error-dot":"pm-ng-ok-dot"}>{sceneError?"INVALID OUTPUT":graph.binding.enabled?"LIVE BINDING":"READY"}</span></div>
        </div>
        <div className="pm-ng-board" ref={canvas} tabIndex={0} aria-label="Interactive node canvas" onPointerDown={panStart} onPointerMove={panMove} onPointerUp={panEnd} onPointerCancel={panEnd} onLostPointerCapture={panEnd}>
          <div className="pm-ng-world" style={{transform:"translate("+viewport.x+"px,"+viewport.y+"px) scale("+viewport.zoom+")"}}>
            <svg className="pm-ng-wires" width="2600" height="1900" aria-hidden="true">
              <defs><linearGradient id="ng-wire" x1="0" x2="1"><stop offset="0%" stopColor="#76b6ff"/><stop offset="100%" stopColor="#8aebd9"/></linearGradient></defs>
              {graph.edges.map(edge=>{
                const source=graphPositions.get(edge.source),target=graphPositions.get(edge.target);
                if (!source||!target)return null;
                const d=curve(anchor(source),anchor(target,edge.port));
                return <g key={edge.id} className={edgeId===edge.id?"is-selected":""}>
                  <path d={d} className="pm-ng-wire-glow"/>
                  <path d={d} className="pm-ng-wire" stroke={edgeId===edge.id?"#c3e9ff":"url(#ng-wire)"}/>
                </g>;
              })}
            </svg>
            {graph.nodes.map(node=>{
              const p=graphPositions.get(node.id)??node;
              const selected=selectedId===node.id;
              const ports=inputPorts(node.kind);
              return <article key={node.id} className={"pm-ng-node kind-"+node.kind+(selected?" is-selected":"")} style={{left:p.x,top:p.y,width:WIDTH}} aria-label={node.title+" node"}>
                <header className="pm-ng-node-header" onPointerDown={event=>startMove(event,node)} onPointerMove={moveNode} onPointerUp={finishMove} onPointerCancel={finishMove} onLostPointerCapture={finishMove}>
                  <span className="pm-ng-node-indicator"/><strong>{node.title}</strong><span className="pm-ng-node-type">{node.kind}</span>
                </header>
                {ports.map(port=><button key={port} type="button" className="pm-ng-port-row input" aria-label={"Connect "+node.title+" input "+port} onClick={()=>{
                  setSelectedId(node.id);setEdgeId(null);
                  if(activeSource)connect(activeSource,node.id,port);
                  else setNotice("Choose a source output port first, then this input.");
                }}>
                  <span className={"pm-ng-handle"+(activeSource?" accepting":"")}/><span>{port.toUpperCase()}</span><small>{graph.edges.some(edge=>edge.target===node.id&&edge.port===port)?"Connected":"Number"}</small>
                </button>)}
                {node.kind!=="output"?<button type="button" className={"pm-ng-port-row output"+(activeSource===node.id?" pending":"")} aria-label={"Use "+node.title+" output as source"} onClick={()=>{
                    setSelectedId(node.id);setEdgeId(null);setActiveSource(activeSource===node.id?null:node.id);
                  }}>
                    <span>RESULT</span><small>{values[node.id]===undefined?"Number":values[node.id].toFixed(3)}</small><span className="pm-ng-handle"/>
                  </button>:<div className="pm-ng-output-destination"><ChevronRight size={13}/>{names[node.property!]}</div>}
              </article>;
            })}
          </div>
          {activeSource&&<div className="pm-ng-connect-hint" role="status"><Link2 size={15}/> Choose an input port <button type="button" onClick={()=>setActiveSource(null)} aria-label="Cancel connection"><X size={15}/></button></div>}
          <div className="pm-ng-canvas-controls">
            <button type="button" aria-label="Zoom graph out" title="Zoom out" onClick={()=>setViewport(v=>({...v,zoom:clamp(Number((v.zoom-.15).toFixed(2)),.25,2)}))}><Minus size={17}/></button>
            <output aria-label="Graph zoom">{Math.round(viewport.zoom*100)}%</output>
            <button type="button" aria-label="Zoom graph in" title="Zoom in" onClick={()=>setViewport(v=>({...v,zoom:clamp(Number((v.zoom+.15).toFixed(2)),.25,2)}))}><Plus size={17}/></button>
            <button type="button" aria-label="Fit graph" title="Fit to graph" onClick={fit}><Focus size={17}/></button>
          </div>
          <div className="pm-ng-minimap" aria-label="Node minimap"><svg viewBox="0 0 2400 1750" role="img" aria-label="Graph node positions">
            {graph.nodes.map(node=><rect key={node.id} x={node.x} y={node.y} width={WIDTH} height={145} rx="17" fill={node.id===selectedId?"#91baff":"#57759b"} stroke="#a4b9d4" strokeWidth="5"/>)}
          </svg><span>OVERVIEW</span></div>
        </div>
        <div className="pm-ng-footer">
          <div className="pm-ng-footer-left"><MousePointer2 size={15}/> Drag nodes to arrange · click output, then input to connect · click an edge in Inspector to remove</div>
          <span>ZOOM {Math.round(viewport.zoom*100)}% <span className="pm-ng-divider"/> NUMERIC / ACYCLIC</span>
        </div>
      </section>
      {inspectorOpen&&<aside className="pm-ng-inspector" aria-label="Graph inspector">
        <div className="pm-ng-pane-header"><span className="pm-ng-eyebrow">INSPECTOR</span><h2>Properties</h2><p>Configuration and deterministic output.</p></div>
        <div className="pm-ng-inspector-scroll">
          {selected?<section className="pm-ng-inspector-section">
            <h3><span>01 / SELECTED NODE</span><CircleDot size={15}/></h3>
            <div className="pm-ng-inspector-highlight"><span className={"pm-ng-library-icon kind-"+selected.kind}><Braces size={19}/></span><div><strong>{kindNames[selected.kind]}</strong><small>{selected.kind} · numeric</small></div></div>
            <label className="pm-ng-field">Name<input aria-label="Node title" maxLength={64} value={selected.title} onChange={e=>commit(old=>updateGraphNode(old,selected.id,{title:e.target.value}))}/></label>
            {selected.kind==="constant"&&<label className="pm-ng-field">Number<input type="number" aria-label="Constant value" min="-100000" max="100000" step="0.1" value={selected.value??0} onChange={e=>{
              const next=e.target.valueAsNumber;
              if(Number.isFinite(next))commit(old=>updateGraphNode(old,selected.id,{value:next}));
            }}/></label>}
            {selected.kind==="output"&&<label className="pm-ng-field">Target property<select aria-label="Output property" value={selected.property} onChange={e=>{
              const next=updateGraphNode(graph,selected.id,{property:e.target.value as GraphNode["property"]});
              if (next===graph) setNotice("Only one output may write each target property.");
              else commit(()=>next);
            }}>{TARGET_PROPERTIES.map(prop=><option key={prop} value={prop}>{names[prop]}</option>)}</select></label>}
            <div className="pm-ng-values"><span>Evaluated value</span><output aria-label="Selected node value">{values[selected.id]===undefined?"—":values[selected.id].toFixed(4)}</output></div>
            <button className="pm-ng-danger" disabled={graph.nodes.length===1} type="button" onClick={()=>{commit(old=>removeGraphNode(old,selected.id));setSelectedId("");}}><Trash2 size={15}/> Delete node</button>
          </section>:<section className="pm-ng-inspector-section pm-ng-empty"><Braces size={24}/><h3>Select a node</h3><p>Click a node header to edit its parameters.</p></section>}
          <section className="pm-ng-inspector-section">
            <h3><span>02 / CONNECTIONS</span><Link2 size={15}/></h3>
            <label className="pm-ng-field">Select a link<select aria-label="Selected graph connection" value={edgeId??""} onChange={e=>setEdgeId(e.target.value||null)}>
              <option value="">Choose connection…</option>
              {graph.edges.map(edge=><option key={edge.id} value={edge.id}>{graph.nodes.find(n=>n.id===edge.source)?.title} → {graph.nodes.find(n=>n.id===edge.target)?.title} / {edge.port}</option>)}
            </select></label>
            <button type="button" className="pm-ng-danger" disabled={!selectedEdge} onClick={()=>{if(edgeId)commit(old=>disconnectGraph(old,edgeId));setEdgeId(null);}}><X size={14}/> Disconnect selected</button>
          </section>
          <section className="pm-ng-inspector-section">
            <h3><span>03 / SCENE OUTPUT</span><Layers3 size={15}/></h3>
            <div className="pm-ng-live-panel" role="group" aria-label="Live Graph binding">
              <div className="pm-ng-live-heading"><strong>Live Graph</strong><span>{graph.binding.enabled?"ACTIVE":"OFF"}</span></div>
              <p>Evaluate at the Studio playhead on every animation frame. Existing keyframes win when targeting the same property.</p>
              <label className="pm-ng-live-switch"><input type="checkbox" aria-label="Enable Live Graph" checked={graph.binding.enabled} onChange={toggleLive}/> Enable real-time scene binding</label>
              {graph.binding.enabled&&<p className="pm-ng-note">Binding target: {documentModel.layers.find(layer=>layer.id===graph.binding.layerId)?.title??"Missing layer"}. Graph editing is saved separately from Studio.</p>}
              {liveScene.blocked.length>0&&graph.binding.enabled&&<p className="pm-ng-note" role="status">Keyframes override: {liveScene.blocked.map(property=>names[property]).join(", ")}</p>}
            </div>
            <label className="pm-ng-field">Studio layer<select aria-label="Target Studio layer" value={effectiveLayer} onChange={e=>{
              setLayerId(e.target.value);
              if(graph.binding.enabled)commit(old=>updateGraphBinding(old,{...old.binding,layerId:e.target.value}));
            }}>
              {documentModel.layers.map(layer=><option value={layer.id} key={layer.id}>{layer.title}</option>)}
            </select></label>
            <label className="pm-ng-field">Time (seconds)<input type="range" aria-label="Graph time" min={0} max={documentModel.duration} step=".05" value={time} onChange={e=>setTime(e.target.valueAsNumber)}/></label>
            <div className="pm-ng-values"><span>Playhead</span><output aria-label="Graph time value">{time.toFixed(2)}s</output></div>
            <div className="pm-ng-preview" aria-label="Graph scene preview">
              <SceneCanvas scene={graph.binding.enabled?liveScene.document:projection.document} time={time} seekVersion={time} playing={false}/>
            </div>
            <div className="pm-ng-output-values">{Object.entries(evaluation.outputs).map(([name,value])=><div key={name}><span>{names[name]}</span><strong>{value.toFixed(4)}</strong></div>)}</div>
            <p className={sceneError?"pm-ng-validation-error":"pm-ng-validation-ok"} role="status">{sceneError??(graph.binding.enabled?"Live output is active; keyframes take precedence.":"Graph output is valid for the selected layer.")}</p>
            <button type="button" className="pm-ng-button pm-ng-primary pm-ng-apply" onClick={apply} disabled={!!projection.error||!connectedOutput||graph.binding.enabled}>Apply static values <ArrowRight size={15}/></button>
            <p className="pm-ng-note">Live mode computes at the shared animation time without modifying base data. Disable Live to apply a static snapshot.</p>
          </section>
        </div>
      </aside>}
    </div>
    <div className="pm-ng-statusbar"><span><span className={sceneError?"pm-ng-error-dot":"pm-ng-ok-dot"}/> PARAMYRA GRAPH ENGINE <span className="pm-ng-divider"/> LOCAL / NO EXECUTABLE CODE</span><span role="status" aria-live="polite" className="pm-ng-status-text">{notice}</span><span>{graph.nodes.length} NODES · {graph.edges.length} EDGES</span></div>
  </div>;
}

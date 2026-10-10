"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Braces, Check, CircleDot, Download,
  GitBranch, Grid2X2, Layers3, Link2, Play, Plus, Redo2, Search, SlidersHorizontal, Trash2, Undo2, Upload, X,
  Copy, ClipboardPaste, Group, Ungroup, Maximize2, Minimize2, FileArchive, ListTree, CheckSquare,
} from "lucide-react";
import { SceneCanvas } from "./scene-canvas";
import { makeProjectBundle,parseProjectBundle,restoreProjectBundle } from "@/core/graph/project-bundle";
import { copyGraphSelection,parseGraphSelection,pasteGraphSelection,deleteGraphSelection,
  moveGraphSelection,groupGraphNodes,ungroupGraphNodes,type GraphSelection } from "@/core/graph/workspace";
import { GraphReactFlowCanvas } from "./graph-react-flow";
import { compileGraph, resolveLiveScene } from "@/core/graph/live";
import { persistGraph, readStoredGraph } from "@/core/graph/storage";
import { commitGraph, initializeGraphHistory, redoGraph, undoGraph } from "@/core/graph/history";
import { documentFromScene, parseDocument, type MathDocument } from "@/core/document/schema";
import { presetFor } from "@/core/scenes/presets";
import { addGraphNode, connectGraph, createGraphNode,
  disconnectGraph, evaluateGraph, parseGraph, projectGraph,
  removeGraphNode, TARGET_PROPERTIES, updateGraphBinding, updateGraphNode,
  type GraphKind, type GraphPort, type GraphNode, type NodeGraph } from "@/core/graph/model";

const DOC_KEY = "paramyra.document.v3";
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
  const [selectedIds,setSelectedIds]=useState<string[]>(["product"]);
  const [selectedGroupId,setSelectedGroupId]=useState<string|null>(null);
  const [fullscreen,setFullscreen]=useState(false);
  const [layerId, setLayerId] = useState(() => readStoredGraph().binding.layerId ?? readDocument().layers[0].id);
  const [time, setTime] = useState(0);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("Graph edits are local. Apply an output to commit a static value to Studio.");
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [edgeId, setEdgeId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const importRef = useRef<HTMLInputElement|null>(null);
  const projectImportRef=useRef<HTMLInputElement|null>(null);
  const clipboard=useRef<GraphSelection|null>(null);
  const pasteCount=useRef(0);
  const rootRef=useRef<HTMLDivElement|null>(null);
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
    const listener = (event: StorageEvent) => {
      if (event.key === DOC_KEY) setDocumentModel(readDocument());
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);
  const commit = (update:(current:NodeGraph)=>NodeGraph) => setHistory(h => commitGraph(h, update(h.present)));
  const copySelected=()=>{
    const content=copyGraphSelection(graph,selectedIds);
    if(!content)return setNotice("Select one or more nodes to copy.");
    clipboard.current=content;
    pasteCount.current=0;
    if(navigator.clipboard?.writeText)void navigator.clipboard.writeText(JSON.stringify(content)).catch(()=>{});
    setNotice("Copied "+content.nodes.length+" nodes and "+content.edges.length+" internal links.");
  };
  const pasteSelected=async()=>{
    let content=clipboard.current;
    if(!content&&navigator.clipboard?.readText){
      try{
        const text=await navigator.clipboard.readText();
        const parsed=JSON.parse(text) as unknown;
        // parse and validate in the domain layer, not in the renderer.
        content=parseGraphSelection(parsed);
      }catch{/* clipboard may be private or unavailable */}
    }
    if(!content)return setNotice("Graph clipboard is empty. Select and copy nodes first.");
    const result=pasteGraphSelection(graph,content,()=>crypto.randomUUID(),56+pasteCount.current*40);
    if(result.error)return setNotice(result.error);
    pasteCount.current+=1;
    commit(()=>result.graph);
    setSelectedIds(result.nodeIds);setSelectedId(result.nodeIds[0]??"");
    setSelectedGroupId(null);
    setNotice("Pasted "+result.nodeIds.length+" nodes as one Undo operation.");
  };
  const deleteSelected=()=>{
    if(selectedGroupId){
      commit(old=>ungroupGraphNodes(old,selectedGroupId));setSelectedGroupId(null);
      setNotice("Group removed; nodes preserved.");return;
    }
    const ids=selectedIds.length?selectedIds:selectedId?[selectedId]:[];
    const next=deleteGraphSelection(graph,ids);
    if(next===graph)return setNotice("Cannot delete all nodes. Keep at least one graph node.");
    commit(()=>next);setSelectedIds([]);setSelectedId("");
    setNotice("Deleted selected nodes and their connected links.");
  };
  const groupSelected=()=>{
    const next=groupGraphNodes(graph,selectedIds,crypto.randomUUID(),"Group "+(graph.groups.length+1));
    if(next===graph)return setNotice("Select at least two ungrouped nodes to create a group.");
    commit(()=>next);setSelectedGroupId(next.groups[next.groups.length-1].id);
    setSelectedIds([]);setSelectedId("");
    setNotice("Group created. Drag its header to move members together.");
  };
  const ungroupSelected=()=>{
    const target=selectedGroupId??graph.groups.find(g=>selectedIds.some(id=>g.nodeIds.includes(id)))?.id;
    if(!target)return setNotice("Select a group or one of its members.");
    commit(old=>ungroupGraphNodes(old,target));setSelectedGroupId(null);
    setNotice("Ungrouped nodes remain in the graph.");
  };
  const moveSelected=(ids:readonly string[],dx:number,dy:number)=>{
    const next=moveGraphSelection(graph,ids,dx,dy);
    if(next===graph){setNotice("Group movement rejected: a node would exceed canvas bounds.");return;}
    commit(()=>next);
  };
  const fullscreenToggle=async()=>{
    try{
      if(document.fullscreenElement===rootRef.current)await document.exitFullscreen();
      else if(!document.fullscreenElement)await rootRef.current?.requestFullscreen();
    }catch{setNotice("Fullscreen is unavailable in this browser.");}
  };
  useEffect(()=>{
    const update=()=>setFullscreen(document.fullscreenElement===rootRef.current);
    document.addEventListener("fullscreenchange",update);
    return()=>document.removeEventListener("fullscreenchange",update);
  },[]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null;
      if(target?.closest("input,textarea,select,[contenteditable=true]"))return;
      const command=event.ctrlKey||event.metaKey;
      const key=event.key.toLowerCase();
      if(command&&key==="z"){event.preventDefault();setHistory(event.shiftKey?redoGraph:undoGraph);}
      else if(command&&key==="a"){event.preventDefault();setSelectedIds(graph.nodes.map(n=>n.id));setSelectedId("");setSelectedGroupId(null);}
      else if(command&&key==="c"){event.preventDefault();copySelected();}
      else if(command&&key==="v"){event.preventDefault();void pasteSelected();}
      else if(command&&key==="g"){
        event.preventDefault();if(event.shiftKey)ungroupSelected();else groupSelected();
      }else if(key==="escape"){setActiveSource(null);setEdgeId(null);setSelectedGroupId(null);}
      else if(key==="delete"||key==="backspace"){
        event.preventDefault();
        if(edgeId){commit(old=>disconnectGraph(old,edgeId));setEdgeId(null);}
        else deleteSelected();
      }
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  });
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
  const chooseSource = (id:string)=>{
    setSelectedId(id);setEdgeId(null);
    setActiveSource(current=>current===id?null:id);
  };
  const chooseTarget = (target:string,port:GraphPort)=>{
    setSelectedId(target);setEdgeId(null);
    if(activeSource)connect(activeSource,target,port);
    else setNotice("Click a source RESULT or drag its handle to the input.");
  };
  const move = (id:string,point:{x:number;y:number})=>{
    commit(old=>updateGraphNode(old,id,{x:point.x,y:point.y}));
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
  const exportProject=()=>{
    const bundle=makeProjectBundle(readDocument(),graph);
    if(!bundle)return setNotice("Project is invalid: check the graph binding and scene layers.");
    const url=URL.createObjectURL(new Blob([JSON.stringify(bundle,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="paramyra-project.json";a.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    setNotice("Exported one portable project file containing the scene and node graph.");
  };
  const importProject=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];event.target.value="";
    if(!file)return;
    if(file.size>524288)return setNotice("Project file is larger than 512 KB.");
    try{
      const bundle=parseProjectBundle(JSON.parse(await file.text()));
      if(!bundle)return setNotice("Project rejected: invalid scene, graph, or live target.");
      if(!restoreProjectBundle(bundle,localStorage))
        return setNotice("Unable to save the project. Previous scene was preserved where storage permits.");
      setDocumentModel(bundle.scene);
      setHistory(initializeGraphHistory(bundle.graph));
      setLayerId(bundle.graph.binding.layerId??bundle.scene.layers[0].id);
      setSelectedIds([]);setSelectedId("");setSelectedGroupId(null);setEdgeId(null);
      setNotice("Project imported: scene and graph restored. Undo history reset.");
    }catch{setNotice("Unable to import the project file.");}
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
      setSelectedId("");setSelectedIds([]);setSelectedGroupId(null);
      setEdgeId(null);
      setActiveSource(null);
      setLayerId(parsed.binding.layerId??effectiveLayer);
      setNotice("Validated graph imported. Live binding state restored from the file.");
    } catch { setNotice("Unable to import graph JSON."); }
  };
  const selectedEdge = graph.edges.find(edge=>edge.id===edgeId);
  const connectedOutput = graph.nodes.filter(node=>node.kind==="output").length;

  return <div className={"pm-ng-root"+(fullscreen?" pm-ng-fullscreen":"")} ref={rootRef} aria-label="Node Graph Workspace">
    <header className="pm-ng-projectbar">
      <div className="pm-ng-identity">
        <Link href="/studio" aria-label="Back to Studio" className="pm-ng-icon"><ArrowLeft size={17}/></Link>
        <span className="pm-ng-app-icon"><GitBranch size={21}/></span>
        <div className="pm-ng-title"><span>PARAMYRA / WORKSPACES</span><h1>Node Graph <small>v1.0 · M3.3</small></h1></div>
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
        <button type="button" className="pm-ng-icon" title="Fullscreen workspace" aria-label={fullscreen?"Exit graph fullscreen":"Enter graph fullscreen"} aria-pressed={fullscreen} onClick={()=>{void fullscreenToggle();}}>{fullscreen?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button>
        <input ref={importRef} type="file" accept=".json,application/json" className="sr-only" aria-label="Import graph JSON" onChange={importGraph}/>
        <button className="pm-ng-button" type="button" onClick={()=>importRef.current?.click()}><Upload size={15}/> Import</button>
        <button className="pm-ng-button" type="button" onClick={exportGraph}><Download size={15}/> Export</button>
        <button className="pm-ng-button pm-ng-primary" type="button" onClick={apply} disabled={!!projection.error||!connectedOutput||graph.binding.enabled}><Play size={15}/> Apply to Studio</button>
      </div>
    </header>
    <div className="pm-ng-commandbar" role="toolbar" aria-label="Graph editing commands">
      <span className="pm-ng-command-label"><ListTree size={15}/> GRAPH WORKSPACE</span>
      <button type="button" aria-label="Select all nodes" onClick={()=>{setSelectedIds(graph.nodes.map(n=>n.id));setSelectedId("");setSelectedGroupId(null);}}><CheckSquare size={15}/> Select all</button>
      <button type="button" aria-label="Copy selected nodes" disabled={!selectedIds.length} onClick={copySelected}><Copy size={15}/> Copy</button>
      <button type="button" aria-label="Paste nodes" onClick={()=>{void pasteSelected();}}><ClipboardPaste size={15}/> Paste</button>
      <button type="button" aria-label="Group selected nodes" disabled={selectedIds.length<2} onClick={groupSelected}><Group size={15}/> Group</button>
      <button type="button" aria-label="Ungroup selected nodes" disabled={!selectedGroupId&&!graph.groups.some(g=>selectedIds.some(id=>g.nodeIds.includes(id)))} onClick={ungroupSelected}><Ungroup size={15}/> Ungroup</button>
      <button type="button" aria-label="Delete selected nodes" disabled={!selectedIds.length&&!selectedGroupId} onClick={deleteSelected}><Trash2 size={15}/> Delete</button>
      <span className="pm-ng-command-separator"/>
      <input ref={projectImportRef} className="sr-only" type="file" accept=".json,application/json" aria-label="Import full project JSON" onChange={importProject}/>
      <button type="button" aria-label="Import full project" onClick={()=>projectImportRef.current?.click()}><Upload size={15}/> Import Project</button>
      <button type="button" aria-label="Export full project" onClick={exportProject}><FileArchive size={15}/> Export Project</button>
      <span className="pm-ng-selection-summary" aria-label="Selected node count">{selectedIds.length} selected · {graph.groups.length} groups</span>
    </div>
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
        <div className="pm-ng-board" aria-label="Interactive node canvas">
          <GraphReactFlowCanvas graph={graph} selectedNodeId={selectedId}
            selectedNodeIds={selectedIds} selectedGroupId={selectedGroupId}
            selectedEdgeId={edgeId} values={values} activeSource={activeSource}
            onSelectNode={setSelectedId} onSelectNodes={setSelectedIds}
            onSelectGroup={setSelectedGroupId} onMoveBatch={moveSelected}
            onSelectEdge={setEdgeId}
            onSource={chooseSource} onTarget={chooseTarget} onCancel={()=>setActiveSource(null)}
            onConnect={connect} onMove={move}
            onDisconnect={id=>{commit(old=>disconnectGraph(old,id));setEdgeId(null);
              setNotice("Connection removed.");}}/>
        </div>
        <div className="pm-ng-footer">
          <div className="pm-ng-footer-left"><Link2 size={15}/> Drag to multi-select · Shift/Ctrl-click to extend · Space+drag pans · Ctrl/⌘ C,V,G,Z</div>
          <span>REACT FLOW <span className="pm-ng-divider"/> TYPED DAG</span>
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

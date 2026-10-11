"use client";

import { memo, useCallback, useMemo, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Handle, Position, Background, BackgroundVariant,
  Controls, MiniMap, Panel, useReactFlow, MarkerType, ConnectionMode,
  type Connection, type Edge, type Node, type NodeChange, type NodeProps,
  type XYPosition,
} from "@xyflow/react";
import { ArrowRight, CircleDot, Focus, GitBranch, Link2, X } from "lucide-react";
import {
  connectGraph, inputPorts, type GraphKind, type GraphNode, type GraphPort, type NodeGraph,
} from "@/core/graph/model";

const LABELS:Record<GraphKind,string>={
  constant:"Number",time:"Timeline Time",add:"Add",multiply:"Multiply",sine:"Sine",output:"Property Output",
};
const TARGETS:Record<string,string>={
  opacity:"Opacity","offset.x":"Position X","offset.y":"Position Y",
  "params.strokeWidth":"Stroke Width","formula.a":"Formula A",
  "formula.b":"Formula B","formula.c":"Formula C",
};
type MathNodeData={
  node:GraphNode;
  value:number|undefined;
  connectedPorts:ReadonlySet<string>;
  awaitingConnection:boolean;
  onSource:(id:string)=>void;
  onTarget:(target:string,port:GraphPort)=>void;
};
type MathFlowNode=Node<MathNodeData,"math">;
type GroupData={id:string;title:string;count:number};
type GroupFlowNode=Node<GroupData,"group">;
type CanvasNode=MathFlowNode|GroupFlowNode;

const GroupNode=memo(function GroupNode({data}:NodeProps<GroupFlowNode>){
  return <div className="pm-ng-rf-group">
    <header className="pm-ng-rf-group-header">
      <GitBranch size={14}/><strong>{data.title}</strong><small>{data.count} nodes</small>
    </header>
  </div>;
});

/** React Flow owns pointer gestures and viewport. Data still comes only from NodeGraph v2. */
const MathNode=memo(function MathNode({data}:NodeProps<MathFlowNode>){
  const {node,value,connectedPorts,awaitingConnection,onSource,onTarget}=data;
  return <article className={"pm-ng-rf-node kind-"+node.kind} aria-label={node.title+" node"}>
    <div className="pm-ng-rf-node-header">
      <span className="pm-ng-node-indicator"/>
      <strong title={node.title}>{node.title}</strong>
      <span className="pm-ng-node-type">{LABELS[node.kind]}</span>
    </div>
    <div className="pm-ng-rf-node-subtitle">{node.kind==="constant"?"Fixed numeric input":
      node.kind==="time"?"Current timeline seconds":
      node.kind==="sine"?"sin(x) · radians":
      node.kind==="multiply"?"a × b":node.kind==="add"?"a + b":"Scene channel"}</div>
    {inputPorts(node.kind).map(port=><div className="pm-ng-rf-port" key={port}>
      <Handle type="target" position={Position.Left} id={port}
        className={"pm-ng-rf-handle input"+(awaitingConnection?" is-awaiting":"")}/>
      <button type="button" className="pm-ng-rf-port-button nodrag"
        aria-label={"Connect "+node.title+" input "+port} onClick={()=>onTarget(node.id,port)}>
        <span>{port.toUpperCase()}</span>
        <small>{connectedPorts.has(port)?"Connected":"Number input"}</small>
      </button>
    </div>)}
    {node.kind!=="output"?<div className="pm-ng-rf-port pm-ng-rf-port-output">
      <button type="button" className="pm-ng-rf-port-button nodrag"
        aria-label={"Use "+node.title+" output as source"} onClick={()=>onSource(node.id)}>
        <span>RESULT</span><output>{value===undefined?"—":Number(value.toFixed(3))}</output>
      </button>
      <Handle type="source" position={Position.Right} id="out" className="pm-ng-rf-handle output"/>
    </div>:<div className="pm-ng-rf-destination"><ArrowRight size={14}/>{TARGETS[node.property??""]??"Output"}</div>}
  </article>;
});
const nodeTypes={math:MathNode,group:GroupNode};

/** Screen and domain coordinates are intentionally identical, with bounded commits. */
const bounded=(p:XYPosition)=>({x:Math.max(0,Math.min(2200,Math.round(p.x))),
  y:Math.max(0,Math.min(1600,Math.round(p.y)))});

type Props={
  graph:NodeGraph;
  selectedNodeId:string;
  selectedNodeIds:readonly string[];
  selectedGroupId:string|null;
  selectedEdgeId:string|null;
  values:Readonly<Record<string,number>>;
  activeSource:string|null;
  onSelectNode:(id:string)=>void;
  onSelectNodes:(ids:string[])=>void;
  onSelectGroup:(id:string|null)=>void;
  onMoveBatch:(ids:readonly string[],dx:number,dy:number)=>void;
  onSelectEdge:(id:string|null)=>void;
  onSource:(id:string)=>void;
  onTarget:(id:string,port:GraphPort)=>void;
  onConnect:(source:string,target:string,port:GraphPort)=>void;
  onMove:(id:string,point:XYPosition)=>void;
  onDisconnect:(id:string)=>void;
  onCancel:()=>void;
};

function CanvasContent(props:Props){
  const {graph,selectedNodeId,selectedNodeIds,selectedGroupId,selectedEdgeId,values,
    activeSource,onSelectNode,onSelectNodes,onSelectGroup,onMoveBatch,onSelectEdge,
    onSource,onTarget,onConnect,onMove,onDisconnect,onCancel}=props;
  const rf=useReactFlow<CanvasNode,Edge>();
  const [moving,setMoving]=useState<Readonly<Record<string,XYPosition>>>({});
  const [zoom,setZoom]=useState(1);
  const onNodeChanges=useCallback((changes:NodeChange<CanvasNode>[])=>{
    const next=new Set(selectedNodeIds);
    let changed=false;
    for(const change of changes){
      if(change.type==="position"&&change.position&&change.dragging)
        setMoving(old=>({...old,[change.id]:bounded(change.position!)}));
      if(change.type==="select"){
        if(graph.nodes.some(n=>n.id===change.id)){
          if(change.selected!==next.has(change.id)){
            changed=true;
            if(change.selected)next.add(change.id);else next.delete(change.id);
          }
        }else if(change.selected&&graph.groups.some(g=>g.id===change.id)){
          onSelectGroup(change.id);
        }
      }
    }
    if(changed)onSelectNodes([...next]);
  },[selectedNodeIds,graph.nodes,graph.groups,onSelectNodes,onSelectGroup]);
  const nodes=useMemo<CanvasNode[]>(()=>{
    const grouped:GroupFlowNode[]=graph.groups.map(group=>{
      const members=graph.nodes.filter(n=>group.nodeIds.includes(n.id));
      const left=Math.min(...members.map(n=>n.x))-34;
      const top=Math.min(...members.map(n=>n.y))-74;
      const width=Math.max(...members.map(n=>n.x+252))-left+34;
      const height=Math.max(...members.map(n=>n.y+205))-top+38;
      return {id:group.id,type:"group",position:moving[group.id]??{x:left,y:top},
        style:{width,height,zIndex:-10},selected:selectedGroupId===group.id,
        draggable:true,dragHandle:".pm-ng-rf-group-header",
        data:{id:group.id,title:group.title,count:group.nodeIds.length}};
    });
    const math:MathFlowNode[]=graph.nodes.map(node=>({
      id:node.id,type:"math",position:moving[node.id]??{x:node.x,y:node.y},
      selected:selectedNodeIds.includes(node.id)||node.id===selectedNodeId,draggable:true,
      data:{node,value:values[node.id],awaitingConnection:activeSource!==null,
        connectedPorts:new Set(graph.edges.filter(edge=>edge.target===node.id).map(edge=>edge.port)),
        onSource,onTarget},
    }));
    return [...grouped,...math];
  },[graph.nodes,graph.groups,graph.edges,moving,selectedNodeId,selectedNodeIds,selectedGroupId,values,activeSource,onSource,onTarget]);
  const edges=useMemo<Edge[]>(()=>graph.edges.map(edge=>({
    id:edge.id,source:edge.source,target:edge.target,
    sourceHandle:"out",targetHandle:edge.port,
    type:"smoothstep",selected:edge.id===selectedEdgeId,
    style:{stroke:edge.id===selectedEdgeId?"#b4eaff":"#73badd",strokeWidth:edge.id===selectedEdgeId?3.2:2.4},
    markerEnd:{type:MarkerType.ArrowClosed,width:13,height:13,color:"#78bedc"},
    animated:edge.id===selectedEdgeId,
    ariaLabel:edge.source+" to "+edge.target+" "+edge.port,
  })),[graph.edges,selectedEdgeId]);
  const canConnect=useCallback((connection:Connection|Edge)=>{
    if(!connection.source||!connection.target)return false;
    const port=connection.targetHandle as GraphPort;
    if(port!=="a"&&port!=="b"&&port!=="in")return false;
    return connectGraph(graph,connection.source,connection.target,port,"preview-validation")!==graph;
  },[graph]);
  const accept=useCallback((connection:Connection)=>{
    if(connection.source&&connection.target&&connection.targetHandle)
      onConnect(connection.source,connection.target,connection.targetHandle as GraphPort);
  },[onConnect]);
  const stop=useCallback((_:unknown,node:CanvasNode)=>{
    setMoving(old=>{const next={...old};delete next[node.id];return next;});
    if(node.type==="group"){
      const group=graph.groups.find(g=>g.id===node.id);
      if(!group)return;
      const members=graph.nodes.filter(n=>group.nodeIds.includes(n.id));
      const left=Math.min(...members.map(n=>n.x))-34;
      const top=Math.min(...members.map(n=>n.y))-74;
      const dx=Math.round(node.position.x-left),dy=Math.round(node.position.y-top);
      if(dx||dy)onMoveBatch(group.nodeIds,dx,dy);
      return;
    }
    const anchor=graph.nodes.find(n=>n.id===node.id);
    if(!anchor)return;
    const position=bounded(node.position);
    const selected=selectedNodeIds.includes(node.id)&&selectedNodeIds.length>1?selectedNodeIds:[node.id];
    if(selected.length>1)onMoveBatch(selected,position.x-anchor.x,position.y-anchor.y);
    else onMove(node.id,position);
  },[graph,selectedNodeIds,onMoveBatch,onMove]);
  const fit=useCallback(()=>{void rf.fitView({padding:.23,duration:260,maxZoom:1.2});},[rf]);
  return <div className="pm-ng-reactflow-shell" aria-label="Interactive node canvas" tabIndex={-1}>
    <ReactFlow<CanvasNode,Edge> nodes={nodes} edges={edges}
      nodeTypes={nodeTypes} onNodesChange={onNodeChanges}
      onNodeClick={(event,node)=>{
        if(node.type==="group"){onSelectGroup(node.id);onSelectEdge(null);return;}
        if(!event.shiftKey&&!event.ctrlKey&&!event.metaKey){
          onSelectNode(node.id);onSelectNodes([node.id]);
        }
        onSelectGroup(null);onSelectEdge(null);
      }}
      onEdgeClick={(_,edge)=>{onSelectEdge(edge.id);onSelectNode("");}}
      onEdgeDoubleClick={(_,edge)=>onDisconnect(edge.id)}
      onPaneClick={()=>{onSelectNodes([]);onSelectNode("");onSelectGroup(null);onSelectEdge(null);onCancel();}}
      onNodeDragStop={stop}
      onConnect={accept} isValidConnection={canConnect}
      connectionMode={ConnectionMode.Strict}
      nodesConnectable edgesFocusable nodesFocusable elementsSelectable
      nodesDraggable panOnDrag={[1,2]} selectionOnDrag
      multiSelectionKeyCode={["Shift","Meta","Control"]} panActivationKeyCode="Space"
      zoomOnScroll zoomOnPinch zoomOnDoubleClick={false}
      minZoom={.25} maxZoom={1.8}
      fitView fitViewOptions={{padding:.23,maxZoom:1.2}}
      onMoveEnd={(_,viewport)=>setZoom(viewport.zoom)}
      proOptions={{hideAttribution:true}}
      colorMode="dark" deleteKeyCode={null}
      className="pm-ng-reactflow">
      <Background variant={BackgroundVariant.Dots} color="#29415e" gap={24} size={1.3}/>
      <MiniMap pannable zoomable className="pm-ng-rf-minimap"
        nodeColor={node=>node.type==="group"?"#38627e":selectedNodeIds.includes(node.id)?"#91bdff":node.id.startsWith("target")?"#ad99e6":"#5c8ea9"}
        maskColor="#0a1528bd" ariaLabel="Node minimap"/>
      <Controls showInteractive={false} className="pm-ng-rf-controls"/>
      <Panel position="top-right" className="pm-ng-rf-top-tools">
        <span className="pm-ng-rf-chip"><GitBranch size={13}/> React Flow</span>
        <span className="pm-ng-rf-chip"><CircleDot size={12}/> {Math.round(zoom*100)}%</span>
        <button type="button" aria-label="Fit graph" title="Fit all nodes" onClick={fit}><Focus size={17}/> Fit</button>
      </Panel>
      {activeSource&&<Panel position="top-center" className="pm-ng-connect-hint">
        <Link2 size={16}/> Select a target port, or drag an output handle onto an input
        <button type="button" aria-label="Cancel connection" onClick={onCancel}><X size={16}/></button>
      </Panel>}
    </ReactFlow>
    <output className="pm-ng-rf-zoom-readable" aria-label="Graph zoom">{Math.round(zoom*100)}%</output>
  </div>;
}
export function GraphReactFlowCanvas(props:Props){
  return <ReactFlowProvider><CanvasContent {...props}/></ReactFlowProvider>;
}

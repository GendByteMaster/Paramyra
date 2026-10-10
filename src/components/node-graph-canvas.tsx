"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, MiniMap, Handle,
  Position, MarkerType, ConnectionMode, useReactFlow, applyNodeChanges,
  type Node, type Edge, type NodeProps, type Connection, type NodeChange,
  type IsValidConnection, type Viewport,
} from "@xyflow/react";
import { Focus, Minus, Plus } from "lucide-react";
import {
  connectGraph, inputPorts, updateGraphNode, type GraphNode, type GraphPort,
  type NodeGraph, type GraphKind,
} from "@/core/graph/model";

type MathData = Record<string, unknown> & {
  graphNode: GraphNode;
  value: number | undefined;
  isSource: boolean;
  connectedPorts: readonly GraphPort[];
  chooseSource: (id: string) => void;
  chooseTarget: (target: string, port: GraphPort) => void;
};
type MathFlowNode = Node<MathData, "math">;

function MathNodeComponent({ data, selected }: NodeProps<MathFlowNode>) {
  const { graphNode: node } = data;
  const inputs = inputPorts(node.kind);
  return <article className={"pm-ng-node pm-rf-node kind-"+node.kind+(selected?" is-selected":"")}
    aria-label={node.title+" node"} style={{width:238}}>
    <header className="pm-ng-node-header pm-rf-drag-handle">
      <span className="pm-ng-node-indicator"/><strong>{node.title}</strong>
      <span className="pm-ng-node-type">{node.kind}</span>
    </header>
    {inputs.map(port=><div className="pm-rf-port-line" key={port}>
      <Handle type="target" position={Position.Left} id={port}
        className="pm-rf-handle" aria-label={"Drag connection to "+node.title+" "+port}/>
      <button type="button" className="pm-ng-port-row input nodrag" aria-label={"Connect "+node.title+" input "+port}
        onClick={()=>data.chooseTarget(node.id,port)}>
        <span>{port.toUpperCase()}</span>
        <small>{data.connectedPorts.includes(port)?"Connected":"Number"}</small>
      </button>
    </div>)}
    {node.kind!=="output"?<div className="pm-rf-port-line">
      <button type="button" className={"pm-ng-port-row output nodrag"+(data.isSource?" pending":"")}
        aria-label={"Use "+node.title+" output as source"} onClick={()=>data.chooseSource(node.id)}>
        <span>RESULT</span>
        <small>{data.value===undefined?"Number":data.value.toFixed(3)}</small>
      </button>
      <Handle type="source" position={Position.Right} id="out"
        className="pm-rf-handle" aria-label={"Drag from "+node.title+" output"}/>
    </div>:<div className="pm-ng-output-destination">→ {node.property}</div>}
  </article>;
}

const nodeTypes={math:MathNodeComponent};

export function graphToFlow(graph:NodeGraph,values:Readonly<Record<string,number>>,
  activeSource:string|null,chooseSource:(id:string)=>void,
  chooseTarget:(id:string,port:GraphPort)=>void):{nodes:MathFlowNode[];edges:Edge[]} {
  return {
    nodes:graph.nodes.map(node=>({
      id:node.id,type:"math",position:{x:node.x,y:node.y},
      dragHandle:".pm-rf-drag-handle",selected:false,
      data:{graphNode:node,value:values[node.id],isSource:activeSource===node.id,
        connectedPorts:graph.edges.filter(edge=>edge.target===node.id).map(edge=>edge.port),
        chooseSource,chooseTarget},
    })),
    edges:graph.edges.map(edge=>({
      id:edge.id,source:edge.source,target:edge.target,sourceHandle:"out",targetHandle:edge.port,
      type:"smoothstep",animated:graph.binding.enabled,
      markerEnd:{type:MarkerType.ArrowClosed,width:14,height:14,color:"#78c5dd"},
      style:{stroke:"#80b8e7",strokeWidth:2.4},
    })),
  };
}
type Props={
  graph:NodeGraph;
  values:Readonly<Record<string,number>>;
  selectedId:string;
  edgeId:string|null;
  activeSource:string|null;
  onChooseSource:(id:string)=>void;
  onChooseTarget:(id:string,port:GraphPort)=>void;
  onConnect:(source:string,target:string,port:GraphPort)=>void;
  onMoveNode:(id:string,x:number,y:number)=>void;
  onSelectNode:(id:string)=>void;
  onSelectEdge:(id:string|null)=>void;
  onNotice:(message:string)=>void;
};
const limit=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
function ControlsOverlay({onZoom}:{onZoom:(value:number)=>void}) {
  const {zoomIn,zoomOut,fitView}=useReactFlow();
  return <div className="pm-ng-canvas-controls pm-rf-controls" role="toolbar" aria-label="Graph viewport">
    <button type="button" aria-label="Zoom graph out" onClick={()=>{void zoomOut({duration:180});onZoom(-1);}}><Minus size={17}/></button>
    <output aria-label="Graph zoom" id="pm-rf-zoom-output">Zoom</output>
    <button type="button" aria-label="Zoom graph in" onClick={()=>{void zoomIn({duration:180});onZoom(1);}}><Plus size={17}/></button>
    <button type="button" aria-label="Fit graph" onClick={()=>{void fitView({padding:.2,duration:300,maxZoom:1.3});}}><Focus size={17}/></button>
  </div>;
}

function GraphFlow({graph,values,selectedId,edgeId,activeSource,onChooseSource,onChooseTarget,onConnect,onMoveNode,onSelectNode,onSelectEdge,onNotice}:Props) {
  const {nodes:projectedNodes,edges:projectedEdges}=useMemo(
    ()=>graphToFlow(graph,values,activeSource,onChooseSource,onChooseTarget),
    [graph,values,activeSource,onChooseSource,onChooseTarget],
  );
  const [nodes,setNodes]=useState<MathFlowNode[]>(projectedNodes);
  const [zoom,setZoom]=useState(1);
  useEffect(()=>{
    setNodes(existing=>{
      const positions=new Map(existing.map(n=>[n.id,n.position]));
      return projectedNodes.map(n=>({
        ...n,
        position:positions.get(n.id)&&graph.nodes.some(g=>g.id===n.id&&g.x!==n.position.x)
          ?n.position: n.position,
        selected:n.id===selectedId,
      }));
    });
  },[projectedNodes,graph,selectedId]);

  const onNodesChange=useCallback((changes:NodeChange<MathFlowNode>[])=>{
    setNodes(current=>applyNodeChanges(changes,current));
  },[]);
  const edges=useMemo(()=>projectedEdges.map(edge=>({...edge,
    selected:edge.id===edgeId,
    style:{...edge.style,stroke:edge.id===edgeId?"#d5f4ff":"#80b8e7",strokeWidth:edge.id===edgeId?3.5:2.4},
  })),[projectedEdges,edgeId]);
  const checkConnection=useCallback<IsValidConnection>((connection)=>{
    if(!connection.source||!connection.target||!connection.targetHandle)return false;
    const next=connectGraph(graph,connection.source,connection.target,
      connection.targetHandle as GraphPort,"validation-edge");
    return next!==graph;
  },[graph]);
  const handleConnect=useCallback((connection:Connection)=>{
    if(!connection.source||!connection.target||!connection.targetHandle)return;
    onConnect(connection.source,connection.target,connection.targetHandle as GraphPort);
  },[onConnect]);

  const onDragStop=useCallback((_event:React.MouseEvent,node:MathFlowNode)=>{
    const x=limit(Math.round(node.position.x),0,2200);
    const y=limit(Math.round(node.position.y),0,1600);
    onMoveNode(node.id,x,y);
  },[onMoveNode]);
  const onMoveEnd=useCallback((_event:MouseEvent|TouchEvent|null,viewport:Viewport)=>{
    setZoom(viewport.zoom);
  },[]);
  return <div className="pm-rf-surface" aria-label="Interactive node canvas">
    <ReactFlow<MathFlowNode,Edge>
      nodes={nodes} edges={edges} nodeTypes={nodeTypes}
      onNodesChange={onNodesChange} onConnect={handleConnect}
      onNodeDragStop={onDragStop}
      onNodeClick={(_event,node)=>onSelectNode(node.id)}
      onEdgeClick={(_event,edge)=>onSelectEdge(edge.id)}
      onPaneClick={()=>onSelectEdge(null)}
      onMoveEnd={onMoveEnd} isValidConnection={checkConnection}
      fitView fitViewOptions={{padding:.18,maxZoom:1.3}}
      minZoom={.25} maxZoom={2}
      nodesConnectable edgesReconnectable={false} elementsSelectable
      nodesDraggable panOnDrag zoomOnPinch zoomOnScroll
      connectionMode={ConnectionMode.Strict}
      deleteKeyCode={null}
      proOptions={{hideAttribution:false}}
      colorMode="dark"
    >
      <Background variant={BackgroundVariant.Dots} gap={25} size={1.2} color="#244064"/>
      <MiniMap ariaLabel="Node minimap" zoomable pannable
        nodeColor={(node)=>node.id===selectedId?"#91baff":"#547da0"}
        className="pm-rf-minimap" maskColor="#091524a0"/>
      <ControlsOverlay onZoom={()=>{}}/>
    </ReactFlow>
    <span className="pm-rf-zoom-mirror" aria-label="Viewport scale">{Math.round(zoom*100)}%</span>
    <div className="pm-rf-hint">Drag between ports to connect · select nodes and links · scroll to zoom · drag canvas to pan</div>
    {activeSource&&<div className="pm-ng-connect-hint" role="status">Select any input port to connect from the highlighted source
      <button type="button" onClick={()=>onChooseSource(activeSource)}>Cancel</button></div>}
  </div>;
}
export function NodeGraphCanvas(props:Props) {
  return <ReactFlowProvider><GraphFlow {...props}/></ReactFlowProvider>;
}

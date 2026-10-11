import {describe,expect,it} from "vitest";
import {documentFromScene} from "../document/schema";
import {presets} from "../scenes/presets";
import {initialGraph,parseGraph,updateGraphBinding} from "./model";
import {commitGraph,initializeGraphHistory,undoGraph} from "./history";
import {copyGraphSelection,deleteGraphSelection,groupGraphNodes,moveGraphSelection,
  parseGraphSelection,pasteGraphSelection,ungroupGraphNodes} from "./workspace";
import {makeProjectBundle,parseProjectBundle,restoreProjectBundle,SCENE_KEY} from "./project-bundle";
import {GRAPH_KEY} from "./model";
import {defaultCourseworkDraft} from "./coursework";
import {PROJECT_LIBRARY_KEY,activeProject,readStudioLibrary} from "../projects/studio-library";

function ids(){let n=0;return ()=>"test-id-"+(++n);}
describe("M3.3 Graph Workspace domain",()=>{
  it("migrates existing v2 graph to v3 with no groups and retains typed DAG",()=>{
    const graph=initialGraph();
    const {groups:discard,schemaVersion:old,...rest}=graph;
    void discard;void old;
    expect(parseGraph({...rest,schemaVersion:2})).toEqual(graph);
    const v1={schemaVersion:1,id:graph.id,title:graph.title,nodes:graph.nodes,edges:graph.edges};
    expect(parseGraph(v1)).toEqual(graph);
    expect(parseGraph({...graph,groups:[{id:"bad",title:"Bad",nodeIds:["missing","amp"]}]})).toBeNull();
  });
  it("groups a valid selection, prevents duplicate group membership and moves all members atomically",()=>{
    const graph=initialGraph();
    const grouped=groupGraphNodes(graph,["amp","time"],"group-a","Inputs");
    expect(grouped.groups).toEqual([{id:"group-a",title:"Inputs",nodeIds:["time","amp"]}]);
    expect(groupGraphNodes(grouped,["amp","sine"],"group-b")).toBe(grouped);
    const next=moveGraphSelection(grouped,["amp","time"],20,10);
    expect(next.nodes.find(n=>n.id==="amp")?.x).toBe(110);
    expect(next.nodes.find(n=>n.id==="time")?.y).toBe(350);
    expect(moveGraphSelection(grouped,["amp","time"],-1000,0)).toBe(grouped);
    expect(ungroupGraphNodes(next,"group-a").groups).toHaveLength(0);
    expect(next.groups).toHaveLength(1);
  });
  it("copies internal links and group metadata then pastes with remapped IDs and one Undo step",()=>{
    const graph=groupGraphNodes(initialGraph(),["time","sine"],"g","Signal");
    const fragment=copyGraphSelection(graph,["time","sine"])!;
    expect(fragment.edges).toHaveLength(1);
    expect(fragment.groups).toHaveLength(1);
    const pasted=pasteGraphSelection(graph,fragment,ids());
    expect(pasted.error).toBeNull();
    expect(pasted.graph.nodes.length).toBe(7);
    expect(pasted.graph.edges.length).toBe(5);
    expect(pasted.graph.groups.length).toBe(2);
    expect(pasted.graph.groups[1].nodeIds).toEqual(pasted.nodeIds);
    const history=commitGraph(initializeGraphHistory(graph),pasted.graph);
    expect(undoGraph(history).present).toBe(graph);
    expect(graph.nodes).toHaveLength(5);
  });
  it("automatically allocates unused output targets or rejects atomically when exhausted",()=>{
    const graph=initialGraph();
    const pasted=pasteGraphSelection(graph,copyGraphSelection(graph,["target"])!,ids());
    expect(pasted.error).toBeNull();
    expect(pasted.graph.nodes.at(-1)?.property).toBe("opacity");
    const full={...graph,nodes:[...graph.nodes,...(["opacity","offset.y","params.strokeWidth","formula.a","formula.b","formula.c"] as const).map((property,i)=>({
      id:"output-"+i,kind:"output" as const,title:"Out "+i,x:20+i*100,y:55,property,
    }))]};
    const parsed=parseGraph(full)!;
    const denied=pasteGraphSelection(parsed,copyGraphSelection(graph,["target"])!,ids());
    expect(denied.error).toMatch(/No unused output target/);
    expect(denied.graph).toBe(parsed);
  });
  it("deletes selected nodes and their incident edges without damaging group membership",()=>{
    const graph=groupGraphNodes(initialGraph(),["time","sine","amp"],"g","Motion");
    const updated=deleteGraphSelection(graph,["time"]);
    expect(updated.edges).toHaveLength(3);
    expect(updated.groups[0].nodeIds).toEqual(["amp","sine"]);
    expect(deleteGraphSelection(graph,graph.nodes.map(n=>n.id))).toBe(graph);
    expect(parseGraphSelection({...copyGraphSelection(graph,["amp"])!,edges:[{
      id:"bad",source:"amp",target:"outside",port:"a",
    }]})).toBeNull();
    expect(pasteGraphSelection(graph,copyGraphSelection(graph,["amp"])!,ids(),4000).graph).toBe(graph);
  });
});
describe("M3.3 portable scene/graph project file",()=>{
  const scene=documentFromScene(presets[0]);
  it("exports and imports both exact documents through a versioned, strict project bundle",()=>{
    const graph=groupGraphNodes(initialGraph(),["time","amp"],"g","Sources");
    const bundle=makeProjectBundle(scene,graph)!;
    expect(bundle).not.toBeNull();
    const parsed=parseProjectBundle(JSON.parse(JSON.stringify(bundle)));
    expect(parsed).toEqual(bundle);
    expect(parsed?.graph.groups).toHaveLength(1);
    expect(parsed?.scene.layers).toHaveLength(1);
    expect(parseProjectBundle({...bundle,script:"alert(1)"})).toBeNull();
    expect(parseProjectBundle({...bundle,graph:{...graph,edges:[...graph.edges,{id:"cycle",source:"product",target:"sine",port:"in"}]}})).toBeNull();
  });
  it("round-trips Coursework in v2 and accepts strict v1 imports without executable fields",()=>{
    const graph=initialGraph();
    const report={...defaultCourseworkDraft(graph),objective:"Investigate wave motion"};
    const sceneWithFrames={...scene,layers:scene.layers.map(l=>({...l,keyframes:[
      {property:"opacity" as const,time:1,value:.6,ease:"linear" as const},
    ]}))};
    const bundle=makeProjectBundle(sceneWithFrames,graph,report)!;
    expect(bundle.version).toBe(2);
    expect(parseProjectBundle(JSON.parse(JSON.stringify(bundle)))).toEqual(bundle);
    expect(bundle.scene.layers[0].keyframes).toHaveLength(1);
    expect(parseProjectBundle({...bundle,coursework:{...report,title:""}})).toBeNull();
    const legacy={format:bundle.format,version:1,scene:bundle.scene,graph:bundle.graph};
    const migrated=parseProjectBundle(legacy)!;
    expect(migrated.version).toBe(2);
    expect(migrated.coursework).toEqual(defaultCourseworkDraft(graph));
    expect(parseProjectBundle({...legacy,script:"evil"})).toBeNull();
  });
  it("rejects enabled binding to deleted layer or incompatible channel before persisting",()=>{
    const missing=updateGraphBinding(initialGraph(),{enabled:true,layerId:"gone",priority:"keyframes-win"});
    expect(makeProjectBundle(scene,missing)).toBeNull();
    const valid=updateGraphBinding(initialGraph(),{enabled:true,layerId:scene.layers[0].id,priority:"keyframes-win"});
    expect(makeProjectBundle(scene,valid)).not.toBeNull();
    const formula={...valid,nodes:valid.nodes.map(n=>n.id==="target"?{...n,property:"formula.a" as const}:n)};
    expect(makeProjectBundle(scene,formula)).toBeNull();
  });
  it("rolls back both keys when localStorage fails on the second write",()=>{
    const bundle=makeProjectBundle(scene,initialGraph())!;
    const map=new Map<string,string>([[SCENE_KEY,"before-scene"],[GRAPH_KEY,"before-graph"]]);
    const store={
      getItem:(key:string)=>map.get(key)??null,
      setItem:(key:string,value:string)=>{
        if(key===SCENE_KEY&&value!=="before-scene")throw Error("Quota");
        map.set(key,value);
      },
      removeItem:(key:string)=>{map.delete(key);},
    };
    expect(restoreProjectBundle(bundle,store)).toBe(false);
    expect(map.get(SCENE_KEY)).toBe("before-scene");
    expect(map.get(GRAPH_KEY)).toBe("before-graph");
    const normal={...store,setItem:(key:string,value:string)=>{map.set(key,value);}};
    expect(restoreProjectBundle(bundle,normal)).toBe(true);
    expect(JSON.parse(map.get(GRAPH_KEY)!).schemaVersion).toBe(3);
    expect(JSON.parse(map.get(SCENE_KEY)!).schemaVersion).toBe(3);
    expect(JSON.parse(map.get(PROJECT_LIBRARY_KEY)!).version).toBe(2);
    expect(activeProject(readStudioLibrary(normal)).coursework).toEqual(bundle.coursework);
  });
});

import { describe,expect,it } from "vitest";
import { documentFromScene } from "../document/schema";
import { initialGraph, updateGraphNode } from "../graph/model";
import { presetFor } from "../scenes/presets";
import {
  PROJECT_LIBRARY_KEY, STUDIO_SCENE_KEY, MAX_STUDIO_PROJECTS,
  activeProject, createProject, duplicateProject, parseStudioLibrary,
  persistStudioLibrary, readStudioLibrary, removeProject, renameProject,
  replaceActiveGraph, replaceActiveScene, selectProject, writeActiveGraph, writeActiveScene,
  type ProjectStore,
} from "./studio-library";

const memory=()=>{
  const entries=new Map<string,string>();
  const store:ProjectStore={
    getItem:key=>entries.get(key)??null,
    setItem:(key,value)=>{entries.set(key,value);},
    removeItem:key=>{entries.delete(key);},
  };
  return {store,entries};
};
const seed=()=>{
  const {store,entries}=memory();
  const existing=documentFromScene(presetFor("lissajous"));
  store.setItem(STUDIO_SCENE_KEY,JSON.stringify(existing));
  return {store,entries,existing};
};
describe("Studio project library",()=>{
  it("migrates an existing Studio document and graph without changing them",()=>{
    const {store,existing}=seed();
    const library=readStudioLibrary(store);
    expect(library.projects).toHaveLength(1);
    expect(activeProject(library).scene).toEqual(existing);
    expect(persistStudioLibrary(library,store)).toBe(true);
    expect(parseStudioLibrary(JSON.parse(store.getItem(PROJECT_LIBRARY_KEY)!))).toEqual(library);
    expect(JSON.parse(store.getItem(STUDIO_SCENE_KEY)!)).toEqual(existing);
  });
  it("stores independent scenes and graphs when switching",()=>{
    const {store,existing}=seed();
    const library=readStudioLibrary(store);
    const second={...documentFromScene(presetFor("polar-rose")),id:"project-second"};
    const newLibrary=createProject(library,"project-second",second,initialGraph(),100)!;
    expect(persistStudioLibrary(newLibrary,store)).toBe(true);
    const changed={...second,layers:[{...second.layers[0],params:{...second.layers[0].params,frequencyX:8}}]};
    const updated=writeActiveScene(changed,store,200)!;
    expect(activeProject(updated).scene.layers[0].params.frequencyX).toBe(8);
    const graph=updateGraphNode(initialGraph(),"amp",{value:7});
    writeActiveGraph(graph,store,210);
    expect(activeProject(readStudioLibrary(store)).graph.nodes.find(n=>n.id==="amp")?.value).toBe(7);
    const restored=selectProject(readStudioLibrary(store),library.activeId)!;
    expect(persistStudioLibrary(restored,store)).toBe(true);
    expect(activeProject(readStudioLibrary(store)).scene).toEqual(existing);
    expect(activeProject(readStudioLibrary(store)).graph.nodes.find(n=>n.id==="amp")?.value).toBe(1);
  });
  it("duplicates and renames projects without modifying their source",()=>{
    const {store}=seed();
    const library=readStudioLibrary(store);
    const duplicate=duplicateProject(library,library.activeId,"copied",42)!;
    expect(duplicate.projects).toHaveLength(2);
    expect(activeProject(duplicate).scene.id).toBe("copied");
    expect(duplicate.projects[0].name).not.toBe(activeProject(duplicate).name);
    const renamed=renameProject(duplicate,"copied","  My Study  ",43)!;
    expect(activeProject(renamed).name).toBe("My Study");
    expect(activeProject(renamed).scene.title).toBe("My Study");
    expect(persistStudioLibrary(renamed,store)).toBe(true);
    expect(removeProject(readStudioLibrary(store),"copied")?.activeId).toBe(library.activeId);
  });
  it("rejects deleting the last project, malformed data, and project limits",()=>{
    const {store}=seed();let lib=readStudioLibrary(store);
    expect(removeProject(lib,lib.activeId)).toBeNull();
    expect(renameProject(lib,lib.activeId,"   ",1)).toBeNull();
    expect(parseStudioLibrary({version:1,activeId:"wrong",projects:lib.projects})).toBeNull();
    for(let n=1;n<MAX_STUDIO_PROJECTS;n++){
      lib=createProject(lib,"p"+n,documentFromScene(presetFor("wave")),initialGraph(),n)!;
    }
    expect(createProject(lib,"overflow",documentFromScene(presetFor("wave")),initialGraph(),99)).toBeNull();
  });
  it("rolls back all active mirrors and registry after partial write failure",()=>{
    const {store,entries}=seed();
    const original=readStudioLibrary(store);
    expect(persistStudioLibrary(original,store)).toBe(true);
    const before=new Map(entries);
    const next=createProject(original,"project-2",documentFromScene(presetFor("wave")),initialGraph(),100)!;
    let failed=false;
    const failing:ProjectStore={
      getItem:store.getItem,setItem:(key,value)=>{
        if(key===PROJECT_LIBRARY_KEY&&!failed){failed=true;throw new Error("quota");}
        store.setItem(key,value);
      },removeItem:store.removeItem,
    };
    expect(persistStudioLibrary(next,failing)).toBe(false);
    expect([...entries]).toEqual([...before]);
  });
  it("does not accept invalid scene or graph into a project",()=>{
    const {store}=seed(),lib=readStudioLibrary(store);
    expect(replaceActiveScene(lib,{bad:true} as never,1)).toBeNull();
    expect(replaceActiveGraph(lib,{bad:true} as never,1)).toBeNull();
  });
});

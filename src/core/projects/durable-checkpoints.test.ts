import {describe,expect,it} from "vitest";
import {documentFromScene} from "../document/schema";
import {initialGraph} from "../graph/model";
import {presetFor} from "../scenes/presets";
import {createProject,readStudioLibrary,type ProjectStore} from "./studio-library";
import {matchesCheckpointRevision,parseRecoveryCheckpoint} from "./durable-checkpoints";

function project(){
  const store:ProjectStore={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
  const base=readStudioLibrary(store);
  return createProject(base,"second",documentFromScene(presetFor("wave")),initialGraph(),42)!;
}
describe("M4.2 IndexedDB recovery checkpoint boundaries",()=>{
  it("accepts a complete, versioned snapshot and rejects partial or malformed payloads",()=>{
    const library=project();
    const checkpoint={key:"studio-library",version:1,revision:1,savedAt:123,library};
    expect(parseRecoveryCheckpoint(checkpoint)?.library).toEqual(library);
    expect(parseRecoveryCheckpoint({...checkpoint,revision:0})).toBeNull();
    expect(parseRecoveryCheckpoint({...checkpoint,library:{...library,projects:[]}})).toBeNull();
    expect(parseRecoveryCheckpoint({...checkpoint,script:"console.log(1)"})).toBeNull();
    expect(parseRecoveryCheckpoint({...checkpoint,library:{...library,projects:
      library.projects.map(p=>({...p,coursework:{...p.coursework,title:""}}))}})).toBeNull();
  });
  it("uses exact revision comparison without last-write-wins fallback",()=>{
    expect(matchesCheckpointRevision(null,null)).toBe(true);
    expect(matchesCheckpointRevision(null,1)).toBe(false);
    expect(matchesCheckpointRevision(1,null)).toBe(false);
    expect(matchesCheckpointRevision(3,3)).toBe(true);
    expect(matchesCheckpointRevision(3,4)).toBe(false);
  });
});

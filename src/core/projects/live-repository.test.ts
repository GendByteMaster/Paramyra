import {describe,expect,it} from "vitest";
import {documentFromScene} from "../document/schema";
import {initialGraph} from "../graph/model";
import {presetFor} from "../scenes/presets";
import {PROJECT_LIBRARY_KEY,activeProject,createProject,readStudioLibrary,type ProjectStore} from "./studio-library";
import {LIVE_PROJECT_RECORD_KEY,parseLiveLibraryRecord,migrationCandidate} from "./live-repository";

const store=(raw?:string):ProjectStore=>({
  getItem:key=>key===PROJECT_LIBRARY_KEY?raw??null:null,
  setItem:()=>{},removeItem:()=>{},
});

describe("M4.2.1 durable project repository schemas",()=>{
  const library=readStudioLibrary(store());
  it("parses a complete v2 record and fails closed on unknown or corrupt fields",()=>{
    const record={key:LIVE_PROJECT_RECORD_KEY,version:1,revision:1,updatedAt:5,library};
    expect(parseLiveLibraryRecord(record)?.library).toEqual(library);
    expect(parseLiveLibraryRecord({...record,revision:0})).toBeNull();
    expect(parseLiveLibraryRecord({...record,revision:1.1})).toBeNull();
    expect(parseLiveLibraryRecord({...record,evil:true})).toBeNull();
    expect(parseLiveLibraryRecord({...record,library:{...library,version:1}})).toBeNull();
    expect(parseLiveLibraryRecord({...record,library:{...library,activeId:"missing"}})).toBeNull();
  });
  it("migrates only validated local registries and never resets corrupt or future data",()=>{
    const second=createProject(library,"second",documentFromScene(presetFor("wave")),initialGraph(),3)!;
    expect(migrationCandidate(store(JSON.stringify(second)))).toEqual(second);
    expect(migrationCandidate(store('{"version":99}'))).toBeNull();
    expect(migrationCandidate(store("{bad json"))).toBeNull();
    expect(activeProject(migrationCandidate(store())!).scene.title).toBeTruthy();
  });
});

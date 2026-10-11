"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, FolderOpen, Plus, Save, Trash2, X, DatabaseBackup, RotateCcw, Database } from "lucide-react";
import {initializeLiveProjectLibrary,readLiveProjectLibrary,mutateLiveProjectLibrary,type LiveLibraryRecord} from "@/core/projects/live-repository";
import {readRecoveryCheckpoint,writeRecoveryCheckpoint,type RecoveryCheckpoint} from "@/core/projects/durable-checkpoints";
import {parseStudioLibrary,persistStudioLibrary,PROJECT_LIBRARY_KEY} from "@/core/projects/studio-library";
import type { StudioLibrary } from "@/core/projects/studio-library";

type Props={
  library:StudioLibrary;
  onClose:()=>void;
  onSelect:(id:string)=>void;
  onNew:()=>void;
  onDuplicate:(id:string)=>void;
  onRename:(id:string,name:string)=>void;
  onDelete:(id:string)=>void;
};
export function StudioProjectLibrary({library,onClose,onSelect,onNew,onDuplicate,onRename,onDelete}:Props){
  const [editing,setEditing]=useState<string|null>(null);
  const [name,setName]=useState("");
  const closeRef=useRef<HTMLButtonElement>(null);
  const [checkpoint,setCheckpoint]=useState<RecoveryCheckpoint|null>(null);
  const [checkpointStatus,setCheckpointStatus]=useState("Checking local recovery checkpoint…");
  const [busy,setBusy]=useState(false);
  const [liveBusy,setLiveBusy]=useState(false);
  const [liveRecord,setLiveRecord]=useState<LiveLibraryRecord|null>(null);
  const [liveStatus,setLiveStatus]=useState("Checking transactional storage…");
  useEffect(()=>{
    let active=true;
    void readLiveProjectLibrary().then(result=>{
      if(!active)return;
      if(result.status==="ready"){
        setLiveRecord(result.record);
        setLiveStatus("Preview snapshot · Revision "+result.record.revision);
      }else if(result.status==="empty")setLiveStatus("No transactional snapshot initialized");
      else if(result.status==="invalid")setLiveStatus("Unsupported durable record · Do not overwrite");
      else setLiveStatus("Transactional storage unavailable");
    });
    return()=>{active=false;};
  },[]);
  const prepareLive=async()=>{
    setLiveBusy(true);
    try{
      const result=await initializeLiveProjectLibrary(localStorage);
      if(result.status==="ready"){
        setLiveRecord(result.record);
        setLiveStatus((result.created?"Initialized":"Loaded existing")+" transactional snapshot · Revision "+result.record.revision);
      }else setLiveStatus("Cannot initialize: "+result.status+". Legacy project data was not modified.");
    }finally{setLiveBusy(false);}
  };
  const syncLive=async()=>{
    if(!liveRecord)return;
    setLiveBusy(true);
    try{
      const raw=localStorage.getItem(PROJECT_LIBRARY_KEY);
      const incoming=raw?parseStudioLibrary(JSON.parse(raw)):null;
      if(!incoming){
        setLiveStatus("Invalid local project registry; transactional snapshot preserved");
        return;
      }
      const result=await mutateLiveProjectLibrary(liveRecord.revision,liveRecord.library.activeId,
        ()=>incoming);
      if(result.status==="saved"){
        setLiveRecord(result.record);
        setLiveStatus("Transaction committed · Revision "+result.record.revision);
      }else if(result.status==="conflict")setLiveStatus("Conflict: transactional snapshot changed in another tab. Reopen Projects.");
      else setLiveStatus("Transaction rejected ("+result.status+"); snapshot preserved");
    }catch{setLiveStatus("Unable to read local project registry");}
    finally{setLiveBusy(false);}
  };
  useEffect(()=>{
    let mounted=true;
    void readRecoveryCheckpoint().then(result=>{
      if(!mounted)return;
      if(result.status==="ready"){
        setCheckpoint(result.checkpoint);
        setCheckpointStatus("Recovery checkpoint · Revision "+result.checkpoint.revision);
      }else if(result.status==="empty")setCheckpointStatus("No recovery checkpoint saved yet");
      else if(result.status==="invalid")setCheckpointStatus("Checkpoint is corrupt; not overwritten");
      else setCheckpointStatus("IndexedDB unavailable · Use JSON export");
    });
    return()=>{mounted=false;};
  },[]);
  const saveCheckpoint=async()=>{
    setBusy(true);
    try{
      const raw=localStorage.getItem(PROJECT_LIBRARY_KEY);
      const valid=raw?parseStudioLibrary(JSON.parse(raw)):null;
      if(!valid){
        setCheckpointStatus("Cannot checkpoint an invalid or missing project registry");
        return;
      }
      const outcome=await writeRecoveryCheckpoint(valid,checkpoint?.revision??null);
      if(outcome.status==="saved"){
        setCheckpoint(outcome.checkpoint);
        setCheckpointStatus("Recovery checkpoint saved · Revision "+outcome.checkpoint.revision);
      }else if(outcome.status==="conflict"){
        setCheckpointStatus("Conflict: another tab updated the checkpoint. Close and reopen Projects before saving.");
      }else setCheckpointStatus("Checkpoint not saved ("+outcome.status+"). Export JSON instead.");
    }catch{
      setCheckpointStatus("Unable to read the project registry. Export JSON instead.");
    }finally{setBusy(false);}
  };
  const restoreCheckpoint=async()=>{
    if(!checkpoint || !window.confirm("Restore the saved checkpoint? This replaces the current local Project Library. Export JSON first if you want to keep recent changes."))return;
    setBusy(true);
    try{
      const newest=await readRecoveryCheckpoint();
      if(newest.status!=="ready" || newest.checkpoint.revision!==checkpoint.revision){
        setCheckpointStatus("Checkpoint changed or unavailable. Close and reopen Projects before restoring.");
        return;
      }
      // Registry and compatibility mirrors update together with best-effort rollback.
      if(!persistStudioLibrary(newest.checkpoint.library,localStorage)){
        setCheckpointStatus("Restore failed; existing project data was not replaced.");
        return;
      }
      window.location.reload();
    }finally{setBusy(false);}
  };
  useEffect(()=>{
    closeRef.current?.focus();
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.stopPropagation();onClose();}};
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[onClose]);
  return <div className="pm-project-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section role="dialog" aria-modal="true" aria-label="Studio project library" className="pm-project-dialog"
      onKeyDown={event=>{
        if(event.key!=="Tab")return;
        const focusable=Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled])"))
          .filter(element=>element.getClientRects().length>0);
        if(!focusable.length)return;
        const first=focusable[0],last=focusable[focusable.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }}>
      <header className="pm-project-dialog-head">
        <div><span className="pm-label">PARAMYRA / STUDIO</span><h2>Project Library</h2>
        <p>Local projects are saved separately in this browser. Export JSON for backups.</p></div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close project library"><X size={17}/></button>
      </header>
      <div className="pm-project-dialog-actions">
        <span>{library.projects.length} / 20 projects</span>
        <button type="button" disabled={library.projects.length>=20} onClick={onNew}><Plus size={15}/> New Project</button>
      </div>
      <div className="pm-project-list">
        {[...library.projects].sort((a,b)=>b.updatedAt-a.updatedAt).map(project=><article key={project.id} className={"pm-project-entry"+(project.id===library.activeId?" is-active":"")}>
          <div className="pm-project-entry-icon"><FolderOpen size={18}/></div>
          <div className="pm-project-entry-info">
            {editing===project.id?<form onSubmit={event=>{event.preventDefault();onRename(project.id,name);setEditing(null);}}>
              <input autoFocus aria-label={"Rename "+project.name} maxLength={120} value={name} onChange={e=>setName(e.target.value)}/>
              <button type="submit" aria-label={"Save name for "+project.name}><Save size={14}/></button>
              <button type="button" onClick={()=>setEditing(null)} aria-label="Cancel rename"><X size={14}/></button>
            </form>:<strong>{project.name}</strong>}
            <small>{project.scene.layers.length} layer{project.scene.layers.length===1?"":"s"} · {project.graph.nodes.length} nodes · {project.scene.layers.reduce((count,layer)=>count+(layer.keyframes?.length??0),0)} keyframes · Coursework</small>
          </div>
          <div className="pm-project-entry-actions">
            {project.id===library.activeId?<span className="pm-project-active">ACTIVE</span>:<button type="button" onClick={()=>onSelect(project.id)}>Open</button>}
            <button type="button" disabled={editing!==null} onClick={()=>{setName(project.name);setEditing(project.id);}} aria-label={"Rename project "+project.name}>Rename</button>
            <button type="button" disabled={library.projects.length>=20} onClick={()=>onDuplicate(project.id)} aria-label={"Duplicate project "+project.name}><Copy size={15}/></button>
            <button type="button" disabled={library.projects.length<=1} onClick={()=>onDelete(project.id)} aria-label={"Delete project "+project.name}><Trash2 size={15}/></button>
          </div>
        </article>)}
      </div>
      <section className="pm-project-checkpoint" aria-label="Local recovery checkpoint">
        <div className="pm-project-checkpoint-title"><DatabaseBackup size={17}/><div>
          <strong>Local recovery checkpoint</strong>
          <span>Transactional IndexedDB copy · Separate from your everyday autosave</span>
        </div></div>
        <div className="pm-project-checkpoint-actions">
          <button type="button" disabled={busy} onClick={()=>{void saveCheckpoint();}}><Save size={14}/> Save checkpoint</button>
          <button type="button" disabled={busy||!checkpoint} onClick={()=>{void restoreCheckpoint();}}><RotateCcw size={14}/> Restore checkpoint</button>
        </div>
        <p role="status" aria-live="polite">{checkpointStatus}</p>
      </section>
      <details className="pm-project-storage-preview">
        <summary><Database size={15}/> Experimental transactional project store</summary>
        <p>Stage a complete project snapshot in IndexedDB with revision checks. Studio and Graph continue to use localStorage for live edits; this is not a storage cutover.</p>
        <div className="pm-project-checkpoint-actions">
          <button type="button" disabled={liveBusy} onClick={()=>{void prepareLive();}}>Initialize snapshot</button>
          <button type="button" disabled={liveBusy||!liveRecord} onClick={()=>{void syncLive();}}>Commit local snapshot</button>
        </div>
        <p role="status" aria-live="polite">{liveStatus}</p>
      </details>
      <p className="pm-project-dialog-note">Recovery checkpoints reject stale revisions across tabs, but regular editor localStorage writes remain last-write-wins. Export JSON for off-device backups. Scene, keyframes, Node Graph and Coursework are included in each project snapshot.</p>
    </section>
  </div>;
}

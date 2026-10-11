"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, FolderOpen, Plus, Save, Trash2, X } from "lucide-react";
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
  useEffect(()=>{
    closeRef.current?.focus();
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.stopPropagation();onClose();}};
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[onClose]);
  return <div className="pm-project-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section role="dialog" aria-modal="true" aria-label="Studio project library" className="pm-project-dialog">
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
      <p className="pm-project-dialog-note">Browser storage is not a cloud backup. Cross-tab edits use last-write-wins. Scene, keyframes, Node Graph and Coursework are included in each project snapshot.</p>
    </section>
  </div>;
}

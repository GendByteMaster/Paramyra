"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Copy, Database, FilePlus2, FolderOpen, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  activePhysicsProject, addImportedPhysicsProject, createPhysicsLibraryProject, deletePhysicsProject,
  duplicatePhysicsProject, initializePhysicsLibrary, mutatePhysicsLibrary, readPhysicsLibrary,
  renamePhysicsProject, replaceActivePhysicsProject, switchPhysicsProject, type PhysicsLibraryRecord,
} from "@/core/physics/projects/library";
import { exportPhysicsProjectJSON } from "@/core/physics/projects/export";
import { PHYSICS_JSON_MAX_BYTES, parsePhysicsProject, type PhysicsProject } from "@/core/physics/model/schema";
import { PhysicsWorkbench } from "@/features/physics/physics-workbench";

type LoadState = "loading" | "empty" | "ready" | "invalid" | "unavailable";

function saveDownload(project: PhysicsProject): boolean {
  const text = exportPhysicsProjectJSON(project);
  if (!text) return false;
  try {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
    const anchor = document.createElement("a");
    const safeName = project.name.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60) || "physics-project";
    anchor.href = url; anchor.download = `${safeName}.json`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    return true;
  } catch { return false; }
}

export function PhysicsStudio() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [record, setRecord] = useState<PhysicsLibraryRecord | null>(null);
  const [project, setProject] = useState<PhysicsProject | null>(null);
  const [savedProject, setSavedProject] = useState<PhysicsProject | null>(null);
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const [allowDraftEdits, setAllowDraftEdits] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const operationInFlight = useRef(false);
  const editVersion = useRef(0);
  const dirty = useMemo(() => !!project && (!savedProject || JSON.stringify(project) !== JSON.stringify(savedProject)), [project, savedProject]);

  const beginOperation = (preserveDraftEdits = false) => {
    if (operationInFlight.current) return false;
    operationInFlight.current = true;
    setAllowDraftEdits(preserveDraftEdits);
    setWorking(true);
    return true;
  };
  const endOperation = () => {
    operationInFlight.current = false;
    setAllowDraftEdits(false);
    setWorking(false);
  };
  const updateDraft = (next: PhysicsProject) => {
    editVersion.current += 1;
    setProject(next);
  };

  const adoptRecord = useCallback((next: PhysicsLibraryRecord) => {
    setRecord(next);
    const current = activePhysicsProject(next.library);
    setProject(current);
    setSavedProject(current);
    setLoadState(current ? "ready" : "empty");
    setConflicted(false);
  }, []);

  const loadLibrary = useCallback(async () => {
    try {
      const result = await readPhysicsLibrary();
      if (result.status === "ready") adoptRecord(result.record);
      else { setRecord(null); setLoadState(result.status); }
    } catch {
      setRecord(null); setLoadState("unavailable");
    }
  }, [adoptRecord]);

  useEffect(() => {
    let active = true;
    void readPhysicsLibrary().then(result => {
      if (!active) return;
      if (result.status === "ready") adoptRecord(result.record);
      else { setRecord(null); setLoadState(result.status); }
    }, () => {
      if (active) { setRecord(null); setLoadState("unavailable"); }
    });
    return () => { active = false; };
  }, [adoptRecord]);

  const ensureRecord = async (): Promise<PhysicsLibraryRecord | null> => {
    if (record) return record;
    const result = await readPhysicsLibrary();
    if (result.status === "ready") { setRecord(result.record); setLoadState(result.record.library.projects.length ? "ready" : "empty"); return result.record; }
    if (result.status === "empty") {
      const initialized = await initializePhysicsLibrary();
      if (initialized.status === "ready") { setRecord(initialized.record); setLoadState("empty"); return initialized.record; }
      setLoadState(initialized.status); return null;
    }
    setLoadState(result.status); return null;
  };

  const mutate = async (
    source: PhysicsLibraryRecord,
    update: Parameters<typeof mutatePhysicsLibrary>[2],
  ): Promise<PhysicsLibraryRecord | null> => {
    const result = await mutatePhysicsLibrary(source.revision, source.library.activeId, update);
    if (result.status === "saved") { setRecord(result.record); setConflicted(false); return result.record; }
    if (result.status === "conflict") {
      setConflicted(true);
      setNotice("The Physics library changed in another tab. Your unsaved draft is still here; export it before reloading the library.");
    } else if (result.status === "invalid") {
      setLoadState("invalid"); setNotice("The saved Physics library failed validation and was left untouched.");
    } else if (result.status === "unavailable") {
      setNotice("IndexedDB is unavailable. The project was not saved; export the draft JSON to keep a copy.");
    } else setNotice("The library rejected this change because it exceeds its validation or capacity limits.");
    return null;
  };

  const prepareToLeaveDraft = () => !dirty || window.confirm("This project has unsaved changes. Discard them and continue?");

  const createProject = async (kind: PhysicsProject["model"]["kind"]) => {
    if (!prepareToLeaveDraft()) return;
    if (!beginOperation()) return;
    setNotice("Creating a project in the Physics library…");
    try {
      const source = await ensureRecord();
      if (!source) { setNotice("The Physics library could not be opened. No project was written."); return; }
      const committed = await mutate(source, library => createPhysicsLibraryProject(library, kind, Date.now()));
      if (!committed) return;
      const active = activePhysicsProject(committed.library);
      setProject(active); setSavedProject(active); setLoadState(active ? "ready" : "empty");
      setNotice("Project created and saved to this device.");
    } catch { setNotice("The Physics project could not be created."); }
    finally { endOperation(); }
  };

  const saveProject = async (draft: PhysicsProject) => {
    if (operationInFlight.current) return;
    if (!record || !savedProject || !project) { setNotice("Create a Physics project before saving."); return; }
    const candidate = parsePhysicsProject(draft);
    if (!candidate || candidate.id !== savedProject.id || candidate.id !== record.library.activeId) {
      setNotice("This draft no longer matches the selected project. Export it and reload before continuing."); setConflicted(true); return;
    }
    if (!beginOperation(true)) return;
    const savedEditVersion = editVersion.current;
    setNotice("Saving project…");
    try {
      const committed = await mutate(record, library => replaceActivePhysicsProject(library, candidate.id, candidate, Date.now()));
      if (!committed) return;
      const active = activePhysicsProject(committed.library);
      setSavedProject(active);
      if (editVersion.current === savedEditVersion) setProject(active);
      setLoadState(active ? "ready" : "empty");
      setNotice(editVersion.current === savedEditVersion
        ? "Project saved to the local Physics library."
        : "Project saved. Edits made during the save are still unsaved.");
    } catch { setNotice("The Physics project could not be saved."); }
    finally { endOperation(); }
  };

  const openProject = async (id: string) => {
    if (id === record?.library.activeId || !record) return;
    if (!prepareToLeaveDraft()) return;
    if (!beginOperation()) return;
    try {
      const committed = await mutate(record, library => switchPhysicsProject(library, id));
      if (!committed) return;
      const active = activePhysicsProject(committed.library);
      setProject(active); setSavedProject(active); setNotice(active ? `Opened “${active.name}”.` : "Project not found.");
    } catch { setNotice("This project could not be opened."); }
    finally { endOperation(); }
  };

  const duplicate = async () => {
    if (!record || !savedProject || !prepareToLeaveDraft() || !beginOperation()) return;
    try {
      const committed = await mutate(record, library => duplicatePhysicsProject(library, savedProject.id, undefined, Date.now()));
      if (!committed) return;
      const active = activePhysicsProject(committed.library);
      setProject(active); setSavedProject(active); setNotice("Project duplicated.");
    } catch { setNotice("Project could not be duplicated."); }
    finally { endOperation(); }
  };

  const removeProject = async () => {
    if (!record || !savedProject) return;
    if (!window.confirm(`Delete “${savedProject.name}”? This also discards any unsaved edits and cannot be undone.`)) return;
    if (!beginOperation()) return;
    try {
      const committed = await mutate(record, library => deletePhysicsProject(library, savedProject.id, library.activeId));
      if (!committed) return;
      const active = activePhysicsProject(committed.library);
      setProject(active); setSavedProject(active); setLoadState(active ? "ready" : "empty"); setNotice("Project deleted.");
    } catch { setNotice("Project could not be deleted."); }
    finally { endOperation(); }
  };

  const rename = async () => {
    if (!record || !savedProject || !project) return;
    const name = window.prompt("Rename Physics project", project.name);
    if (name === null) return;
    const nextName = name.trim();
    if (!nextName || nextName.length > 120) { setNotice("Project names must contain 1 to 120 characters."); return; }
    const otherEdits = JSON.stringify({ ...project, name: savedProject.name }) !== JSON.stringify(savedProject);
    if (otherEdits && !window.confirm("This rename will discard other unsaved changes. Export them first if you need a copy.")) return;
    if (!beginOperation()) return;
    try {
      const committed = await mutate(record, library => renamePhysicsProject(library, savedProject.id, nextName, Date.now()));
      if (!committed) return;
      const active = activePhysicsProject(committed.library);
      setProject(active); setSavedProject(active); setNotice("Project renamed and saved.");
    } catch { setNotice("Project could not be renamed."); }
    finally { endOperation(); }
  };

  const importProject = async (imported: PhysicsProject): Promise<boolean> => {
    if (!prepareToLeaveDraft()) return false;
    if (!beginOperation()) return false;
    setNotice("Validating project and adding it to the library…");
    try {
      const source = await ensureRecord();
      if (!source) { setNotice("The Physics library could not be opened. The current library remains unchanged."); return false; }
      const committed = await mutate(source, library => addImportedPhysicsProject(library, imported, undefined, Date.now()));
      if (!committed) return false;
      const active = activePhysicsProject(committed.library);
      setProject(active); setSavedProject(active); setLoadState(active ? "ready" : "empty"); setNotice("Project validated and imported with a new library identity.");
      editVersion.current += 1;
      return !!active;
    } catch { setNotice("Import failed. The Physics library and current project remain unchanged."); }
    finally { endOperation(); }
    return false;
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>, intoLibrary: boolean) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > PHYSICS_JSON_MAX_BYTES) { setNotice("This file exceeds the 256 KB Physics project limit."); return; }
    try {
      const contents = await file.text();
      if (new TextEncoder().encode(contents).byteLength > PHYSICS_JSON_MAX_BYTES) { setNotice("This file exceeds the 256 KB Physics project limit."); return; }
      const parsed = parsePhysicsProject(JSON.parse(contents) as unknown);
      if (!parsed) { setNotice("This file is not a valid version 1 Physics project."); return; }
      if (intoLibrary) {
        await importProject(parsed);
      } else {
        if (!prepareToLeaveDraft()) return;
        editVersion.current += 1;
        setProject(parsed);
        setSavedProject(null);
        setNotice("Valid project loaded into the recovery draft. Export it after storage becomes available.");
      }
    } catch { setNotice("The selected JSON could not be read. Existing project data is unchanged."); }
  };

  const exportDraftAndReload = async () => {
    if (project && !saveDownload(project)) { setNotice("Draft export failed. The current data has not been reloaded."); return; }
    setLoadState("loading");
    setNotice("Draft exported. Reloading the current Physics library…");
    await loadLibrary();
  };

  if (loadState === "loading") return <div className="px-studio-loading" role="status"><span className="px-live-dot"/> Loading Physics projects…</div>;
  if (loadState === "invalid" || loadState === "unavailable") return <div className="px-studio-state px-state-error">
    <span className="px-state-icon"><AlertTriangle size={22}/></span><span className="px-eyebrow">PROJECT LIBRARY</span>
    <h1>{loadState === "invalid" ? "Library needs recovery" : "Local storage unavailable"}</h1>
    <p>{loadState === "invalid" ? "The Physics project record failed strict validation. It has not been replaced. No saved Mathematics projects or keys were touched." : "IndexedDB is unavailable in this browser context. Physics projects require local transactional storage."}</p>
    {project && <button type="button" className="px-button px-button-secondary" onClick={() => saveDownload(project)}>Export current draft JSON</button>}
    <label className="px-tool-button px-file-button"><FilePlus2 size={14}/> Import a recovery draft<input aria-label="Import a recovery draft" type="file" accept="application/json,.json" onChange={event => { void handleImportFile(event, false); }}/></label>
    {notice && <p className="px-workbench-notice" role="status">{notice}</p>}
    <button type="button" className="px-tool-button" onClick={() => { if (prepareToLeaveDraft()) { setLoadState("loading"); void loadLibrary(); } }}><RefreshCw size={14}/> Retry library read</button>
    <Link href="/physics" className="px-text-link">Physics overview <ArrowRight size={14}/></Link>
  </div>;

  if (!project || !savedProject || !record || loadState === "empty") return <div className="px-studio-empty" id="physics-projects">
    <div className="px-studio-empty-art"><FolderOpen size={27}/></div><span className="px-eyebrow">PHYSICS PROJECT LIBRARY</span>
    <h1>Your next experiment starts here.</h1><p>Create a project in the local Physics library. Each project keeps its conditions, solver settings, view, and lab report together.</p>
    <div className="px-create-options">
      <button type="button" disabled={working} onClick={() => { void createProject("projectile"); }}><span className="px-card-icon"><FilePlus2 size={18}/></span><span><strong>New Projectile Motion</strong><small>Gravity, launch velocity, and linear drag</small></span><Plus size={15}/></button>
      <button type="button" disabled={working} onClick={() => { void createProject("spring"); }}><span className="px-card-icon"><FilePlus2 size={18}/></span><span><strong>New Mass–Spring Oscillator</strong><small>Mass, stiffness, and viscous damping</small></span><Plus size={15}/></button>
    </div>
    <label className="px-tool-button px-file-button px-empty-import"><FilePlus2 size={14}/> Import project JSON<input aria-label="Import project JSON" type="file" accept="application/json,.json" disabled={working} onChange={event => { void handleImportFile(event, true); }}/></label>
    <p className="px-storage-note"><Database size={13}/> Stored in the Physics library in IndexedDB. Nothing is written until you create a project.</p>
    {notice && <p className="px-workbench-notice" role="status">{notice}</p>}
  </div>;

  return <div className="px-studio" id="physics-projects">
    <section className="px-projectbar" aria-label="Physics project controls">
      <div className="px-project-identity"><span className="px-project-mark"><Database size={17}/></span><div><span className="px-eyebrow">LOCAL PROJECT LIBRARY</span><strong>{record.library.projects.length} / 20 projects</strong></div></div>
      <label className="px-project-select-label" htmlFor="px-project-select">Physics projects
        <select id="px-project-select" aria-label="Physics projects" value={record.library.activeId ?? ""} disabled={working} onChange={event => { void openProject(event.currentTarget.value); }}>
          {record.library.projects.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </label>
      <div className="px-project-actions">
        <button type="button" className="px-project-action px-new-project" aria-label="New project" disabled={working || record.library.projects.length >= 20} onClick={() => { void createProject("projectile"); }}><Plus size={14}/> New project</button>
        <button type="button" className="px-project-action" aria-label="Duplicate project" disabled={working || record.library.projects.length >= 20} onClick={() => { void duplicate(); }}><Copy size={14}/> Duplicate</button>
        <button type="button" className="px-project-action px-delete-action" aria-label="Delete project" disabled={working} onClick={() => { void removeProject(); }}><Trash2 size={14}/><span>Delete</span></button>
      </div>
    </section>
    {conflicted && <section className="px-conflict-panel" aria-label="Library conflict" role="alert"><AlertTriangle size={17}/><div><strong>Another tab changed this project library.</strong><p>Your current draft is kept in this tab. Export it before you reload the latest saved projects.</p></div><div><button type="button" className="px-tool-button" onClick={() => { if (project && !saveDownload(project)) setNotice("Draft export failed; reload was cancelled."); else setNotice("Draft exported. You can now reload the library."); }}>Export draft JSON</button><button type="button" className="px-button px-button-secondary" onClick={() => { void exportDraftAndReload(); }}>Export draft &amp; reload library</button></div></section>}
      <div className="px-project-name-row"><label htmlFor="px-project-name">Project name</label><input id="px-project-name" aria-label="Project name" maxLength={120} value={project.name} disabled={working} onChange={event => updateDraft({ ...project, name: event.currentTarget.value })}/><button type="button" className="px-project-action" aria-label="Rename project" disabled={working || !project.name.trim()} onClick={() => { void rename(); }}>Rename project</button><span className={dirty ? "px-dirty-indicator is-dirty" : "px-dirty-indicator"}>{dirty ? "Unsaved changes" : "Saved"}</span></div>
    <div className="px-studio-actions-row"><div className="px-studio-action-group">
      <button type="button" className="px-project-action" disabled={working || record.library.projects.length >= 20} onClick={() => { void createProject("projectile"); }}>New Projectile Motion</button>
      <button type="button" className="px-project-action" disabled={working || record.library.projects.length >= 20} onClick={() => { void createProject("spring"); }}>New Mass–Spring</button>
    </div><span className="px-storage-mode"><Database size={12}/> Revision {record.revision} · IndexedDB</span></div>
    {project && <div inert={working && !allowDraftEdits} aria-busy={working}>
      <PhysicsWorkbench key={project.id} project={project} mode="studio" dirty={dirty} onProjectChange={updateDraft} onSave={saveProject} onImport={importProject} />
    </div>}
    {notice && <p className="px-workbench-notice" role="status" aria-live="polite">{notice}</p>}
  </div>;
}

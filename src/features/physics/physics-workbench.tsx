"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import {
  Activity, AlertTriangle, ArrowDownToLine, Check, CircleHelp, Download, Pause, Play, RotateCcw,
  Save, StepForward, Table2,
} from "lucide-react";
import { PhysicsCanvas } from "@/components/physics-canvas";
import type { SimulationFrame } from "@/core/physics/engine/simulation";
import { exportMeasurementsCSV, exportMeasurementsJSON } from "@/core/physics/measurements/export";
import { PHYSICS_JSON_MAX_BYTES, parsePhysicsProject, type PhysicsProject } from "@/core/physics/model/schema";
import { usePhysicsRuntime } from "@/features/physics/use-physics-runtime";

type PhysicsProjectEditor = {
  project: PhysicsProject;
  mode: "playground" | "studio";
  dirty?: boolean;
  saveLabel?: string;
  onProjectChange(project: PhysicsProject): void;
  onSave?: (project: PhysicsProject) => void;
  onImport?: (project: PhysicsProject) => Promise<boolean | void> | boolean | void;
};

type NumericField = Readonly<{ key: string; label: string; unit: string; min: number; max: number; step: number; description: string }>;

const MODEL_FIELDS: Record<PhysicsProject["model"]["kind"], readonly NumericField[]> = {
  projectile: [
    { key: "mass", label: "Mass", unit: "kg", min: .000001, max: 1e6, step: .1, description: "Inertial mass of the projectile." },
    { key: "gravity", label: "Gravity", unit: "m/s²", min: 0, max: 100, step: .01, description: "Uniform gravitational field strength." },
    { key: "drag", label: "Linear drag", unit: "kg/s", min: 0, max: 1e6, step: .01, description: "Damping coefficient for F = −b v." },
    { key: "initialX", label: "Initial x", unit: "m", min: -1e6, max: 1e6, step: .1, description: "Horizontal launch position." },
    { key: "initialY", label: "Initial y", unit: "m", min: 0, max: 1e6, step: .1, description: "Height above the ground plane." },
    { key: "velocityX", label: "Initial vₓ", unit: "m/s", min: -1e4, max: 1e4, step: .1, description: "Horizontal launch velocity." },
    { key: "velocityY", label: "Initial vᵧ", unit: "m/s", min: -1e4, max: 1e4, step: .1, description: "Vertical launch velocity." },
  ],
  spring: [
    { key: "mass", label: "Mass", unit: "kg", min: .000001, max: 1e6, step: .1, description: "Oscillating mass." },
    { key: "stiffness", label: "Spring stiffness", unit: "N/m", min: .000001, max: 1e8, step: .1, description: "Hooke force per displacement." },
    { key: "damping", label: "Damping", unit: "kg/s", min: 0, max: 1e8, step: .01, description: "Viscous damping coefficient." },
    { key: "displacement", label: "Initial x", unit: "m", min: -1e6, max: 1e6, step: .1, description: "Initial displacement from equilibrium." },
    { key: "velocity", label: "Initial v", unit: "m/s", min: -1e4, max: 1e4, step: .1, description: "Initial velocity along the spring axis." },
  ],
};

function display(value: number | undefined, digits = 4): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return Number(value.toPrecision(digits)).toString();
}

function formatTime(value: number | undefined): string {
  return value === undefined ? "0.000 s" : `${value.toFixed(3)} s`;
}

function download(filename: string, type: string, content: string): boolean {
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    return true;
  } catch {
    return false;
  }
}

function parameterRecords(project: PhysicsProject) {
  return Object.entries(project.model.parameters).map(([name, value]) => ({ name, value: String(value), unit: unitFor(project, name) }));
}

function unitFor(project: PhysicsProject, name: string): string {
  if (name === "mass") return "kg";
  if (name === "gravity") return "m/s²";
  if (name === "drag" || name === "damping") return "kg/s";
  if (name === "stiffness") return "N/m";
  if (name.toLowerCase().includes("velocity")) return "m/s";
  if (name.startsWith("initial")) return name === "initialX" || name === "initialY" ? "m" : "";
  if (name === "displacement") return "m";
  return "—";
}

function exportName(project: PhysicsProject, extension: string) {
  const safe = project.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "physics-project";
  return `${safe}-measurements.${extension}`;
}

function MeasurementTable({ project, samples, frame }: { project: PhysicsProject; samples: SimulationFrame[]; frame: SimulationFrame | null }) {
  const rows = samples.slice(-100);
  return <section className="px-measurements" aria-labelledby="px-measurements-title">
    <div className="px-panel-heading">
      <div><span className="px-eyebrow"><Table2 size={13} /> DATA</span><h2 id="px-measurements-title">Simulation measurements</h2><p>Recorded state samples in SI units. Showing the latest {rows.length} of {samples.length}.</p></div>
      <div className="px-export-actions">
        <button type="button" className="px-tool-button" aria-label="Export measurements CSV" onClick={() => {
          const csv = exportMeasurementsCSV(project, samples);
          if (!csv || !download(exportName(project, "csv"), "text/csv;charset=utf-8", csv)) window.alert("Measurements could not be exported.");
        }}><Download size={14} /> <span>Export CSV</span></button>
        <button type="button" className="px-tool-button" aria-label="Export measurements JSON" onClick={() => {
          const json = exportMeasurementsJSON(project, samples);
          if (!json || !download(exportName(project, "json"), "application/json;charset=utf-8", json)) window.alert("Measurements could not be exported.");
        }}><ArrowDownToLine size={14} /> <span>Export JSON</span></button>
      </div>
    </div>
    {rows.length === 0 ? <div className="px-table-empty" role="status">Run or step the simulation to collect measurements.</div> : <div className="px-table-wrap" tabIndex={0} aria-label="Scrollable measurement table">
      <table className="px-measurement-table">
        <caption>Deterministic simulation samples. Current frame is {frame ? `step ${frame.step}` : "not available"}.</caption>
        <thead><tr><th scope="col">Step</th><th scope="col">Time <span>(s)</span></th><th scope="col">x <span>(m)</span></th><th scope="col">y <span>(m)</span></th><th scope="col">vₓ <span>(m/s)</span></th><th scope="col">vᵧ <span>(m/s)</span></th><th scope="col">aₓ <span>(m/s²)</span></th><th scope="col">aᵧ <span>(m/s²)</span></th><th scope="col">Fₓ <span>(N)</span></th><th scope="col">Fᵧ <span>(N)</span></th><th scope="col">K <span>(J)</span></th><th scope="col">U <span>(J)</span></th><th scope="col">E <span>(J)</span></th></tr></thead>
        <tbody>{rows.map(sample => <tr key={sample.step} aria-current={frame?.step === sample.step ? "true" : undefined}>
          <th scope="row">{sample.step}</th><td>{display(sample.time, 5)}</td><td>{display(sample.position.x)}</td><td>{display(sample.position.y)}</td><td>{display(sample.velocity.x)}</td><td>{display(sample.velocity.y)}</td><td>{display(sample.acceleration.x)}</td><td>{display(sample.acceleration.y)}</td><td>{display(sample.force.x)}</td><td>{display(sample.force.y)}</td><td>{display(sample.kineticEnergy)}</td><td>{display(sample.potentialEnergy)}</td><td>{display(sample.totalEnergy)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    <p className="px-table-provenance"><Activity size={12} /> {project.model.kind === "projectile" ? "Point mass · Uniform gravity · Linear drag" : "Point mass · Hooke spring · Viscous damping"} <span>·</span> {project.simulation.integrator} <span>·</span> Δt {project.simulation.fixedTimeStep.toPrecision(4)} s <span>·</span> SI</p>
  </section>;
}

export function PhysicsWorkbench({ project, mode, dirty = false, saveLabel = "Save project", onProjectChange, onSave, onImport }: PhysicsProjectEditor) {
  // View-only edits such as camera movement and lab notes must not recreate the
  // worker. The worker receives a strict project snapshot when physical inputs change.
  // Metadata, report text, view toggles, and camera do not alter the equations.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const runtimeProject = useMemo(() => ({ ...project, scene: { ...project.scene, camera: { x: 0, y: 0, zoom: 1 } } }), [project.id, project.model, project.simulation]);
  const runtime = usePhysicsRuntime(runtimeProject);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [reportErrors, setReportErrors] = useState<Record<string, string>>({});
  const viewProject = project;
  const frame = runtime.frame;
  const save = () => onSave?.(project);
  const maxStep = Math.max(1, Math.min(1_000_000, Math.ceil(project.simulation.duration / project.simulation.fixedTimeStep)));
  const seekPosition = Math.round(((frame?.step ?? 0) / maxStep) * 1000);
  const fields = MODEL_FIELDS[project.model.kind];
  const parameters = project.model.parameters as unknown as Record<string, number>;
  const statusText = runtime.status === "running" ? "Running" : runtime.status === "completed" ? "Completed" : runtime.status === "error" ? "Simulation error" : runtime.status === "paused" ? "Paused" : "Ready";

  const checkField = (field: NumericField, raw: string): string | null => {
    const value = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(value)) return "Enter a finite number.";
    const candidate = {
      ...project,
      model: { ...project.model, parameters: { ...project.model.parameters, [field.key]: value } },
    } as PhysicsProject;
    const result = parsePhysicsProject(candidate);
    if (!result) return `Use ${field.min} to ${field.max} ${field.unit}. Check the solver stability limits.`;
    return null;
  };

  const commitField = (field: NumericField, raw: string) => {
    const key = `${project.model.kind}.${field.key}`;
    const error = checkField(field, raw);
    if (error) {
      setFieldErrors(previous => ({ ...previous, [key]: error }));
      return;
    }
    const value = Number(raw);
    const candidate = { ...project, model: { ...project.model, parameters: { ...project.model.parameters, [field.key]: value } } } as PhysicsProject;
    const result = parsePhysicsProject(candidate);
    if (!result) return;
    setFieldErrors(previous => { const next = { ...previous }; delete next[key]; return next; });
    setFieldDrafts(previous => { const next = { ...previous }; delete next[key]; return next; });
    setNotice("Parameters updated. The worker will initialize a new run from t = 0.");
    onProjectChange(result);
  };

  const updateSimulation = (field: "duration" | "fixedTimeStep" | "sampleEvery", value: number) => {
    const candidate = { ...project, simulation: { ...project.simulation, [field]: value } };
    const result = parsePhysicsProject(candidate);
    const key = `simulation.${field}`;
    if (!result) {
      setFieldErrors(previous => ({ ...previous, [key]: field === "duration" ? "Duration must fit the one million step budget." : "Check the time step, sample range, and solver stability." }));
      return;
    }
    setFieldErrors(previous => { const next = { ...previous }; delete next[key]; return next; });
    onProjectChange(result);
  };

  const updateReport = (key: keyof PhysicsProject["labReport"], value: string, max: number) => {
    const invalidKey = `report.${key}`;
    if (value.length > max) {
      setReportErrors(previous => ({ ...previous, [invalidKey]: `Limit: ${max.toLocaleString()} characters.` }));
      return;
    }
    setReportErrors(previous => { const next = { ...previous }; delete next[invalidKey]; return next; });
    onProjectChange({ ...project, labReport: { ...project.labReport, [key]: value } });
  };

  const handleImportDraft = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > PHYSICS_JSON_MAX_BYTES) { setNotice("This file exceeds the 256 KB Physics project limit."); return; }
    try {
      const text = await file.text();
      if (new TextEncoder().encode(text).byteLength > PHYSICS_JSON_MAX_BYTES) { setNotice("This file exceeds the 256 KB Physics project limit."); return; }
      const parsed = parsePhysicsProject(JSON.parse(text) as unknown);
      if (!parsed) { setNotice("This file is not a valid version 1 Physics project."); return; }
      if (!onImport && dirty && !window.confirm("Replace the current unsaved draft? Export it first if you need a copy.")) return;
      if (onImport) {
        const accepted = await onImport(parsed);
        if (accepted === false) return;
        return;
      } else {
        onProjectChange(parsed);
      }
      setFieldErrors({}); setFieldDrafts({});
      setNotice("Validated project loaded into the Studio draft. Save project to commit it to your library.");
    } catch {
      setNotice("The selected JSON could not be read. The current draft is unchanged.");
    }
  };

  const exportProject = () => {
    const json = JSON.stringify(project, null, 2);
    if (!parsePhysicsProject(JSON.parse(json) as unknown) || !download(`${project.name.replace(/[^\p{L}\p{N}-]+/gu, "-").slice(0, 60) || "physics-project"}.json`, "application/json;charset=utf-8", json)) {
      setNotice("Project could not be exported."); return;
    }
    setNotice("Validated Physics project exported as JSON.");
  };

  const elapsed = frame?.time ?? 0;
  return <div className={`px-workbench px-workbench-${mode}`}>
    <header className="px-workbench-heading">
      <div><span className="px-eyebrow">{mode === "playground" ? "TEMPORARY EXPERIMENT" : "PHYSICS STUDIO"}</span>
        <h1>{project.name}</h1><p>{project.model.kind === "projectile" ? "A point mass under uniform gravity and optional linear drag." : "A point mass attached to a linear spring with viscous damping."} <span>All model inputs use SI units.</span></p>
      </div>
      <div className="px-workbench-actions">
        {mode === "playground" ? <>
          <button type="button" className="px-tool-button" onClick={exportProject}><Download size={14}/> Export project JSON</button>
          <button type="button" className="px-button px-button-primary" onClick={save}><Save size={15}/>{saveLabel}</button>
        </> : <>
          <button type="button" className="px-tool-button" onClick={exportProject}><Download size={14}/> Export project JSON</button>
          <label className="px-tool-button px-file-button"><ArrowDownToLine size={14}/> Import project JSON<input aria-label="Import project JSON" type="file" accept="application/json,.json" onChange={handleImportDraft}/></label>
          <button type="button" className={`px-button ${dirty ? "px-button-primary" : "px-button-secondary"}`} onClick={save} disabled={!dirty}><Save size={15}/>{saveLabel}</button>
        </>}
      </div>
    </header>
    <div className="px-run-status" role="status" aria-live="polite"><span className={runtime.status === "running" ? "px-status-marker is-running" : "px-status-marker"}/><strong>{statusText}</strong><span>Simulation time <b>{formatTime(elapsed)}</b></span><span>Step <b>{frame?.step ?? 0}</b></span><span>Solver <b>{project.simulation.integrator}</b></span></div>

    <div className="px-workbench-grid">
      <section className="px-viewport panel" aria-label="Physics simulation viewport">
        <div className="px-viewport-top"><div><span className="px-eyebrow">2D SIMULATION</span><h2>{project.model.kind === "projectile" ? "Trajectory" : "Oscillator"}</h2></div><span className="px-unit-chip">x-right · y-up <b>SI</b></span></div>
        <div className="px-canvas-wrap"><PhysicsCanvas project={viewProject} frame={frame} samples={runtime.samples} onCameraChange={next => {
          onProjectChange({ ...project, scene: { ...project.scene, camera: next } });
        }}/>
          <div className="px-canvas-caption" aria-hidden="true"><span>{project.scene.showGrid ? "GRID ON" : "GRID OFF"}</span><span>{project.scene.showTrail ? "TRAIL ON" : "TRAIL OFF"}</span></div>
        </div>
        <div className="px-transport">
          <div className="px-transport-buttons">
            {runtime.status === "running" ? <button type="button" className="px-transport-primary" onClick={runtime.pause} aria-label="Pause simulation"><Pause size={15}/> Pause</button> : <button type="button" className="px-transport-primary" onClick={runtime.run} disabled={runtime.status === "completed" || runtime.status === "error"} aria-label="Run simulation"><Play size={15}/> Run</button>}
            <button type="button" onClick={runtime.step} disabled={runtime.status === "running" || runtime.status === "completed" || runtime.status === "error"} aria-label="Step simulation forward"><StepForward size={15}/> Step</button>
            <button type="button" onClick={runtime.reset} disabled={runtime.status === "running" || runtime.status === "idle"} aria-label="Reset simulation"><RotateCcw size={14}/> Reset</button>
          </div>
          <div className="px-timeline-control"><label htmlFor="px-simulation-time">Simulation time</label><output htmlFor="px-simulation-time">{formatTime(elapsed)}</output><input id="px-simulation-time" aria-label="Simulation time" type="range" min="0" max="1000" value={seekPosition} disabled={runtime.status === "running" || runtime.status === "idle" || runtime.status === "error"} onChange={event => runtime.seek(Math.round(Number(event.currentTarget.value) / 1000 * maxStep))}/><div><span>0.000 s</span><span>{project.simulation.duration.toFixed(2)} s</span></div></div>
        </div>
        <p className="px-keyboard-hint"><CircleHelp size={13}/> Drag to pan. Use the scroll wheel or trackpad to zoom. Simulation time is controlled by the timeline.</p>
      </section>

      <aside className="px-inspector panel" aria-label="Physics inspector">
        <div className="px-inspector-heading"><span className="px-card-icon"><Activity size={17}/></span><div><span className="px-eyebrow">INSPECTOR</span><h2>System parameters</h2></div></div>
        <div className="px-inspector-section"><div className="px-section-label"><span>Initial conditions & forces</span><span>SI</span></div>
        {fields.map(field => { const inputKey = `${project.model.kind}.${field.key}`; const value = parameters[field.key]; return <div className="px-field" key={field.key}>
            <div className="px-field-label"><label htmlFor={`px-field-${field.key}`}>{field.label} ({field.unit})</label><span>{field.unit}</span></div>
            <input id={`px-field-${field.key}`} type="number" inputMode="decimal" min={field.min} max={field.max} step={field.step} value={fieldDrafts[inputKey] ?? String(value)} aria-invalid={!!fieldErrors[inputKey]} aria-describedby={`${inputKey}-hint ${inputKey}-error`} onChange={event => {
              const raw = event.currentTarget.value;
              setFieldDrafts(previous => ({ ...previous, [inputKey]: raw }));
              const error = checkField(field, raw);
              setFieldErrors(previous => { const next = { ...previous }; if (error) next[inputKey] = error; else delete next[inputKey]; return next; });
            }} onBlur={event => commitField(field, event.currentTarget.value)}/>
            <small id={`${inputKey}-hint`}>{field.description}</small>{fieldErrors[inputKey] && <span className="px-field-error" id={`${inputKey}-error`} role="alert">{fieldErrors[inputKey]}</span>}
          </div>; })}
        </div>
        <div className="px-inspector-section"><div className="px-section-label"><span>Simulation setup</span><span>FIXED STEP</span></div>
          <div className="px-field"><div className="px-field-label"><label htmlFor="px-duration">Duration</label><span>s</span></div><input id="px-duration" type="number" min="0" max="600" step="0.1" value={project.simulation.duration} aria-invalid={!!fieldErrors["simulation.duration"]} onChange={event => updateSimulation("duration", Number(event.currentTarget.value))}/>{fieldErrors["simulation.duration"] && <span className="px-field-error" role="alert">{fieldErrors["simulation.duration"]}</span>}</div>
          <div className="px-field"><div className="px-field-label"><label htmlFor="px-time-step">Fixed time step</label><span>s</span></div><input id="px-time-step" type="number" min="0.0001" max="0.1" step="0.0001" value={project.simulation.fixedTimeStep} aria-invalid={!!fieldErrors["simulation.fixedTimeStep"]} onChange={event => updateSimulation("fixedTimeStep", Number(event.currentTarget.value))}/>{fieldErrors["simulation.fixedTimeStep"] && <span className="px-field-error" role="alert">{fieldErrors["simulation.fixedTimeStep"]}</span>}</div>
          <div className="px-field"><div className="px-field-label"><label htmlFor="px-sample-every">Record every</label><span>steps</span></div><input id="px-sample-every" type="number" min="1" max="1000" step="1" value={project.simulation.sampleEvery} aria-invalid={!!fieldErrors["simulation.sampleEvery"]} onChange={event => updateSimulation("sampleEvery", Math.round(Number(event.currentTarget.value)))}/>{fieldErrors["simulation.sampleEvery"] && <span className="px-field-error" role="alert">{fieldErrors["simulation.sampleEvery"]}</span>}</div>
          <p className="px-solver-note"><Check size={13}/> Symplectic Euler · version {project.simulation.integratorVersion}<br/><span>Numerical stability checks run before initialization.</span></p>
        </div>
        <div className="px-inspector-section px-scene-toggles"><div className="px-section-label"><span>Scene</span><span>2D</span></div>
          {([ ["showGrid", "Show grid"], ["showVectors", "Show vectors"], ["showTrail", "Show trail"] ] as const).map(([key, label]) => <label className="px-toggle" key={key}><span>{label}</span><input type="checkbox" checked={project.scene[key]} onChange={event => onProjectChange({ ...project, scene: { ...project.scene, [key]: event.currentTarget.checked } })}/><i aria-hidden="true"/></label>)}
        </div>
        {mode === "studio" && <div className="px-inspector-section px-report-fields"><div className="px-section-label"><span>Lab report</span><span>PROJECT NOTES</span></div>
          <label htmlFor="px-hypothesis">Hypothesis</label><textarea id="px-hypothesis" rows={3} maxLength={8000} value={project.labReport.hypothesis} onChange={event => updateReport("hypothesis", event.currentTarget.value, 8000)} placeholder="What do you expect to observe?" />{reportErrors["report.hypothesis"] && <span className="px-field-error" role="alert">{reportErrors["report.hypothesis"]}</span>}
          <label htmlFor="px-notes">Observations</label><textarea id="px-notes" rows={5} maxLength={32000} value={project.labReport.notes} onChange={event => updateReport("notes", event.currentTarget.value, 32000)} placeholder="Record measurements and patterns as you explore." />{reportErrors["report.notes"] && <span className="px-field-error" role="alert">{reportErrors["report.notes"]}</span>}
          <label htmlFor="px-conclusion">Conclusion</label><textarea id="px-conclusion" rows={3} maxLength={8000} value={project.labReport.conclusion} onChange={event => updateReport("conclusion", event.currentTarget.value, 8000)} placeholder="What did the results show?" />{reportErrors["report.conclusion"] && <span className="px-field-error" role="alert">{reportErrors["report.conclusion"]}</span>}
        </div>}
      </aside>
    </div>

    <section className="px-readouts" aria-label="Live measurements"><div className="px-readout-heading"><span className="px-eyebrow"><Activity size={13}/> LIVE READOUT</span><span>At current simulation time</span></div>
      <div className="px-readout-grid">
        <Metric label="Position x" value={display(frame?.position.x)} unit="m"/><Metric label="Position y" value={display(frame?.position.y)} unit="m"/>
        <Metric label="Velocity vₓ" value={display(frame?.velocity.x)} unit="m/s"/><Metric label="Velocity vᵧ" value={display(frame?.velocity.y)} unit="m/s"/>
        <Metric label="Speed" value={frame ? display(Math.hypot(frame.velocity.x, frame.velocity.y)) : "—"} unit="m/s"/><Metric label="Acceleration" value={frame ? display(Math.hypot(frame.acceleration.x, frame.acceleration.y)) : "—"} unit="m/s²"/>
        <Metric label="Kinetic energy" value={display(frame?.kineticEnergy)} unit="J"/><Metric label="Potential energy" value={display(frame?.potentialEnergy)} unit="J"/>
        <Metric label="Total energy" value={display(frame?.totalEnergy)} unit="J"/><Metric label="Net force" value={frame ? display(Math.hypot(frame.force.x, frame.force.y)) : "—"} unit="N"/>
      </div>
    </section>
    <MeasurementTable project={project} samples={runtime.samples} frame={frame}/>

    {runtime.error && <div className="px-alert px-alert-error" role="alert"><AlertTriangle size={16}/><div><strong>Simulation could not continue</strong><p>{runtime.error}</p><button type="button" className="px-tool-button" onClick={runtime.restart}>Retry simulation worker</button></div></div>}
    {runtime.diagnostics.lagEvents > 0 && <div className="px-alert" role="status"><AlertTriangle size={15}/><p>The worker observed {runtime.diagnostics.lagEvents} timing delays. Simulation state remains tied to fixed time steps.</p></div>}
    {notice && <p className="px-workbench-notice" role="status" aria-live="polite">{notice}</p>}
    <div className="px-workbench-foot"><span><Check size={13}/> Project validation: strict version 1 schema</span><span><span>Parameters</span> {parameterRecords(project).map(entry => `${entry.name} ${entry.value} ${entry.unit}`).join(" · ")}</span></div>
  </div>;
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return <div className="px-readout"><span>{label}</span><output aria-label={`${label} (${unit})`}>{value}<small> {unit}</small></output></div>;
}

"use client";

import { useMemo, useState } from "react";
import { BookOpen, Download, FileText, Printer } from "lucide-react";
import { SceneCanvas } from "./scene-canvas";
import { courseworkFormulas, defaultCourseworkDraft, type CourseworkDraft } from "@/core/graph/coursework";
import {activeProject,readStudioLibrary,writeActiveCoursework} from "@/core/projects/studio-library";
import type { NodeGraph } from "@/core/graph/model";
import type { MathDocument } from "@/core/document/schema";

type Props = {
  graph: NodeGraph;
  scene: MathDocument;
  time: number;
  outputs: Readonly<Record<string, number>>;
  error: string | null;
  projectId?: string;
};
type DraftKey = Exclude<keyof CourseworkDraft, "version">;

const inputFields: readonly {key:DraftKey; label:string; rows?:number; hint?:string}[] = [
  {key:"institution",label:"Institution"},
  {key:"student",label:"Student"},
  {key:"supervisor",label:"Supervisor"},
  {key:"title",label:"Coursework title"},
  {key:"objective",label:"Research objective",rows:3,hint:"What are you investigating, and why?"},
  {key:"method",label:"Methodology",rows:4,hint:"Describe the mathematical model and calculations"},
  {key:"conclusion",label:"Conclusions",rows:4,hint:"Summarize findings and observations"},
];

/** Small, print-safe diagram derived exclusively from validated graph nodes and edges. */
function GraphFigure({graph}:{graph:NodeGraph}) {
  const coords = useMemo(()=>{
    const minX = Math.min(...graph.nodes.map(node=>node.x));
    const minY = Math.min(...graph.nodes.map(node=>node.y));
    const maxX = Math.max(...graph.nodes.map(node=>node.x));
    const maxY = Math.max(...graph.nodes.map(node=>node.y));
    const xRange = Math.max(1,maxX-minX);
    const yRange = Math.max(1,maxY-minY);
    return new Map(graph.nodes.map(node=>[node.id,{
      x:28 + ((node.x-minX)/xRange)*688,
      y:28 + ((node.y-minY)/yRange)*216,
    }]));
  },[graph.nodes]);
  return <svg className="pm-ng-coursework-diagram" role="img" aria-label="Mathematical node diagram" viewBox="0 0 900 330" preserveAspectRatio="xMidYMid meet">
    <defs>
      <marker id="pm-ng-report-arrow" markerWidth="6" markerHeight="6" refX="5.5" refY="3" orient="auto">
        <path d="M0 0 L6 3 L0 6 Z" fill="#3c7faf"/>
      </marker>
    </defs>
    {graph.edges.map(edge=>{
      const from=coords.get(edge.source),to=coords.get(edge.target);
      if(!from||!to)return null;
      return <path key={edge.id} d={`M ${from.x+148} ${from.y+24} C ${(from.x+to.x)/2+140} ${from.y+24}, ${(from.x+to.x)/2+60} ${to.y+24}, ${to.x} ${to.y+24}`}
        stroke="#4f8db2" strokeWidth="2" fill="none" markerEnd="url(#pm-ng-report-arrow)"/>;
    })}
    {graph.nodes.map(node=>{
      const at=coords.get(node.id)!;
      return <g key={node.id}>
        <rect x={at.x} y={at.y} width="148" height="49" rx="8" fill={node.kind==="output"?"#e9e6f7":"#eff5fb"} stroke={node.kind==="output"?"#b5a3d7":"#9bb9d4"} strokeWidth="1.4"/>
        <text x={at.x+10} y={at.y+19} fontSize="11" fill="#142944" fontWeight="700">{node.title.length>21?node.title.slice(0,20)+"…":node.title}</text>
        <text x={at.x+10} y={at.y+37} fontSize="9" fill="#526780">{node.kind==="constant"?String(node.value):node.kind==="output"?node.property:node.kind}</text>
      </g>;
    })}
  </svg>;
}

export function GraphCoursework({graph,scene,time,outputs,error,projectId}:Props){
  const [draft,setDraft]=useState(()=>{
    const project=activeProject(readStudioLibrary(localStorage));
    return projectId===project.id?project.coursework:defaultCourseworkDraft(graph);
  });
  const [saved,setSaved]=useState(true);
  const formulas=useMemo(()=>courseworkFormulas(graph),[graph]);
  const update=(key:DraftKey,value:string)=>{
    const next={...draft,[key]:value};
    setDraft(next);
    // Timestamp is sampled in the input event handler, not during rendering.
    // eslint-disable-next-line react-hooks/purity
    const now=Date.now();
    setSaved(projectId===activeProject(readStudioLibrary(localStorage)).id && !!writeActiveCoursework(next,localStorage,now));
  };
  const reportDate=useMemo(()=>new Date().toLocaleDateString("en-GB"),[]);
  const print=()=>window.print();

  return <div className="pm-ng-coursework-layout" aria-label="Coursework workspace">
    <aside className="pm-ng-coursework-settings" aria-label="Coursework settings">
      <div className="pm-ng-coursework-settings-head">
        <BookOpen size={19}/>
        <div><strong>Coursework</strong><span>Academic report workspace</span></div>
      </div>
      <div className="pm-ng-coursework-form">
        {inputFields.map(field=><label key={field.key}>
          <span>{field.label}</span>
          {field.rows?<textarea aria-label={field.label} rows={field.rows} value={draft[field.key]} maxLength={field.key==="objective"?1200:1600}
            placeholder={field.hint??""} onChange={e=>update(field.key,e.target.value)}/>:
            <input aria-label={field.label} value={draft[field.key]} maxLength={field.key==="title"?180:field.key==="institution"?160:120}
              placeholder={field.label} onChange={e=>update(field.key,e.target.value)}/>}
        </label>)}
      </div>
      <div className="pm-ng-coursework-actions">
        <button type="button" onClick={print}><Printer size={16}/> Print / Save as PDF</button>
        <span role="status">{saved?"Saved in this project · Included in project export":"Unable to save · Export your work before leaving"}</span>
      </div>
    </aside>
    <div className="pm-ng-coursework-scroll">
      <div className="pm-ng-coursework-paper" aria-label="Coursework report preview">
        <div className="pm-ng-report-eyebrow"><FileText size={14}/> PARAMYRA · MATHEMATICAL MODELLING</div>
        <div className="pm-ng-report-cover">
          <p>{draft.institution||"Institution"}</p>
          <small>COURSEWORK REPORT</small>
          <h2>{draft.title}</h2>
          <div className="pm-ng-report-authors"><span>Student: {draft.student||"—"}</span><span>Supervisor: {draft.supervisor||"—"}</span></div>
          <div className="pm-ng-report-date">{reportDate}</div>
        </div>
        <section><h3>1. Research objective</h3><p>{draft.objective||"Describe the research objective using the form on the left."}</p></section>
        <section><h3>2. Mathematical model</h3>
          <p>Model: {graph.title}. Nodes: {graph.nodes.length}; directed connections: {graph.edges.length}. This graph uses deterministic numerical operations.</p>
          <GraphFigure graph={graph}/>
          <p className="pm-ng-report-caption">Figure 1 — mathematical node graph and its connections.</p>
          <div className="pm-ng-report-formulas">
            {formulas.length?formulas.map(({property,expression})=><div key={property}><span>{property}</span><code>{expression}</code></div>):<p>No output properties have been defined.</p>}
          </div>
        </section>
        <section><h3>3. Methodology</h3><p>{draft.method||"Describe your methodology using the form on the left."}</p></section>
        <section><h3>4. Computational results</h3>
          <p>Model snapshot at t = {time.toFixed(2)} s. These values are computed from the current graph, not manually entered measurements.</p>
          {error?<p className="pm-ng-report-error" role="alert">Computation error: {error}</p>:null}
          <table><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>
            {Object.entries(outputs).map(([property,value])=><tr key={property}><td>{property}</td><td>{value.toFixed(4)}</td></tr>)}
            {!Object.keys(outputs).length?<tr><td colSpan={2}>No connected outputs</td></tr>:null}
          </tbody></table>
          <div className="pm-ng-report-scene" aria-label="Coursework model visualization"><SceneCanvas scene={scene} time={time} seekVersion={time} playing={false}/></div>
          <p className="pm-ng-report-caption">Figure 2 — mathematical model visualization at t = {time.toFixed(2)} s.</p>
        </section>
        <section><h3>5. Conclusions</h3><p>{draft.conclusion||"Summarize the findings using the form on the left."}</p></section>
        <div className="pm-ng-report-endnote">Paramyra Studio · Results computed locally · {reportDate}</div>
      </div>
      <div className="pm-ng-coursework-hint"><Download size={14}/> Select “Print / Save as PDF” and choose “Save as PDF” in your browser.</div>
    </div>
  </div>;
}

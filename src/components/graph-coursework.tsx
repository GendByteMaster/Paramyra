"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Download, FileText, Printer } from "lucide-react";
import { SceneCanvas } from "./scene-canvas";
import { courseworkFormulas, readCourseworkDraft, saveCourseworkDraft, type CourseworkDraft } from "@/core/graph/coursework";
import type { NodeGraph } from "@/core/graph/model";
import type { MathDocument } from "@/core/document/schema";

type Props = {
  graph: NodeGraph;
  scene: MathDocument;
  time: number;
  outputs: Readonly<Record<string, number>>;
  error: string | null;
};
type DraftKey = Exclude<keyof CourseworkDraft, "version">;

const inputFields: readonly {key:DraftKey; label:string; rows?:number; hint?:string}[] = [
  {key:"institution",label:"Учебное заведение"},
  {key:"student",label:"Студент"},
  {key:"supervisor",label:"Руководитель"},
  {key:"title",label:"Тема курсовой"},
  {key:"objective",label:"Цель работы",rows:3,hint:"Что исследуется и почему"},
  {key:"method",label:"Методика исследования",rows:4,hint:"Описание выбранной модели и расчётов"},
  {key:"conclusion",label:"Выводы",rows:4,hint:"Итоги и наблюдения"},
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
  return <svg className="pm-ng-coursework-diagram" role="img" aria-label="Схема математических узлов" viewBox="0 0 900 330" preserveAspectRatio="xMidYMid meet">
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

export function GraphCoursework({graph,scene,time,outputs,error}:Props){
  const [draft,setDraft]=useState(()=>readCourseworkDraft(graph));
  const [saved,setSaved]=useState(true);
  const formulas=useMemo(()=>courseworkFormulas(graph),[graph]);
  const update=(key:DraftKey,value:string)=>{
    setDraft(old=>({...old,[key]:value}));
    setSaved(false);
  };
  useEffect(()=>{
    setSaved(saveCourseworkDraft(graph.id,draft));
  },[graph.id,draft]);
  const reportDate=useMemo(()=>new Date().toLocaleDateString("ru-RU"),[]);
  const print=()=>window.print();

  return <div className="pm-ng-coursework-layout" aria-label="Coursework workspace">
    <aside className="pm-ng-coursework-settings" aria-label="Настройки курсовой">
      <div className="pm-ng-coursework-settings-head">
        <BookOpen size={19}/>
        <div><strong>Курсовая работа</strong><span>Отдельный режим оформления отчёта</span></div>
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
        <button type="button" onClick={print}><Printer size={16}/> Печать / сохранить PDF</button>
        <span role="status">{saved?"Черновик сохранён локально":"Не удалось сохранить черновик"}</span>
      </div>
    </aside>
    <div className="pm-ng-coursework-scroll">
      <div className="pm-ng-coursework-paper" aria-label="Предпросмотр курсовой работы">
        <div className="pm-ng-report-eyebrow"><FileText size={14}/> PARAMYRA · МАТЕМАТИЧЕСКОЕ МОДЕЛИРОВАНИЕ</div>
        <div className="pm-ng-report-cover">
          <p>{draft.institution||"Учебное заведение"}</p>
          <small>КУРСОВАЯ РАБОТА</small>
          <h2>{draft.title}</h2>
          <div className="pm-ng-report-authors"><span>Выполнил: {draft.student||"—"}</span><span>Руководитель: {draft.supervisor||"—"}</span></div>
          <div className="pm-ng-report-date">{reportDate}</div>
        </div>
        <section><h3>1. Цель работы</h3><p>{draft.objective||"Заполните цель работы в панели слева."}</p></section>
        <section><h3>2. Математическая модель</h3>
          <p>Схема: {graph.title}. Узлов: {graph.nodes.length}; направленных связей: {graph.edges.length}. Граф использует детерминированные численные операции.</p>
          <GraphFigure graph={graph}/>
          <div className="pm-ng-report-formulas">
            {formulas.length?formulas.map(({property,expression})=><div key={property}><span>{property}</span><code>{expression}</code></div>):<p>Выходные свойства ещё не заданы.</p>}
          </div>
        </section>
        <section><h3>3. Методика исследования</h3><p>{draft.method||"Заполните описание методики в панели слева."}</p></section>
        <section><h3>4. Результаты вычислений</h3>
          <p>Снимок состояния модели в момент времени t = {time.toFixed(2)} с. Значения являются результатом текущего графа, а не вручную введёнными измерениями.</p>
          {error?<p className="pm-ng-report-error" role="alert">Ошибка вычисления: {error}</p>:null}
          <table><thead><tr><th>Параметр</th><th>Значение</th></tr></thead><tbody>
            {Object.entries(outputs).map(([property,value])=><tr key={property}><td>{property}</td><td>{value.toFixed(4)}</td></tr>)}
            {!Object.keys(outputs).length?<tr><td colSpan={2}>Нет подключённых выходов</td></tr>:null}
          </tbody></table>
          <div className="pm-ng-report-scene" aria-label="Визуализация модели для курсовой"><SceneCanvas scene={scene} time={time} seekVersion={time} playing={false}/></div>
          <p className="pm-ng-report-caption">Рисунок 2 — визуализация математической модели при t = {time.toFixed(2)} с.</p>
        </section>
        <section><h3>5. Выводы</h3><p>{draft.conclusion||"Заполните выводы в панели слева."}</p></section>
        <div className="pm-ng-report-endnote">Paramyra Studio · Результаты вычислены локально · {reportDate}</div>
      </div>
      <div className="pm-ng-coursework-hint"><Download size={14}/> Используйте «Печать / сохранить PDF» и выберите «Сохранить как PDF» в браузере.</div>
    </div>
  </div>;
}

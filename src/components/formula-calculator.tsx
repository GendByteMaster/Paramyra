"use client";
import {useRef,useState} from "react";
import {Check,Copy,Delete,History,RotateCcw,ChartNoAxesCombined,Trash2} from "lucide-react";
import {calculateExpression,formatCalculatorNumber} from "@/core/math/calculator";
import {addCalculatorHistory,CALCULATOR_HISTORY_KEY,parseCalculatorHistory,type CalculatorHistoryItem} from "@/core/math/calculator-history";
import {defaultFormula,validateFormula,type Formula} from "@/core/math/formula";

type Props={formula:Formula;onPlot?:(expression:string)=>boolean};
type Key={label:string;insert:string;kind?:"function"|"operator"|"utility"|"equals"};
const keys:Key[][]=[
  [{label:"7",insert:"7"},{label:"8",insert:"8"},{label:"9",insert:"9"},{label:"÷",insert:"/",kind:"operator"},{label:"sin",insert:"sin(",kind:"function"}],
  [{label:"4",insert:"4"},{label:"5",insert:"5"},{label:"6",insert:"6"},{label:"×",insert:"*",kind:"operator"},{label:"cos",insert:"cos(",kind:"function"}],
  [{label:"1",insert:"1"},{label:"2",insert:"2"},{label:"3",insert:"3"},{label:"−",insert:"-",kind:"operator"},{label:"√",insert:"sqrt(",kind:"function"}],
  [{label:"0",insert:"0"},{label:".",insert:"."},{label:"(",insert:"("},{label:")",insert:")"},{label:"+",insert:"+",kind:"operator"}],
  [{label:"π",insert:"pi"},{label:"e",insert:"e"},{label:"^",insert:"^",kind:"operator"},{label:"⌫",insert:"",kind:"utility"},{label:"C",insert:"",kind:"utility"}],
  [{label:"ANS",insert:"ans",kind:"function"},{label:"%",insert:"%",kind:"operator"},{label:"x²",insert:"^2",kind:"function"},{label:"n!",insert:"!",kind:"function"},{label:"=",insert:"",kind:"equals"}],
];
const extra:Key[]=[{label:"tan",insert:"tan(",kind:"function"},{label:"ln",insert:"ln(",kind:"function"},{label:"log",insert:"log(",kind:"function"},{label:"exp",insert:"exp(",kind:"function"},{label:"EE",insert:"e",kind:"function"}];

export function FormulaCalculator({formula,onPlot}:Props){
  const [expression,setExpression]=useState("2+2");
  const [x,setX]=useState("0"),[t,setT]=useState("0");
  const [unit,setUnit]=useState<"rad"|"deg">("rad");
  const [history,setHistory]=useState<CalculatorHistoryItem[]>(()=>{
    try{return parseCalculatorHistory(window.localStorage.getItem(CALCULATOR_HISTORY_KEY));}
    catch{return [];}
  });
  const [historyOpen,setHistoryOpen]=useState(false),[expanded,setExpanded]=useState(false);
  const [copied,setCopied]=useState(false),[message,setMessage]=useState("");
  const input=useRef<HTMLInputElement>(null);
  const ans=history[0]?.value??0;
  const result=calculateExpression(expression,{
    a:formula.a,b:formula.b,c:formula.c,
    x:x.trim()===""?NaN:Number(x),t:t.trim()===""?NaN:Number(t),
  },{ans,angleUnit:unit});
  const plotSource=expression.replace(/\bans\b/g,"("+formatCalculatorNumber(ans)+")");
  const plotError=validateFormula({...defaultFormula("explicit"),a:formula.a,b:formula.b,c:formula.c,exprY:plotSource});
  const degTrig=unit==="deg"&&/\b(?:sin|cos|tan|asin|acos|atan)\s*\(/.test(expression);
  const plotAllowed=!plotError&&!degTrig;
  const commit=()=>{
    if(!result.ok)return;
    // Sample a timestamp only from the user-triggered Equals / Enter action.
    // eslint-disable-next-line react-hooks/purity
    const row:CalculatorHistoryItem={expression,display:result.display,value:result.value,unit,at:Date.now()};
    const next=addCalculatorHistory(history,row);
    setHistory(next);
    try{localStorage.setItem(CALCULATOR_HISTORY_KEY,JSON.stringify(next));}catch{/* storage optional */}
    setMessage("");
  };
  const insert=(key:Key)=>{
    if(key.label==="="){commit();return;}
    const target=input.current;
    const start=target?.selectionStart??expression.length,end=target?.selectionEnd??expression.length;
    if(key.label==="C"){setExpression("");setMessage("");return;}
    let next=expression,caret=start;
    if(key.label==="⌫"){
      const from=start===end?Math.max(0,start-1):start;
      next=expression.slice(0,from)+expression.slice(end);caret=from;
    }else{
      next=expression.slice(0,start)+key.insert+expression.slice(end);caret=start+key.insert.length;
    }
    if(next.length>160)return;
    setExpression(next);setCopied(false);setMessage("");
    requestAnimationFrame(()=>{
      if(!input.current)return;
      if(!window.matchMedia("(max-width:760px)").matches)input.current.focus();
      input.current.setSelectionRange(caret,caret);
    });
  };
  const copy=async()=>{
    if(!result.ok)return;
    try{await navigator.clipboard.writeText(result.display);setCopied(true);}
    catch{setMessage("Clipboard unavailable.");}
  };
  const useResult=()=>{if(result.ok){commit();setExpression(result.display);setCopied(false);}};
  const plot=()=>{if(plotAllowed&&onPlot){setMessage(onPlot(plotSource)?"Graph layer added. Use Undo to revert.":"Cannot add graph layer.");}};
  const clearHistory=()=>{
    setHistory([]);
    try{localStorage.removeItem(CALCULATOR_HISTORY_KEY);}catch{/* storage optional */}
  };
  return <div className="pm-calculator" role="group" aria-label="Mathematical calculator">
    <div className="pm-calculator-topline">
      <span>Scientific calculator</span>
      <div className="pm-calc-header-controls">
        <button type="button" className="pm-calc-unit" aria-label="Angle unit" aria-pressed={unit==="deg"} onClick={()=>setUnit(v=>v==="rad"?"deg":"rad")}>{unit.toUpperCase()}</button>
        <button type="button" className="pm-calc-history-trigger" aria-expanded={historyOpen} onClick={()=>setHistoryOpen(v=>!v)}><History size={14}/> History {history.length?"("+history.length+")":""}</button>
        <button type="button" className="pm-calc-from-graph" onClick={()=>{setExpression(formula.exprY);setCopied(false);}}><RotateCcw size={13}/> Use graph equation</button>
      </div>
    </div>
    <label className="pm-formula-field" htmlFor="pm-calc-expression">Expression
      <input id="pm-calc-expression" ref={input} type="text" autoComplete="off"
        className="pm-formula-expression" spellCheck={false} maxLength={160}
        aria-label="Calculator expression" aria-invalid={!result.ok}
        value={expression} placeholder="e.g. sin(pi/2)+2^3"
        onChange={e=>{setExpression(e.target.value);setCopied(false);setMessage("");}}
        onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();commit();}}}/>
    </label>
    <div className="pm-calc-eval-inputs">
      <label>x / u / θ<input type="number" step="any" aria-label="Calculator x value" value={x} onChange={e=>setX(e.target.value)}/></label>
      <label>t<input type="number" step="any" aria-label="Calculator t value" value={t} onChange={e=>setT(e.target.value)}/></label>
    </div>
    <div className="pm-calculator-display" aria-live="polite" aria-atomic="true">
      <span className="pm-calc-result-label">RESULT <small>{unit.toUpperCase()}</small></span>
      {result.ok?<output aria-label="Calculator result" className="pm-calc-value">{result.display}</output>:
        <p role="status" className="pm-calc-error">{result.error}</p>}
    </div>
    <div className="pm-calc-keypad" role="group" aria-label="Calculator keypad">
      {keys.flat().map((key,index)=><button key={index} type="button"
        aria-label={key.label==="⌫"?"Backspace":key.label==="C"?"Clear calculator":key.label==="="?"Equals":key.label}
        className={"pm-calc-key"+(key.kind?" pm-calc-"+key.kind:"")} onClick={()=>insert(key)}
        disabled={key.label==="="&&!result.ok}>{key.label==="⌫"?<Delete size={16}/>:key.label}</button>)}
      {expanded&&extra.map((key,index)=><button key={"extra-"+index} type="button" className="pm-calc-key pm-calc-function" aria-label={key.label} onClick={()=>insert(key)}>{key.label}</button>)}
    </div>
    <div className="pm-calc-actions">
      <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?"Less functions":"More functions"}</button>
      <button type="button" disabled={!result.ok} onClick={useResult}>= Use result</button>
      <button type="button" disabled={!result.ok} onClick={copy}>{copied?<Check size={14}/>:<Copy size={14}/>} {copied?"Copied":"Copy result"}</button>
      <button type="button" className="pm-calc-plot" disabled={!plotAllowed||!onPlot}
        title={degTrig?"Switch to RAD before plotting trig expressions":plotError??""}
        onClick={plot}><ChartNoAxesCombined size={14}/> Plot graph</button>
    </div>
    {message&&<p className="pm-calc-action-message" role="status">{message}</p>}
    {historyOpen&&<section className="pm-calc-history" aria-label="Calculator history">
      <div className="pm-calc-history-heading"><strong>Recent results</strong><button type="button" onClick={clearHistory}><Trash2 size={13}/> Clear history</button></div>
      {history.length===0?<p className="pm-formula-help">Press = or Enter to save a calculation.</p>:
        <div className="pm-calc-history-items">{history.map((row,index)=><button type="button" key={row.at+"-"+index}
          aria-label={"Recall "+row.expression} onClick={()=>{setExpression(row.expression);setUnit(row.unit);setCopied(false);}}>
          <code>{row.expression}</code><strong>= {row.display}</strong><small>{row.unit.toUpperCase()}</small>
        </button>)}</div>}
    </section>}
    <details className="pm-calc-reference"><summary>Functions and variables</summary>
      <p className="pm-formula-help">sin, cos, tan, sqrt, abs, ln, log, exp, atan. DEG/RAD applies to trigonometry.
        Percent (50% = 0.5), factorial (0–9!), ANS and scientific notation (1e-3).
        Variables: a, b, c, x/u/theta and t. Plot uses radians and y=f(x,t).
        Maximum numeric result: 1e6. No JavaScript execution.</p>
    </details>
  </div>;
}

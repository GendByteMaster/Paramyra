"use client";

import { useRef, useState } from "react";
import { Check, Copy, Delete, RotateCcw } from "lucide-react";
import { calculateExpression } from "@/core/math/calculator";
import type { Formula } from "@/core/math/formula";

type CalculatorProps = { formula: Formula };
type Entry = { label: string; insert: string; kind?: "function" | "operator" | "utility" };
const keys: Entry[][] = [
  [{label:"7",insert:"7"},{label:"8",insert:"8"},{label:"9",insert:"9"},{label:"÷",insert:"/",kind:"operator"},{label:"sin",insert:"sin(",kind:"function"}],
  [{label:"4",insert:"4"},{label:"5",insert:"5"},{label:"6",insert:"6"},{label:"×",insert:"*",kind:"operator"},{label:"cos",insert:"cos(",kind:"function"}],
  [{label:"1",insert:"1"},{label:"2",insert:"2"},{label:"3",insert:"3"},{label:"−",insert:"-",kind:"operator"},{label:"√",insert:"sqrt(",kind:"function"}],
  [{label:"0",insert:"0"},{label:".",insert:"."},{label:"(",insert:"("},{label:")",insert:")"},{label:"+",insert:"+",kind:"operator"}],
  [{label:"π",insert:"pi"},{label:"e",insert:"e"},{label:"^",insert:"^",kind:"operator"},{label:"⌫",insert:"",kind:"utility"},{label:"C",insert:"",kind:"utility"}],
];

export function FormulaCalculator({formula}: CalculatorProps) {
  const [expression,setExpression] = useState("2+2");
  const [x,setX] = useState("0");
  const [t,setT] = useState("0");
  const [copied,setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const xNumber = Number(x), tNumber = Number(t);
  const calculated = calculateExpression(expression,{
    a:formula.a,b:formula.b,c:formula.c,
    x:x.trim()===""?NaN:xNumber,
    t:t.trim()===""?NaN:tNumber,
  });

  const insert = (key: Entry) => {
    const target=input.current;
    const start=target?.selectionStart??expression.length;
    const end=target?.selectionEnd??expression.length;
    if(key.label==="C") {
      setExpression("");
      target?.focus();
      return;
    }
    let next = expression, caret = start;
    if(key.label==="⌫") {
      const from=start===end?Math.max(0,start-1):start;
      next=expression.slice(0,from)+expression.slice(end);
      caret=from;
    } else {
      next=expression.slice(0,start)+key.insert+expression.slice(end);
      caret=start+key.insert.length;
    }
    if(next.length>160)return;
    setExpression(next);
    setCopied(false);
    requestAnimationFrame(()=>{
      if (!input.current) return;
      input.current.focus();
      input.current.setSelectionRange(caret,caret);
    });
  };
  const copy = async () => {
    if(!calculated.ok)return;
    try {
      await navigator.clipboard.writeText(calculated.display);
      setCopied(true);
    } catch { setCopied(false); }
  };
  return <div className="pm-calculator" role="group" aria-label="Mathematical calculator">
    <div className="pm-calculator-topline">
      <span>Scientific calculator</span>
      <button type="button" className="pm-calc-from-graph" onClick={()=>{setExpression(formula.exprY);setCopied(false);}}>
        <RotateCcw size={13}/> Use graph equation
      </button>
    </div>
    <label className="pm-formula-field" htmlFor="pm-calc-expression">Expression
      <input id="pm-calc-expression" ref={input} type="text" autoComplete="off"
        className="pm-formula-expression" spellCheck={false}
        value={expression} maxLength={160} aria-label="Calculator expression"
        aria-invalid={!calculated.ok} placeholder="e.g. sin(pi/2)+2^3"
        onChange={event=>{setExpression(event.target.value);setCopied(false);}}
      />
    </label>
    <div className="pm-calc-eval-inputs">
      <label>x / u / θ
        <input type="number" aria-label="Calculator x value" value={x} step="any"
          onChange={event=>setX(event.target.value)}/>
      </label>
      <label>t
        <input type="number" aria-label="Calculator t value" value={t} step="any"
          onChange={event=>setT(event.target.value)}/>
      </label>
    </div>
    <div className="pm-calculator-display" aria-live="polite" aria-atomic="true">
      <span className="pm-calc-result-label">RESULT</span>
      {calculated.ok
        ? <output aria-label="Calculator result" className="pm-calc-value">{calculated.display}</output>
        : <p role="status" className="pm-calc-error">{calculated.error}</p>}
    </div>
    <div className="pm-calc-keypad" role="group" aria-label="Calculator keypad">
      {keys.flat().map((key,index)=><button key={index} type="button"
        aria-label={key.label==="⌫"?"Backspace":key.label==="C"?"Clear calculator":key.label}
        className={"pm-calc-key"+(key.kind?" pm-calc-"+key.kind:"")}
        onClick={()=>insert(key)}>{key.label==="⌫"?<Delete size={16}/>:key.label}</button>)}
    </div>
    <div className="pm-calc-actions">
      <button type="button" disabled={!calculated.ok} onClick={()=>{
        if(calculated.ok){setExpression(calculated.display);setCopied(false);}
      }}>= Use result</button>
      <button type="button" disabled={!calculated.ok} onClick={copy}>
        {copied?<Check size={14}/>:<Copy size={14}/>} {copied?"Copied":"Copy result"}
      </button>
    </div>
    <p className="pm-formula-help">
      Functions: sin, cos, tan, sqrt, abs, ln, log, exp, atan. Constants: pi, e.
      Variables: a, b, c (the layer sliders), x/u/theta and t (above).
      Angle inputs use radians. No JavaScript execution.
    </p>
  </div>;
}

"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { defaultFormula, validateFormula, type Formula, type FormulaMode } from "@/core/math/formula";

type Props = { layerId: string; formula: Formula; onChange: (next: Formula) => void; onOpenCalculator: () => void };
export function FormulaEditor({ layerId, formula, onChange, onOpenCalculator }: Props) {
  const [editing, setEditing] = useState({ layerId, committed: formula, draft: formula });
  // Sync Undo/Redo and selection without resetting an incomplete expression on every keystroke.
  if (editing.layerId !== layerId || editing.committed !== formula) {
    setEditing({ layerId, committed: formula, draft: formula });
  }
  const draft = editing.draft;
  const error = validateFormula(draft);
  const propose = (partial: Partial<Formula>) => {
    const next = { ...draft, ...partial };
    setEditing(previous => ({ ...previous, draft: next }));
    if (!validateFormula(next)) onChange(next);
  };
  const chooseMode = (mode: FormulaMode) => {
    const next = defaultFormula(mode);
    setEditing(previous => ({ ...previous, draft: next }));
    onChange(next);
  };
  const domain = (key: "min" | "max", text: string) => {
    if (text.trim() === "" || !Number.isFinite(Number(text))) return;
    propose({ [key]: Number(text) });
  };
  return <section className="pm-inspector-section pm-formula-editor" aria-label="Formula editor">
    <div className="pm-inspector-sectionhead"><span>02 / FORMULA EDITOR</span><span className="pm-formula-type">f(x)</span></div>
    <button type="button" className="pm-formula-launch" aria-label="Open calculator from Formula Editor" aria-haspopup="dialog" aria-controls="pm-scientific-calculator-window" onClick={onOpenCalculator}>
      <Calculator size={16}/> Open Calculator <span>↗</span>
    </button>
    <label className="pm-formula-field">Curve type
      <select aria-label="Formula mode" value={draft.mode} onChange={e=>chooseMode(e.target.value as FormulaMode)}>
        <option value="explicit">Explicit · y = f(x,t)</option>
        <option value="parametric">Parametric · x(u), y(u)</option>
        <option value="polar">Polar · r(θ,t)</option>
      </select>
    </label>
    {draft.mode === "parametric" && <label className="pm-formula-field">
      <span>X(u,t)</span>
      <input className="pm-formula-expression" type="text" spellCheck={false} maxLength={160}
        aria-label="Formula X expression" aria-invalid={!!error}
        value={draft.exprX} onChange={e=>propose({exprX:e.target.value})}/>
    </label>}
    <label className="pm-formula-field">
      <span>{draft.mode==="explicit"?"Y(x,t)":draft.mode==="polar"?"R(theta,t)":"Y(u,t)"}</span>
      <input className="pm-formula-expression" type="text" spellCheck={false} maxLength={160}
        aria-label="Formula Y expression" aria-invalid={!!error}
        value={draft.exprY} onChange={e=>propose({exprY:e.target.value})}/>
    </label>
    <div className="pm-formula-domain">
      <label>Domain min
        <input type="number" step=".1" min={-20} max={20} aria-label="Formula domain min"
          value={draft.min} onChange={e=>domain("min",e.target.value)}/>
      </label>
      <label>Domain max
        <input type="number" step=".1" min={-20} max={20} aria-label="Formula domain max"
          value={draft.max} onChange={e=>domain("max",e.target.value)}/>
      </label>
    </div>
    <div className="pm-formula-variables" aria-label="Formula parameters">
      {(["a","b","c"] as const).map(name=><label key={name}>
        <span>{name.toUpperCase()} <output>{draft[name].toFixed(2)}</output></span>
        <input type="range" aria-label={"Formula parameter "+name} min={-10} max={10} step=".1"
          value={draft[name]} onChange={e=>propose({[name]:e.target.valueAsNumber})}/>
      </label>)}
    </div>
    <div className="pm-formula-feedback" role="status" aria-live="polite" data-valid={!error}>
      {error ? "Check expression: "+error : "Valid expression · Live preview"}
    </div>
    <p className="pm-formula-help">Functions: sin, cos, tan, sqrt, abs, exp, ln, log, floor, ceil, asin, acos, atan.
      Operators: + − * / ^. Constants: pi, e. Animation variable: t (seconds).
      Use explicit * for multiplication. No JavaScript execution.</p>
  </section>;
}

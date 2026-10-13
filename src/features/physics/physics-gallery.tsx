import Link from "next/link";
import { ArrowRight, Check, MoveUpRight, Waves } from "lucide-react";
import { PHYSICS_EXPERIMENTS } from "@/core/physics/experiments/catalog";

const marks = { projectile: MoveUpRight, spring: Waves } as const;

export function PhysicsGallery() {
  return <div className="px-gallery">
    <header className="px-page-heading"><div><span className="px-eyebrow">CURATED MODELS · VERSION 1</span><h1>Physics Gallery</h1><p>Begin with a well-defined system. Each model states its assumptions, governing equations, and quantities you can measure.</p></div><span className="px-count-badge">{PHYSICS_EXPERIMENTS.length} EXPERIMENTS</span></header>
    <div className="px-gallery-list">
      {PHYSICS_EXPERIMENTS.map((experiment, index) => {
        const Icon = marks[experiment.id];
        const category = experiment.category.toUpperCase();
        return <article className="px-gallery-card" key={experiment.id}>
          <div className={`px-gallery-visual px-visual-${experiment.id}`} aria-hidden="true">
            <div className="px-visual-label"><span>{category}</span><span>{experiment.complexity.toUpperCase()} · SCHEMATIC {String(index + 1).padStart(2, "0")}</span></div>
            {experiment.id === "projectile" ? <svg viewBox="0 0 420 245"><path d="M39 218 C101 126 157 58 218 52 C283 45 344 102 387 217"/><circle cx="39" cy="218" r="4"/><circle cx="218" cy="52" r="4"/><path className="px-vector" d="M218 52l0-38m0 0-5 10m5-10 5 10"/></svg> : <svg viewBox="0 0 420 245"><path className="px-spring-path" d="M0 132h55l12-23 14 46 14-46 14 46 14-46 14 46 14-46 14 46 14-46 14 46 14-23h35"/><rect x="245" y="93" width="67" height="77" rx="9"/><path className="px-spring-axis" d="M25 205h365m-365-4v8m73-8v8m73-8v8m73-8v8m73-8v8m73-8v8"/></svg>}
            <div className="px-visual-equation">{experiment.governingEquations[0]}</div>
          </div>
          <div className="px-gallery-content">
            <div className="px-gallery-title"><span className="px-card-icon"><Icon size={20}/></span><div><span className="px-eyebrow">{category} · {experiment.complexity.toUpperCase()}</span><h2>{experiment.title}</h2></div></div>
            <p className="px-gallery-summary">{experiment.summary}</p>
            <div className="px-model-facts">
              <section><h3>System</h3><p>{experiment.phenomenon}</p></section>
              <section><h3>Model assumptions</h3><ul>{experiment.assumptions.map(item => <li key={item}><Check size={13}/>{item}</li>)}</ul></section>
              <section><h3>Excluded effects</h3><ul>{experiment.excludedEffects.map(item => <li key={item}><Check size={13}/>{item}</li>)}</ul></section>
            </div>
            <div className="px-equation-list"><span className="px-eyebrow">GOVERNING EQUATIONS</span>{experiment.governingEquations.map(equation => <code key={equation}>{equation}</code>)}</div>
            <div className="px-observables"><span className="px-eyebrow">MEASURABLE QUANTITIES</span><p>{experiment.observables.map(item => item.replaceAll(" ", " · ")).join(" · ")} <span>· SI units</span></p></div>
            <div className="px-range-note"><span>NUMERICAL SAFETY</span><p>Model parameters are bounded and validated before every run. The fixed-step solver checks its stability range and caps simulation work.</p></div>
            <Link className="px-button px-button-primary px-gallery-action" href={`/physics/playground?experiment=${experiment.id}`}>Open experiment <ArrowRight size={16}/></Link>
          </div>
        </article>;
      })}
    </div>
    <p className="px-gallery-footnote">Every experiment starts paused. Adjust conditions, then run the deterministic simulation when you are ready.</p>
  </div>;
}

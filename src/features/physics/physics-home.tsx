import Link from "next/link";
import { ArrowRight, Atom, Beaker, MoveUpRight, Waves } from "lucide-react";
import { PHYSICS_EXPERIMENTS } from "@/core/physics/experiments/catalog";
import { createDefaultProjectilePreview } from "@/core/physics/experiments/preview";
import type { SimulationFrame } from "@/core/physics/engine/simulation";
import type { PhysicsProject } from "@/core/physics/model/schema";

const marks = { projectile: MoveUpRight, spring: Waves } as const;

type Position = Readonly<{ x: number; y: number }>;

function trajectoryPoint(
  frame: SimulationFrame,
  bounds: Readonly<{ minX: number; maxX: number; minY: number; maxY: number }>,
): Position {
  const xSpan = Math.max(bounds.maxX - bounds.minX, 1e-12);
  const ySpan = Math.max(bounds.maxY - bounds.minY, 1e-12);
  const x = 56 + ((frame.position.x - bounds.minX) / xSpan) * 478;
  const y = 300 - ((frame.position.y - bounds.minY) / ySpan) * 264;
  return { x, y };
}

export function PhysicsHome() {
  const preview = createDefaultProjectilePreview();
  const project: PhysicsProject = preview.project;
  if (project.model.kind !== "projectile") throw new TypeError("Home trajectory preview requires the projectile model");
  const first = preview.frames[0];
  const last = preview.frames[preview.frames.length - 1];
  const minX = preview.frames.reduce((value, frame) => Math.min(value, frame.position.x), first.position.x);
  const maxX = preview.frames.reduce((value, frame) => Math.max(value, frame.position.x), first.position.x);
  const minY = preview.frames.reduce((value, frame) => Math.min(value, frame.position.y), first.position.y);
  const maxY = preview.frames.reduce((value, frame) => Math.max(value, frame.position.y), first.position.y);
  const bounds = { minX, maxX, minY, maxY };
  const trajectory = preview.frames.map((frame, index) => {
    const point = trajectoryPoint(frame, bounds);
    return `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(" ");
  const launch = trajectoryPoint(first, bounds);
  const apex = trajectoryPoint(preview.apex, bounds);
  const impact = trajectoryPoint(last, bounds);

  return <div className="px-home">
    <section className="px-hero" aria-labelledby="physics-title">
      <div className="px-hero-copy">
        <span className="px-eyebrow"><span className="px-eyebrow-line" /> PHYSICS WORKSPACE</span>
        <h1 id="physics-title">Make motion<br /><span>measurable.</span></h1>
        <p>Build an intuition for physical systems through precise, inspectable simulations. Change a parameter, run the model, and follow every quantity in SI units.</p>
        <div className="px-hero-actions">
          <Link className="px-button px-button-primary" href="/physics/gallery">Explore experiments <ArrowRight size={16} /></Link>
          <Link className="px-button px-button-secondary" href="/physics/studio"><Atom size={16} /> Open Studio</Link>
        </div>
        <div className="px-hero-facts" aria-label="Platform principles">
          <span><i aria-hidden="true">01</i> SI-native models</span>
          <span><i aria-hidden="true">02</i> Fixed-step solver</span>
          <span><i aria-hidden="true">03</i> Reproducible runs</span>
        </div>
      </div>
      <div className="px-hero-diagram" aria-label="Computed default projectile trajectory">
        <div className="px-diagram-head"><span><span className="px-preview-dot" /> COMPUTED SOLVER PREVIEW</span><span>PAUSED · {preview.stepCount} STEPS</span></div>
        <div className="px-diagram">
          <svg viewBox="0 0 560 350" role="img" aria-label={`Default ${project.model.kind} trajectory computed by the ${project.simulation.integrator} solver`}>
            <defs><linearGradient id="px-trajectory" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#7de1d0" /><stop offset="1" stopColor="#7ba9ff" /></linearGradient></defs>
            {[72, 138, 204, 270, 336, 402, 468, 534].map(x => <line key={`v${x}`} x1={x} x2={x} y1="18" y2="316" className="px-gridline" />)}
            {[50, 116, 182, 248, 314].map(y => <line key={`h${y}`} x1="40" x2="544" y1={y} y2={y} className="px-gridline" />)}
            <line x1="40" x2="544" y1="314" y2="314" className="px-axis" />
            <line x1="42" x2="42" y1="20" y2="316" className="px-axis" />
            <path d={trajectory} className="px-trajectory" />
            <circle cx={launch.x} cy={launch.y} r="5" className="px-point" />
            <circle cx={apex.x} cy={apex.y} r="5" className="px-point" />
            <circle cx={impact.x} cy={impact.y} r="5" className="px-point" />
            <text x="483" y="338" className="px-axis-label">x · m</text><text x="11" y="38" className="px-axis-label">y · m</text>
          </svg>
          <div className="px-diagram-callout px-callout-peak"><span>APEX</span><strong>{preview.apex.position.y.toFixed(2)} m · t = {preview.apex.time.toFixed(2)} s</strong></div>
          <div className="px-diagram-callout px-callout-speed"><span>LAUNCH SPEED</span><strong>{preview.launchSpeed.toFixed(2)} m/s</strong></div>
        </div>
        <div className="px-diagram-foot">
          <span>INITIAL STATE <strong>t = {first.time.toFixed(2)} s · PAUSED</strong></span>
          <span>GRAVITY <strong>{project.model.parameters.gravity.toFixed(2)} m/s²</strong></span>
          <span>FLIGHT TIME <strong>{preview.flightTime.toFixed(2)} s</strong></span>
        </div>
      </div>
    </section>

    <section className="px-home-section" aria-labelledby="featured-title">
      <div className="px-section-heading"><div><span className="px-eyebrow">START WITH A MODEL</span><h2 id="featured-title">{PHYSICS_EXPERIMENTS.length} experiments. Real physics.</h2></div><Link href="/physics/gallery" className="px-text-link">View gallery <ArrowRight size={15} /></Link></div>
      <div className="px-experiment-grid">
        {PHYSICS_EXPERIMENTS.map(experiment => {
          const Icon = marks[experiment.id];
          return <article key={experiment.id} className="px-experiment-card">
            <div className="px-card-top"><span className="px-card-icon"><Icon size={20} /></span><span className="px-card-tag">{experiment.category.toUpperCase()} · {experiment.complexity.toUpperCase()}</span></div>
            <h3>{experiment.title}</h3><p>{experiment.summary}</p>
            <div className="px-equation">{experiment.governingEquations[0]}</div>
            <Link href={`/physics/playground?experiment=${experiment.id}`} className="px-card-action">Open experiment <ArrowRight size={15} /></Link>
          </article>;
        })}
      </div>
      <aside className="px-platform-note"><Beaker size={18} /><p><strong>From first run to full project.</strong> Playground experiments are temporary. Save to Studio when you want to name, revisit, and document a simulation.</p><Link href="/physics/studio">Browse projects <ArrowRight size={14} /></Link></aside>
    </section>
  </div>;
}

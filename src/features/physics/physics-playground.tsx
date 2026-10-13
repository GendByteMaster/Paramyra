"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Beaker, Check, MoveUpRight, Waves } from "lucide-react";
import { addImportedPhysicsProject, initializePhysicsLibrary, mutatePhysicsLibrary, readPhysicsLibrary } from "@/core/physics/projects/library";
import { createPhysicsProject, type PhysicsProject } from "@/core/physics/model/schema";
import { PhysicsWorkbench } from "@/features/physics/physics-workbench";

type Kind = PhysicsProject["model"]["kind"];
const choices: readonly { kind: Kind; name: string; icon: typeof MoveUpRight; equation: string }[] = [
  { kind: "projectile", name: "Projectile Motion", icon: MoveUpRight, equation: "m dv/dt = mg − b v" },
  { kind: "spring", name: "Mass–Spring Oscillator", icon: Waves, equation: "m ẍ + c ẋ + kx = 0" },
];

export function PhysicsPlayground({ initialKind = "projectile" }: { initialKind?: Kind }) {
  const router = useRouter();
  const [project, setProject] = useState<PhysicsProject>(() => createPhysicsProject(initialKind, `playground-${initialKind}`, 0));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const choose = (kind: Kind) => {
    if (kind === project.model.kind) return;
    if (!window.confirm("Switch to a different experiment? Unsaved Playground parameter changes will be replaced.")) return;
    setProject(createPhysicsProject(kind, `playground-${kind}`, 0));
    setNotice("Experiment changed. This Playground session is still temporary.");
  };

  const saveToStudio = async (snapshot: PhysicsProject) => {
    if (saving) return;
    setSaving(true); setNotice("Preparing the Physics project library…");
    try {
      let read = await readPhysicsLibrary();
      if (read.status === "empty") read = await initializePhysicsLibrary();
      if (read.status !== "ready") {
        setNotice(read.status === "invalid"
          ? "The Physics library is damaged. It was left untouched; use Export project JSON to keep this temporary experiment."
          : "Physics project storage is unavailable. This temporary experiment is still open; use Export project JSON to keep a copy.");
        return;
      }
      const outcome = await mutatePhysicsLibrary(read.record.revision, read.record.library.activeId, current => addImportedPhysicsProject(current, snapshot));
      if (outcome.status !== "saved") {
        setNotice(outcome.status === "conflict"
          ? "The Physics library changed in another tab. Reopen Studio and try Save to Studio again."
          : "The Physics project could not be added. This temporary experiment remains unchanged.");
        return;
      }
      setNotice("Project saved. Opening Physics Studio…");
      router.push("/physics/studio");
    } catch {
      setNotice("Physics storage could not complete this save. The temporary experiment remains open.");
    } finally { setSaving(false); }
  };

  return <div className="px-playground-page">
    <div className="px-experiment-switcher" aria-label="Choose a Playground experiment">
      <div className="px-switcher-title"><span className="px-card-icon"><Beaker size={17}/></span><div><span className="px-eyebrow">TEMPORARY SESSION</span><strong>Choose an experiment</strong></div></div>
      <div className="px-switcher-options" role="group" aria-label="Physics experiments">
        {choices.map(({ kind, name, icon: Icon, equation }) => <button key={kind} type="button" className={project.model.kind === kind ? "is-selected" : ""} aria-pressed={project.model.kind === kind} onClick={() => choose(kind)}>
          <Icon size={16}/><span><strong>{name}</strong><small>{equation}</small></span>{project.model.kind === kind && <Check size={14} aria-hidden="true"/>}
        </button>)}
      </div>
      <Link href="/physics/gallery" className="px-switcher-gallery">Model details <ArrowRight size={14}/></Link>
    </div>
    <PhysicsWorkbench project={project} mode="playground" saveLabel={saving ? "Saving…" : "Save to Studio"} onProjectChange={setProject} onSave={saveToStudio}/>
    {notice && <p className="px-workbench-notice" role="status" aria-live="polite">{notice}</p>}
  </div>;
}

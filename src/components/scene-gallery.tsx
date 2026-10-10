import Link from "next/link";
import { ArrowUpRight, MoveUpRight } from "lucide-react";
import { SceneCanvas } from "./scene-canvas";
import { presets } from "@/core/scenes/presets";

const detail: Record<string, { category: string; equation: string; description: string; tone: string }> = {
  "lissajous": { category: "PARAMETRIC GEOMETRY", equation: "x = A sin(at + δ)", description: "Where frequencies weave motion into extraordinary geometry.", tone: "indigo" },
  "polar-rose": { category: "POLAR MATHEMATICS", equation: "r = a cos(kθ)", description: "Elegant petals hidden inside a single polar equation.", tone: "mint" },
  "wave": { category: "WAVE DYNAMICS", equation: "y = f(x, t)", description: "The endlessly shifting language of harmonics and interference.", tone: "blue" },
};

export function SceneGallery() {
  return (
    <div className="scene-grid">
      {presets.map((scene, index) => (
        <article key={scene.id} className={"scene-card tone-" + detail[scene.id].tone}>
          <div className="scene-art">
            <div className="scene-art-head"><span>NO. 0{index + 1}</span><span className="scene-art-tag">2D / INTERACTIVE</span></div>
            <SceneCanvas scene={scene} playing={false} />
            <span className="scene-art-equation">{detail[scene.id].equation}</span>
          </div>
          <div className="scene-card-content">
            <span className="scene-category">{detail[scene.id].category}</span>
            <h3>{scene.title}</h3>
            <p>{detail[scene.id].description}</p>
            <div className="scene-card-footer"><span><MoveUpRight size={13} aria-hidden="true"/> EXPLORE THE MATH</span><Link href={"/studio?kind=" + scene.kind} aria-label={"Edit " + scene.title}>Edit scene <ArrowUpRight size={16} aria-hidden="true"/></Link></div>
          </div>
        </article>
      ))}
    </div>
  );
}

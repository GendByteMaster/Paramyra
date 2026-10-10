import Link from "next/link";
import { SceneCanvas } from "./scene-canvas";
import { presets } from "@/core/scenes/presets";

export function SceneGallery() {
  return (
    <div className="scene-grid">
      {presets.map((scene) => (
        <article key={scene.id} className="panel scene-card">
          <SceneCanvas scene={scene} playing={false} />
          <h3>{scene.title}</h3>
          <p>{scene.kind === "lissajous" ? "Parametric harmony in motion." : scene.kind === "polar-rose" ? "Geometry hidden inside polar equations." : "Explore interference between harmonic functions."}</p>
          <div className="card-foot"><span>Interactive · Canvas 2D</span><Link href={"/studio?kind=" + scene.kind} aria-label={"Edit " + scene.title}>Edit scene ↗</Link></div>
        </article>
      ))}
    </div>
  );
}

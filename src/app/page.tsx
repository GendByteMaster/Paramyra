import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { SceneCanvas } from "@/components/scene-canvas";
import { AnimatedArrowLink } from "@/components/animata/animated-arrow-link";
import { SceneGallery } from "@/components/scene-gallery";
import { presets } from "@/core/scenes/presets";

export default function Home() {
  return (
    <div className="shell">
      <section className="hero">
        <div>
          <div className="eyebrow">An interactive mathematical universe</div>
          <h1>Where mathematics <span className="gradient">comes alive.</span></h1>
          <p className="lead">Explore beautiful equations, experiment with real-time simulations, and create mathematical art in your own studio.</p>
          <div className="actions">
            <AnimatedArrowLink href="/studio">Open Studio</AnimatedArrowLink>
            <Link className="btn" href="/explore">Explore scenes <Sparkles size={16} aria-hidden="true" /></Link>
          </div>
        </div>
        <div className="panel" style={{ padding: 12 }}>
          <SceneCanvas scene={presets[0]} />
          <div className="workspace-caption"><span>Lissajous · 3:4 frequency ratio</span><span>LIVE PREVIEW</span></div>
        </div>
      </section>
      <section className="section" aria-labelledby="featured-heading">
        <div className="section-head"><div><span className="eyebrow">Discover the patterns</span><h2 id="featured-heading">Featured explorations</h2></div><Link className="btn" href="/explore">All scenes <ArrowRight size={16} /></Link></div>
        <SceneGallery />
      </section>
    </div>
  );
}

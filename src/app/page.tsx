import Link from "next/link";
import { ArrowRight, ArrowUpRight, Atom, CircleDot, Compass, Layers3, Sparkles, WandSparkles } from "lucide-react";
import { SceneCanvas } from "@/components/scene-canvas";
import { AnimatedArrowLink } from "@/components/animata/animated-arrow-link";
import { SceneGallery } from "@/components/scene-gallery";
import { presets } from "@/core/scenes/presets";

export default function Home() {
  return (
    <div className="shell home-page">
      <section className="hero-stage" aria-labelledby="hero-title">
        <div className="hero-layout">
          <div className="hero-copy">
            <div className="hero-kicker"><span className="live-indicator" aria-hidden="true"/> THE CREATIVE SIDE OF MATHEMATICS</div>
            <h1 id="hero-title">Shape the <span className="headline-gradient">invisible.</span><br/>See the <span className="headline-outline">extraordinary.</span></h1>
            <p className="lead">A canvas for curious minds. Turn equations into beautiful motion, explore patterns in real time, and build your own mathematical worlds.</p>
            <div className="actions">
              <AnimatedArrowLink href="/studio">Open the Studio</AnimatedArrowLink>
              <Link className="btn secondary" href="/explore">Explore gallery <ArrowUpRight size={17} aria-hidden="true"/></Link>
            </div>
            <div className="hero-notes">
              <span><CircleDot size={14} aria-hidden="true"/> Live mathematics</span>
              <span><Layers3 size={14} aria-hidden="true"/> Creative workspace</span>
              <span><Sparkles size={14} aria-hidden="true"/> Made for discovery</span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-halo" aria-hidden="true"/>
            <div className="hero-orbit hero-orbit-one" aria-hidden="true"/>
            <div className="hero-orbit hero-orbit-two" aria-hidden="true"/>
            <div className="hero-preview">
              <div className="preview-topbar">
                <span className="preview-eyebrow"><span className="preview-dot"/> PARAMETRIC EXPLORER</span>
                <span className="preview-metadata">CANVAS / 001</span>
              </div>
              <SceneCanvas scene={presets[0]} />
              <div className="preview-bottom">
                <div><strong>Lissajous study</strong><span className="preview-subtitle">A dialogue between frequencies</span></div>
                <div className="preview-equation">x = sin(3t + φ)<br/>y = sin(4t)</div>
              </div>
            </div>
            <div className="floating-note note-top" aria-hidden="true"><span className="note-icon"><Atom size={17}/></span><div><strong>100% interactive</strong><small>Change every variable</small></div></div>
            <div className="floating-note note-bottom" aria-hidden="true"><span className="pulse-small"/> <span>Rendering live</span><span className="note-meter">RAF</span></div>
          </div>
        </div>
        <div className="hero-divider"><span>01 / DISCOVER</span><span>SCROLL TO EXPLORE <ArrowRight size={14}/></span></div>
      </section>

      <section className="value-strip" aria-label="How Paramyra works">
        <div><Compass size={18}/><span>01</span><strong>Explore</strong><p>Find the patterns behind the world.</p></div>
        <div><Atom size={18}/><span>02</span><strong>Simulate</strong><p>Experiment with every parameter.</p></div>
        <div><WandSparkles size={18}/><span>03</span><strong>Create</strong><p>Bring your mathematical ideas to life.</p></div>
      </section>

      <section className="section" aria-labelledby="featured-heading">
        <div className="section-head">
          <div><span className="eyebrow">THE CURATED COLLECTION / 001—003</span><h2 id="featured-heading">An endless world <span className="soft-heading">of patterns.</span></h2><p className="section-description">Every shape has a story. Open a scene, change the rules, make it yours.</p></div>
          <Link className="btn secondary section-action" href="/explore">Browse all scenes <ArrowUpRight size={17}/></Link>
        </div>
        <SceneGallery />
      </section>

      <section className="studio-promo">
        <div className="studio-promo-art" aria-hidden="true"><span className="promo-ring ring-one"/><span className="promo-ring ring-two"/><span className="promo-center"><Layers3 size={32}/></span></div>
        <div className="studio-promo-copy"><span className="eyebrow">YOUR SPACE TO EXPERIMENT</span><h2>From curiosity <span className="headline-gradient">to creation.</span></h2><p>No complex setup. Choose a mathematical scene, fine-tune its parameters and watch your ideas take shape.</p></div>
        <Link href="/studio" className="btn primary">Start creating <ArrowUpRight size={17}/></Link>
      </section>
    </div>
  );
}

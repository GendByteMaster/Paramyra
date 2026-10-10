import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SceneGallery } from "@/components/scene-gallery";

export const metadata: Metadata = { title: "Explore" };
export default function ExplorePage() {
  return (
    <div className="shell explore-page">
      <div className="page-intro"><div><span className="eyebrow">THE MATHEMATICAL ATLAS</span><h1>Mathematical gallery<span className="brand-period">.</span></h1><p className="lead">A collection of living equations, geometric forms and visual experiments. Pick a scene and make it yours.</p></div><Link className="btn primary" href="/studio">Open Studio <ArrowUpRight size={17}/></Link></div>
      <div className="gallery-filter-label"><span>FEATURED COLLECTION</span><span>03 SCENES · CANVAS 2D</span></div>
      <SceneGallery/>
      <p className="gallery-disclaimer">More mathematical worlds are coming. Every scene in this collection can be edited in the Studio.</p>
    </div>
  );
}

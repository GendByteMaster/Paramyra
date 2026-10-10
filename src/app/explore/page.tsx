import type { Metadata } from "next";
import { SceneGallery } from "@/components/scene-gallery";

export const metadata: Metadata = { title: "Explore" };
export default function ExplorePage() {
  return <div className="shell section"><span className="eyebrow">Discover</span><div className="section-head"><div><h2>Mathematical gallery</h2><p className="muted">Every scene opens in the same editor and mathematical runtime.</p></div></div><SceneGallery /></div>;
}

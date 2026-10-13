import type { Metadata } from "next";
import { PhysicsGallery } from "@/features/physics/physics-gallery";
import { PhysicsShell } from "@/features/physics/physics-shell";
import "../physics.css";

export const metadata: Metadata = { title: "Physics Experiments", alternates: { canonical: "/physics/gallery" } };

/** Compatibility alias for users looking for the experiments collection. */
export default function PhysicsExperimentsPage() {
  return <PhysicsShell><PhysicsGallery /></PhysicsShell>;
}

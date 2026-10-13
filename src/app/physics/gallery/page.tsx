import type { Metadata } from "next";
import { PhysicsGallery } from "@/features/physics/physics-gallery";
import { PhysicsShell } from "@/features/physics/physics-shell";
import "../physics.css";

export const metadata: Metadata = { title: "Physics Gallery" };

export default function PhysicsGalleryPage() {
  return <PhysicsShell><PhysicsGallery /></PhysicsShell>;
}

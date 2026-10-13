import type { Metadata } from "next";
import { PhysicsShell } from "@/features/physics/physics-shell";
import { PhysicsStudio } from "@/features/physics/physics-studio";
import "../physics.css";

export const metadata: Metadata = { title: "Physics Projects" };

export default function PhysicsProjectsPage() {
  return <PhysicsShell><PhysicsStudio /></PhysicsShell>;
}

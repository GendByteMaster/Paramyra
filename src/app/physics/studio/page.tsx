import type { Metadata } from "next";
import { PhysicsShell } from "@/features/physics/physics-shell";
import { PhysicsStudio } from "@/features/physics/physics-studio";
import "../physics.css";

export const metadata: Metadata = { title: "Physics Studio" };

export default function PhysicsStudioPage() {
  return <PhysicsShell><PhysicsStudio /></PhysicsShell>;
}

import type { Metadata } from "next";
import { PhysicsHome } from "@/features/physics/physics-home";
import { PhysicsShell } from "@/features/physics/physics-shell";
import "./physics.css";

export const metadata: Metadata = { title: "Physics" };

export default function PhysicsPage() {
  return <PhysicsShell><PhysicsHome /></PhysicsShell>;
}

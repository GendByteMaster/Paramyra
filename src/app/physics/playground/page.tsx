import type { Metadata } from "next";
import { PhysicsShell } from "@/features/physics/physics-shell";
import { PhysicsPlayground } from "@/features/physics/physics-playground";
import "../physics.css";

export const metadata: Metadata = { title: "Physics Playground" };

export default async function PhysicsPlaygroundPage({ searchParams }: { searchParams: Promise<{ experiment?: string }> }) {
  const { experiment } = await searchParams;
  const initialKind = experiment === "spring" ? "spring" : "projectile";
  return <PhysicsShell><PhysicsPlayground initialKind={initialKind} /></PhysicsShell>;
}

import type { Metadata } from "next";
import { StudioClient } from "@/components/studio-v07";
import type { SceneKind } from "@/core/scenes/schema";

export const metadata: Metadata = { title: "Studio" };
const kinds: SceneKind[] = ["lissajous", "polar-rose", "wave"];
export default async function StudioPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const initialKind = kinds.find((item) => item === kind);
  return <StudioClient key={initialKind ?? "saved"} initialKind={initialKind} mode="studio" />;
}

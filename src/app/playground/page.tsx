import type { Metadata } from "next";
import { StudioClient } from "@/components/studio-v07";

export const metadata: Metadata = { title: "Playground" };
export default function PlaygroundPage() {
  return <StudioClient mode="playground" />;
}

import type { Metadata } from "next";
import { StudioClient } from "@/components/studio-client";

export const metadata: Metadata = { title: "Playground" };
export default function PlaygroundPage() {
  return <StudioClient mode="playground" />;
}

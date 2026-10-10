import type { Metadata } from "next";
import { NodeGraphClient } from "@/components/node-graph-workspace";

export const metadata: Metadata = { title: "Node Graph Workspace" };
export default function NodeGraphPage() {
  return <NodeGraphClient />;
}

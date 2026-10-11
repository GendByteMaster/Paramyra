import { z } from "zod";
import type { NodeGraph } from "./model";

const courseworkSchema = z.object({
  version: z.literal(1),
  institution: z.string().max(160),
  student: z.string().max(120),
  supervisor: z.string().max(120),
  title: z.string().min(1).max(180),
  objective: z.string().max(1200),
  method: z.string().max(1600),
  conclusion: z.string().max(1600),
}).strict();

export type CourseworkDraft = z.infer<typeof courseworkSchema>;
const PREFIX = "paramyra.graph.coursework.v1.";

export function defaultCourseworkDraft(graph: NodeGraph): CourseworkDraft {
  return {
    version: 1,
    institution: "",
    student: "",
    supervisor: "",
    title: "Mathematical modelling study: " + graph.title,
    objective: "",
    method: "",
    conclusion: "",
  };
}

/** Notes are per graph, separate from the authoritative project and MathDocument. */
export function readCourseworkDraft(graph: NodeGraph, projectId?: string, allowLegacy = true): CourseworkDraft {
  const fallback = defaultCourseworkDraft(graph);
  if (typeof window === "undefined") return fallback;
  try {
    const scopedKey = projectId ? PREFIX + projectId + "." + graph.id : PREFIX + graph.id;
    const raw = window.localStorage.getItem(scopedKey) ?? (allowLegacy ? window.localStorage.getItem(PREFIX + graph.id) : null);
    if (!raw) return fallback;
    const result = courseworkSchema.safeParse(JSON.parse(raw));
    return result.success
      ? {
        ...result.data,
        // Previous M3.7 drafts may contain the generated Russian default.
        // Migrate only that exact template; never rewrite user-authored text.
        title: result.data.title === "Исследование математической модели «" + graph.title + "»"
          ? fallback.title : result.data.title,
      }
      : fallback;
  } catch {
    return fallback;
  }
}
export function saveCourseworkDraft(graphId: string, draft: CourseworkDraft, projectId?: string): boolean {
  if (typeof window === "undefined") return false;
  const result = courseworkSchema.safeParse(draft);
  if (!result.success) return false;
  try {
    window.localStorage.setItem(projectId ? PREFIX + projectId + "." + graphId : PREFIX + graphId, JSON.stringify(result.data));
    return true;
  } catch {
    return false;
  }
}

const formatNumber = (number: number) => Number(number.toPrecision(6)).toString();
const describe = (graph: NodeGraph, id: string, visited: Set<string>): string => {
  const node = graph.nodes.find(n => n.id === id);
  if (!node || visited.has(id)) return "?";
  const seen = new Set(visited);
  seen.add(id);
  const input = (port: "a" | "b" | "in") => {
    const edge = graph.edges.find(e => e.target === id && e.port === port);
    return edge ? describe(graph, edge.source, seen) : "?";
  };
  switch (node.kind) {
    case "constant": return formatNumber(node.value ?? 0);
    case "time": return "t";
    case "add": return "(" + input("a") + " + " + input("b") + ")";
    case "multiply": return "(" + input("a") + " × " + input("b") + ")";
    case "sine": return "sin(" + input("in") + ")";
    case "output": return input("in");
  }
};

export function courseworkFormulas(graph: NodeGraph): { property: string; expression: string }[] {
  return graph.nodes.filter(n => n.kind === "output").map(n => ({
    property: n.property ?? "Output",
    expression: describe(graph, n.id, new Set()),
  }));
}

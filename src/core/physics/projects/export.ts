import {
  parsePhysicsProject,
  parsePhysicsProjectJSON,
  type PhysicsProject,
} from "../model/schema";

/** A portable project export is a validated UTF-8 JSON document. */
export function exportPhysicsProjectJSON(value: unknown): string | null {
  const project = parsePhysicsProject(value);
  if (!project) return null;
  try {
    const json = JSON.stringify(project, null, 2);
    return parsePhysicsProjectJSON(json) ? json : null;
  } catch {
    return null;
  }
}

/** Import validation preserves the source id; addImportedPhysicsProject assigns a fresh library id. */
export function parsePhysicsProjectImportJSON(json: string): PhysicsProject | null {
  return parsePhysicsProjectJSON(json);
}

import {
  createPhysicsProject,
  parsePhysicsProject,
  type PhysicsProject,
} from "../model/schema";
import { openDatabase, CHECKPOINT_STORE } from "../../projects/durable-checkpoints";

export const PHYSICS_LIBRARY_RECORD_KEY = "physics-library-live";
export const MAX_PHYSICS_PROJECTS = 20;
export const MAX_PHYSICS_LIBRARY_BYTES = 1_000_000;

export type PhysicsLibrary = Readonly<{
  schemaVersion: 1;
  activeId: string | null;
  projects: readonly PhysicsProject[];
}>;

export type PhysicsLibraryRecord = Readonly<{
  key: typeof PHYSICS_LIBRARY_RECORD_KEY;
  version: 1;
  revision: number;
  updatedAt: number;
  library: PhysicsLibrary;
}>;

export type PhysicsLibraryRead =
  | { status: "ready"; record: PhysicsLibraryRecord }
  | { status: "empty" | "invalid" | "unavailable" };

export type PhysicsLibraryInitialize =
  | { status: "ready"; record: PhysicsLibraryRecord }
  | { status: "invalid" | "unavailable" };

export type PhysicsLibraryMutation =
  | { status: "saved"; record: PhysicsLibraryRecord }
  | { status: "conflict" | "invalid" | "unavailable" | "rejected" };

const encoder = new TextEncoder();

function validId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 64;
}

export function emptyPhysicsLibrary(): PhysicsLibrary {
  return { schemaVersion: 1, activeId: null, projects: [] };
}

export function parsePhysicsLibrary(value: unknown): PhysicsLibrary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).sort().join(",") !== "activeId,projects,schemaVersion"
      || raw.schemaVersion !== 1 || !Array.isArray(raw.projects)
      || raw.projects.length > MAX_PHYSICS_PROJECTS
      || (raw.activeId !== null && !validId(raw.activeId))) return null;

  const projects = raw.projects.map(parsePhysicsProject);
  if (projects.some(project => project === null)) return null;
  const validProjects = projects as PhysicsProject[];
  const ids = validProjects.map(project => project.id);
  if (new Set(ids).size !== ids.length) return null;
  if (validProjects.length === 0 ? raw.activeId !== null : !ids.includes(raw.activeId as string)) return null;

  return { schemaVersion: 1, activeId: raw.activeId as string | null, projects: validProjects };
}

export function parsePhysicsLibraryRecord(value: unknown): PhysicsLibraryRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).sort().join(",") !== "key,library,revision,updatedAt,version"
      || raw.key !== PHYSICS_LIBRARY_RECORD_KEY || raw.version !== 1
      || !Number.isSafeInteger(raw.revision) || (raw.revision as number) < 1
      || typeof raw.updatedAt !== "number" || !Number.isFinite(raw.updatedAt) || raw.updatedAt < 0) return null;
  const library = parsePhysicsLibrary(raw.library);
  if (!library || !withinLibraryLimit(library)) return null;
  return {
    key: PHYSICS_LIBRARY_RECORD_KEY,
    version: 1,
    revision: raw.revision as number,
    updatedAt: raw.updatedAt,
    library,
  };
}

function withinLibraryLimit(library: PhysicsLibrary): boolean {
  try {
    return encoder.encode(JSON.stringify(library)).byteLength <= MAX_PHYSICS_LIBRARY_BYTES;
  } catch {
    return false;
  }
}

function factoryOrNull(): IDBFactory | null {
  return typeof indexedDB === "undefined" ? null : indexedDB;
}

export async function readPhysicsLibrary(
  factory: IDBFactory | null = factoryOrNull(),
): Promise<PhysicsLibraryRead> {
  if (!factory) return { status: "unavailable" };
  let db: IDBDatabase;
  try { db = await openDatabase(factory); } catch { return { status: "unavailable" }; }
  try {
    return await new Promise<PhysicsLibraryRead>(resolve => {
      let outcome: PhysicsLibraryRead = { status: "unavailable" };
      try {
        const tx = db.transaction(CHECKPOINT_STORE, "readonly");
        const request = tx.objectStore(CHECKPOINT_STORE).get(PHYSICS_LIBRARY_RECORD_KEY);
        request.onsuccess = () => {
          if (request.result === undefined) outcome = { status: "empty" };
          else {
            const record = parsePhysicsLibraryRecord(request.result);
            outcome = record ? { status: "ready", record } : { status: "invalid" };
          }
        };
        tx.oncomplete = () => resolve(outcome);
        tx.onabort = () => resolve({ status: "unavailable" });
        tx.onerror = () => resolve({ status: "unavailable" });
      } catch { resolve({ status: "unavailable" }); }
    });
  } finally { db.close(); }
}

/** Create the empty first-run library only if no record exists; corruption is preserved. */
export async function initializePhysicsLibrary(
  factory: IDBFactory | null = factoryOrNull(),
): Promise<PhysicsLibraryInitialize> {
  if (!factory) return { status: "unavailable" };
  let db: IDBDatabase;
  try { db = await openDatabase(factory); } catch { return { status: "unavailable" }; }
  try {
    return await new Promise<PhysicsLibraryInitialize>(resolve => {
      let outcome: PhysicsLibraryInitialize = { status: "unavailable" };
      try {
        const tx = db.transaction(CHECKPOINT_STORE, "readwrite");
        const request = tx.objectStore(CHECKPOINT_STORE).get(PHYSICS_LIBRARY_RECORD_KEY);
        request.onsuccess = () => {
          if (request.result !== undefined) {
            const record = parsePhysicsLibraryRecord(request.result);
            if (record) outcome = { status: "ready", record };
            else {
              outcome = { status: "invalid" };
              tx.abort();
            }
            return;
          }
          const record: PhysicsLibraryRecord = {
            key: PHYSICS_LIBRARY_RECORD_KEY,
            version: 1,
            revision: 1,
            updatedAt: Date.now(),
            library: emptyPhysicsLibrary(),
          };
          tx.objectStore(CHECKPOINT_STORE).put(record);
          outcome = { status: "ready", record };
        };
        tx.oncomplete = () => resolve(outcome);
        tx.onabort = () => resolve(outcome.status === "ready" ? { status: "unavailable" } : outcome);
        tx.onerror = () => resolve({ status: "unavailable" });
      } catch { resolve({ status: "unavailable" }); }
    });
  } finally { db.close(); }
}

/**
 * Atomically compare revision and active project, validate the current record,
 * run a synchronous pure mutator, then store one bounded next snapshot.
 */
export async function mutatePhysicsLibrary(
  expectedRevision: number,
  expectedActiveId: string | null,
  mutate: (current: PhysicsLibrary) => PhysicsLibrary | null,
  factory: IDBFactory | null = factoryOrNull(),
): Promise<PhysicsLibraryMutation> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1
      || (expectedActiveId !== null && !validId(expectedActiveId)) || typeof mutate !== "function") {
    return { status: "invalid" };
  }
  if (expectedRevision === Number.MAX_SAFE_INTEGER) return { status: "rejected" };
  if (!factory) return { status: "unavailable" };
  let db: IDBDatabase;
  try { db = await openDatabase(factory); } catch { return { status: "unavailable" }; }
  try {
    return await new Promise<PhysicsLibraryMutation>(resolve => {
      let outcome: PhysicsLibraryMutation = { status: "unavailable" };
      try {
        const tx = db.transaction(CHECKPOINT_STORE, "readwrite");
        const request = tx.objectStore(CHECKPOINT_STORE).get(PHYSICS_LIBRARY_RECORD_KEY);
        request.onsuccess = () => {
          if (request.result === undefined) {
            outcome = { status: "conflict" };
            tx.abort();
            return;
          }
          const current = parsePhysicsLibraryRecord(request.result);
          if (!current) {
            outcome = { status: "invalid" };
            tx.abort();
            return;
          }
          if (current.revision !== expectedRevision || current.library.activeId !== expectedActiveId) {
            outcome = { status: "conflict" };
            tx.abort();
            return;
          }

          let candidate: PhysicsLibrary | null;
          try { candidate = mutate(current.library); } catch { candidate = null; }
          const library = candidate ? parsePhysicsLibrary(candidate) : null;
          if (!library || !withinLibraryLimit(library)) {
            outcome = { status: "rejected" };
            tx.abort();
            return;
          }
          const record: PhysicsLibraryRecord = {
            key: PHYSICS_LIBRARY_RECORD_KEY,
            version: 1,
            revision: current.revision + 1,
            updatedAt: Date.now(),
            library,
          };
          tx.objectStore(CHECKPOINT_STORE).put(record);
          outcome = { status: "saved", record };
        };
        tx.oncomplete = () => resolve(outcome);
        tx.onabort = () => resolve(outcome.status === "saved" ? { status: "unavailable" } : outcome);
        tx.onerror = () => resolve({ status: "unavailable" });
      } catch { resolve({ status: "unavailable" }); }
    });
  } finally { db.close(); }
}

export function activePhysicsProject(library: PhysicsLibrary): PhysicsProject | null {
  return library.projects.find(project => project.id === library.activeId) ?? null;
}

function validNow(now: number): boolean {
  return Number.isSafeInteger(now) && now >= 0;
}

function canAppend(library: PhysicsLibrary): boolean {
  return library.projects.length < MAX_PHYSICS_PROJECTS;
}

function freshUniqueId(library: PhysicsLibrary): string | null {
  try {
    const randomUUID = globalThis.crypto?.randomUUID;
    if (typeof randomUUID !== "function") return null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = `physics-${randomUUID.call(globalThis.crypto)}`;
      if (validId(id) && !library.projects.some(project => project.id === id)) return id;
    }
  } catch { return null; }
  return null;
}

export function createPhysicsLibraryProject(
  library: PhysicsLibrary,
  kind: PhysicsProject["model"]["kind"],
  now = Date.now(),
  id = freshUniqueId(library),
): PhysicsLibrary | null {
  if (!canAppend(library) || !validNow(now) || !id || !validId(id)
      || library.projects.some(project => project.id === id)) return null;
  const project = parsePhysicsProject(createPhysicsProject(kind, id, now));
  if (!project) return null;
  return parsePhysicsLibrary({ schemaVersion: 1, activeId: id, projects: [...library.projects, project] });
}

export function addImportedPhysicsProject(
  library: PhysicsLibrary,
  imported: unknown,
  id = freshUniqueId(library),
  now = Date.now(),
): PhysicsLibrary | null {
  const source = parsePhysicsProject(imported);
  if (!source || !canAppend(library) || !validNow(now) || !id || !validId(id)
      || id === source.id || library.projects.some(project => project.id === id)) return null;
  const project = parsePhysicsProject({ ...source, id, createdAt: now, updatedAt: now });
  if (!project) return null;
  return parsePhysicsLibrary({ schemaVersion: 1, activeId: id, projects: [...library.projects, project] });
}

export function replaceActivePhysicsProject(
  library: PhysicsLibrary,
  expectedProjectId: string,
  replacement: unknown,
  now = Date.now(),
): PhysicsLibrary | null {
  const current = activePhysicsProject(library);
  const project = parsePhysicsProject(replacement);
  if (!current || current.id !== expectedProjectId || !project || project.id !== expectedProjectId
      || !validNow(now)) return null;
  const updated = parsePhysicsProject({ ...project, createdAt: current.createdAt, updatedAt: now });
  if (!updated) return null;
  return parsePhysicsLibrary({
    ...library,
    projects: library.projects.map(entry => entry.id === expectedProjectId ? updated : entry),
  });
}

export function switchPhysicsProject(library: PhysicsLibrary, id: string): PhysicsLibrary | null {
  if (!library.projects.some(project => project.id === id)) return null;
  return parsePhysicsLibrary({ ...library, activeId: id });
}

export function duplicatePhysicsProject(
  library: PhysicsLibrary,
  sourceId: string,
  newId = freshUniqueId(library),
  now = Date.now(),
): PhysicsLibrary | null {
  const source = library.projects.find(project => project.id === sourceId);
  if (!source || !canAppend(library) || !validNow(now) || !newId || !validId(newId)
      || newId === sourceId || library.projects.some(project => project.id === newId)) return null;
  const project = parsePhysicsProject({
    ...source,
    id: newId,
    name: `${source.name} Copy`.slice(0, 120),
    createdAt: now,
    updatedAt: now,
  });
  if (!project) return null;
  return parsePhysicsLibrary({ schemaVersion: 1, activeId: newId, projects: [...library.projects, project] });
}

export function renamePhysicsProject(
  library: PhysicsLibrary,
  id: string,
  name: string,
  now = Date.now(),
): PhysicsLibrary | null {
  const trimmed = name.trim();
  if (!validNow(now) || !trimmed || trimmed.length > 120) return null;
  let found = false;
  const projects = library.projects.map(project => {
    if (project.id !== id) return project;
    found = true;
    return { ...project, name: trimmed, updatedAt: now };
  });
  return found ? parsePhysicsLibrary({ ...library, projects }) : null;
}

/** The active-id precondition prevents deletion after a tab switch. */
export function deletePhysicsProject(
  library: PhysicsLibrary,
  id: string,
  expectedActiveId: string | null,
): PhysicsLibrary | null {
  if (library.activeId !== expectedActiveId || !library.projects.some(project => project.id === id)) return null;
  const projects = library.projects.filter(project => project.id !== id);
  const activeId = library.activeId === id ? (projects[0]?.id ?? null) : library.activeId;
  return parsePhysicsLibrary({ schemaVersion: 1, activeId, projects });
}

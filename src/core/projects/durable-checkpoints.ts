import { parseStudioLibrary, type StudioLibrary } from "./studio-library";

/**
 * M4.2 transactional recovery checkpoint. The existing editors still write
 * their compatibility localStorage registry synchronously. This IndexedDB
 * checkpoint is an explicit, separate recovery copy, not an automatic primary
 * data store or an ACID guarantee for existing editor writes.
 */
export const CHECKPOINT_DATABASE = "paramyra-studio-checkpoints";
export const CHECKPOINT_STORE = "snapshots";
const CHECKPOINT_ID = "studio-library";
const MAX_SNAPSHOT_CHARS = 1_000_000;

export type RecoveryCheckpoint = Readonly<{
  key: typeof CHECKPOINT_ID;
  version: 1;
  revision: number;
  savedAt: number;
  library: StudioLibrary;
}>;
export type CheckpointRead =
  | { status: "ready"; checkpoint: RecoveryCheckpoint }
  | { status: "empty" | "invalid" | "unavailable" };
export type CheckpointWrite =
  | { status: "saved"; checkpoint: RecoveryCheckpoint }
  | { status: "conflict" | "invalid" | "unavailable" };

/** Validation is mandatory even after IndexedDB structured cloning. */
export function parseRecoveryCheckpoint(raw: unknown): RecoveryCheckpoint | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).sort().join(",") !== "key,library,revision,savedAt,version"
      || value.key !== CHECKPOINT_ID || value.version !== 1
      || !Number.isSafeInteger(value.revision) || (value.revision as number) < 1
      || typeof value.savedAt !== "number" || !Number.isFinite(value.savedAt) || value.savedAt < 0) return null;
  const library = parseStudioLibrary(value.library);
  return library ? {key:CHECKPOINT_ID,version:1,revision:value.revision as number,savedAt:value.savedAt,library} : null;
}

export function matchesCheckpointRevision(expected: number | null, actual: number | null): boolean {
  return expected === actual;
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try { request = factory.open(CHECKPOINT_DATABASE, 1); }
    catch (error) { reject(error); return; }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CHECKPOINT_STORE)) {
        db.createObjectStore(CHECKPOINT_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB upgrade blocked by another tab"));
  });
}

function browserFactory(): IDBFactory | null {
  return typeof indexedDB === "undefined" ? null : indexedDB;
}

export async function readRecoveryCheckpoint(factory: IDBFactory | null = browserFactory()): Promise<CheckpointRead> {
  if (!factory) return {status:"unavailable"};
  let db: IDBDatabase;
  try { db = await openDatabase(factory); } catch { return {status:"unavailable"}; }
  try {
    return await new Promise<CheckpointRead>(resolve => {
      let result: CheckpointRead = {status:"unavailable"};
      try {
        const tx = db.transaction(CHECKPOINT_STORE, "readonly");
        const request = tx.objectStore(CHECKPOINT_STORE).get(CHECKPOINT_ID);
        request.onsuccess = () => {
          if (request.result === undefined) result = {status:"empty"};
          else {
            const checkpoint = parseRecoveryCheckpoint(request.result);
            result = checkpoint ? {status:"ready",checkpoint} : {status:"invalid"};
          }
        };
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => resolve({status:"unavailable"});
        tx.onerror = () => resolve({status:"unavailable"});
      } catch { resolve({status:"unavailable"}); }
    });
  } finally { db.close(); }
}

/**
 * Compare-and-swap check and put happen in the SAME IDB readwrite transaction,
 * serializing competing tab writers to this store. No blind overwrite is possible.
 */
export async function writeRecoveryCheckpoint(
  library: StudioLibrary, expectedRevision: number | null,
  factory: IDBFactory | null = browserFactory(),
): Promise<CheckpointWrite> {
  const valid = parseStudioLibrary(library);
  if (!valid || JSON.stringify(valid).length > MAX_SNAPSHOT_CHARS
      || (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1))) {
    return {status:"invalid"};
  }
  if (!factory) return {status:"unavailable"};
  let db: IDBDatabase;
  try { db = await openDatabase(factory); } catch { return {status:"unavailable"}; }
  try {
    return await new Promise<CheckpointWrite>(resolve => {
      let result: CheckpointWrite = {status:"unavailable"};
      try {
        const tx = db.transaction(CHECKPOINT_STORE, "readwrite");
        const request = tx.objectStore(CHECKPOINT_STORE).get(CHECKPOINT_ID);
        request.onsuccess = () => {
          const existing = request.result === undefined ? null : parseRecoveryCheckpoint(request.result);
          if (request.result !== undefined && !existing) {
            result = {status:"invalid"};
            tx.abort();
            return;
          }
          if (!matchesCheckpointRevision(expectedRevision, existing?.revision ?? null)) {
            result = {status:"conflict"};
            tx.abort();
            return;
          }
          const checkpoint: RecoveryCheckpoint = {
            key:CHECKPOINT_ID,version:1,revision:(existing?.revision??0)+1,
            savedAt:Date.now(),library:valid,
          };
          tx.objectStore(CHECKPOINT_STORE).put(checkpoint);
          result = {status:"saved",checkpoint};
        };
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => resolve(result.status === "saved" ? {status:"unavailable"} : result);
        tx.onerror = () => resolve({status:"unavailable"});
      } catch { resolve({status:"unavailable"}); }
    });
  } finally { db.close(); }
}

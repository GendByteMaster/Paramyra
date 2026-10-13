import { describe, expect, it } from "vitest";
import { createPhysicsProject, parsePhysicsProject } from "../model/schema";
import {
  addImportedPhysicsProject,
  activePhysicsProject,
  createPhysicsLibraryProject,
  deletePhysicsProject,
  duplicatePhysicsProject,
  emptyPhysicsLibrary,
  initializePhysicsLibrary,
  MAX_PHYSICS_LIBRARY_BYTES,
  MAX_PHYSICS_PROJECTS,
  mutatePhysicsLibrary,
  parsePhysicsLibrary,
  parsePhysicsLibraryRecord,
  PHYSICS_LIBRARY_RECORD_KEY,
  readPhysicsLibrary,
  renamePhysicsProject,
  replaceActivePhysicsProject,
  switchPhysicsProject,
  type PhysicsLibraryRecord,
} from "./library";
import { exportPhysicsProjectJSON, parsePhysicsProjectImportJSON } from "./export";

type RequestLike = {
  result?: unknown;
  error?: Error | null;
  onsuccess: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onupgradeneeded: ((event: IDBVersionChangeEvent) => void) | null;
};

/** Small serialized IDB test double covering the repository's get/put/abort contract. */
class MemoryIndexedDB {
  readonly records = new Map<string, unknown>();
  private queue: MemoryTransaction[] = [];
  private active = false;
  private hasStore = false;
  abortNextCommit = false;

  readonly factory = {
    open: () => {
      const request: RequestLike = {
        result: undefined,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };
      const database = {
        objectStoreNames: { contains: (name: string) => name === "snapshots" && this.hasStore },
        createObjectStore: (name: string) => {
          if (name === "snapshots") this.hasStore = true;
          return {};
        },
        transaction: (_store: string, mode: IDBTransactionMode) => {
          const tx = new MemoryTransaction(this, mode);
          this.queue.push(tx);
          this.activateNext();
          return tx;
        },
        close: () => undefined,
      };
      request.result = database;
      queueMicrotask(() => {
        if (!this.hasStore) {
          request.onupgradeneeded?.(new Event("upgradeneeded") as IDBVersionChangeEvent);
        }
        request.onsuccess?.(new Event("success"));
      });
      return request;
    },
  } as unknown as IDBFactory;

  activateNext(): void {
    if (this.active) return;
    const tx = this.queue.shift();
    if (!tx) return;
    this.active = true;
    queueMicrotask(() => tx.run(() => {
      this.active = false;
      this.activateNext();
    }));
  }
}

class MemoryTransaction {
  oncomplete: ((event: Event) => void) | null = null;
  onabort: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private aborted = false;
  private staged = new Map<string, unknown>();
  private requests: Array<{ key: string; request: RequestLike }> = [];

  constructor(private readonly db: MemoryIndexedDB, private readonly mode: IDBTransactionMode) {}

  objectStore() {
    return {
      get: (key: string) => {
        const request: RequestLike = { result: undefined, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
        this.requests.push({ key, request });
        return request;
      },
      put: (value: { key: string }) => {
        if (this.mode !== "readwrite") throw new Error("Read-only transaction");
        this.staged.set(value.key, structuredClone(value));
        return { result: value.key };
      },
    };
  }

  abort(): void {
    this.aborted = true;
  }

  run(finished: () => void): void {
    setTimeout(() => {
      for (const { key, request } of this.requests) {
        request.result = this.db.records.has(key) ? structuredClone(this.db.records.get(key)) : undefined;
        request.onsuccess?.(new Event("success"));
      }
      queueMicrotask(() => {
        if (this.db.abortNextCommit) {
          this.db.abortNextCommit = false;
          this.aborted = true;
        }
        if (this.aborted) this.onabort?.(new Event("abort"));
        else {
          for (const [key, value] of this.staged) this.db.records.set(key, value);
          this.oncomplete?.(new Event("complete"));
        }
        finished();
      });
    }, 0);
  }
}

function initialRecord(id = "project-a"): PhysicsLibraryRecord {
  const project = createPhysicsProject("projectile", id, 100);
  return {
    key: PHYSICS_LIBRARY_RECORD_KEY,
    version: 1,
    revision: 1,
    updatedAt: 100,
    library: { schemaVersion: 1, activeId: id, projects: [project] },
  };
}

describe("Physics library validation and project operations", () => {
  it("accepts empty libraries and rejects inconsistent, duplicate, unknown, and oversized snapshots", () => {
    expect(parsePhysicsLibrary(emptyPhysicsLibrary())).toEqual(emptyPhysicsLibrary());
    const record = initialRecord();
    expect(parsePhysicsLibraryRecord(record)).toEqual(record);
    expect(parsePhysicsLibraryRecord({ ...record, futureField: true })).toBeNull();
    expect(parsePhysicsLibrary({ ...record.library, activeId: null })).toBeNull();
    expect(parsePhysicsLibrary({ ...record.library, projects: [record.library.projects[0], record.library.projects[0]] })).toBeNull();
    expect(parsePhysicsLibrary({ ...record.library, unknown: true })).toBeNull();
    expect(parsePhysicsLibrary({ ...record.library, projects: Array.from({ length: MAX_PHYSICS_PROJECTS + 1 }, (_, index) =>
      createPhysicsProject("spring", `over-capacity-${index}`, 1)) })).toBeNull();
    const large = { ...record.library, projects: [{ ...record.library.projects[0], labReport: { hypothesis: "x".repeat(MAX_PHYSICS_LIBRARY_BYTES), notes: "", conclusion: "" } }] };
    expect(parsePhysicsLibraryRecord({ ...record, library: large })).toBeNull();
  });

  it("creates, imports with a fresh id, duplicates, renames, switches, replaces, and deletes to empty", () => {
    const empty = emptyPhysicsLibrary();
    const first = createPhysicsLibraryProject(empty, "projectile", 10, "one");
    expect(first?.activeId).toBe("one");
    const source = createPhysicsProject("spring", "external", 20);
    const imported = addImportedPhysicsProject(first!, source, "two", 30);
    expect(imported?.activeId).toBe("two");
    expect(imported?.projects[1].id).toBe("two");
    expect(imported?.projects[1].createdAt).toBe(30);
    expect(addImportedPhysicsProject(first!, source, "external", 30)).toBeNull();

    const duplicate = duplicatePhysicsProject(imported!, "two", "three", 40);
    expect(duplicate?.projects[2].name).toBe("Mass–Spring Oscillator Copy");
    const renamed = renamePhysicsProject(duplicate!, "three", "  Lab copy  ", 50);
    expect(renamed?.projects[2].name).toBe("Lab copy");
    expect(switchPhysicsProject(renamed!, "one")?.activeId).toBe("one");

    const replacement = createPhysicsProject("projectile", "three", 90);
    const replaced = replaceActivePhysicsProject(renamed!, "three", replacement, 60);
    expect(replaced?.projects[2].createdAt).toBe(40);
    expect(replaced?.projects[2].updatedAt).toBe(60);
    expect(replaceActivePhysicsProject(renamed!, "one", replacement, 60)).toBeNull();
    expect(deletePhysicsProject(replaced!, "three", "three")?.activeId).toBe("one");
    const only = createPhysicsLibraryProject(empty, "spring", 1, "last")!;
    expect(deletePhysicsProject(only, "last", "last")).toEqual(empty);
    expect(deletePhysicsProject(only, "last", "stale")).toBeNull();
  });

  it("round trips export/import and refuses malformed, future, and dynamically oversized JSON", () => {
    const project = createPhysicsProject("spring", "spring-1", 1);
    const json = exportPhysicsProjectJSON(project);
    expect(json).toBeTruthy();
    expect(parsePhysicsProjectImportJSON(json!)).toEqual(project);
    expect(parsePhysicsProjectImportJSON('{"schemaVersion":2}')).toBeNull();
    expect(parsePhysicsProjectImportJSON("{" )).toBeNull();
    expect(parsePhysicsProjectImportJSON(" ".repeat(256 * 1024 + 1))).toBeNull();
    expect(parsePhysicsProject({ ...project, executable: "return 1" })).toBeNull();
    expect(exportPhysicsProjectJSON({ ...project, executable: "return 1" })).toBeNull();
  });
});

describe("Physics IndexedDB library transactions", () => {
  it("initializes only missing storage and preserves a corrupt existing record", async () => {
    const db = new MemoryIndexedDB();
    expect((await readPhysicsLibrary(db.factory)).status).toBe("empty");
    const initialized = await initializePhysicsLibrary(db.factory);
    expect(initialized.status).toBe("ready");
    if (initialized.status !== "ready") return;
    expect(initialized.record.library).toEqual(emptyPhysicsLibrary());
    expect(initialized.record.revision).toBe(1);
    expect(await initializePhysicsLibrary(db.factory)).toEqual(initialized);

    const damaged = { key: PHYSICS_LIBRARY_RECORD_KEY, version: 9, revision: 7, library: {} };
    db.records.set(PHYSICS_LIBRARY_RECORD_KEY, damaged);
    expect(await initializePhysicsLibrary(db.factory)).toEqual({ status: "invalid" });
    expect(await mutatePhysicsLibrary(1, null, current => current, db.factory)).toEqual({ status: "invalid" });
    expect(db.records.get(PHYSICS_LIBRARY_RECORD_KEY)).toEqual(damaged);
  });

  it("serializes concurrent writers with revision and active-id compare-and-swap", async () => {
    const db = new MemoryIndexedDB();
    const initialized = await initializePhysicsLibrary(db.factory);
    if (initialized.status !== "ready") throw new Error("initialization failed");
    const first = await mutatePhysicsLibrary(1, null,
      current => createPhysicsLibraryProject(current, "projectile", 2, "project-a"), db.factory);
    expect(first.status).toBe("saved");
    if (first.status !== "saved") return;

    const results = await Promise.all([
      mutatePhysicsLibrary(2, "project-a", current => renamePhysicsProject(current, "project-a", "First", 3), db.factory),
      mutatePhysicsLibrary(2, "project-a", current => renamePhysicsProject(current, "project-a", "Second", 4), db.factory),
    ]);
    expect(results.map(result => result.status).sort()).toEqual(["conflict", "saved"]);
    const saved = await readPhysicsLibrary(db.factory);
    expect(saved.status).toBe("ready");
    if (saved.status === "ready") expect(activePhysicsProject(saved.record.library)?.name).toMatch(/First|Second/);
  });

  it("does not commit rejected changes, reports aborted transactions, and validates expected inputs", async () => {
    const db = new MemoryIndexedDB();
    const initialized = await initializePhysicsLibrary(db.factory);
    if (initialized.status !== "ready") throw new Error("initialization failed");

    expect(await mutatePhysicsLibrary(1, null, () => null, db.factory)).toEqual({ status: "rejected" });
    expect(await mutatePhysicsLibrary(1, "wrong", () => emptyPhysicsLibrary(), db.factory)).toEqual({ status: "conflict" });
    expect(await mutatePhysicsLibrary(0, null, () => emptyPhysicsLibrary(), db.factory)).toEqual({ status: "invalid" });
    expect(await mutatePhysicsLibrary(1, null, () => emptyPhysicsLibrary(), null)).toEqual({ status: "unavailable" });

    db.abortNextCommit = true;
    expect(await mutatePhysicsLibrary(1, null,
      current => createPhysicsLibraryProject(current, "spring", 2, "aborted"), db.factory)).toEqual({ status: "unavailable" });
    const afterAbort = await readPhysicsLibrary(db.factory);
    expect(afterAbort.status).toBe("ready");
    if (afterAbort.status === "ready") expect(afterAbort.record.library.projects).toHaveLength(0);
  });

  it("rejects missing records without creating a hidden authority", async () => {
    const db = new MemoryIndexedDB();
    expect(await mutatePhysicsLibrary(1, null, current => current, db.factory)).toEqual({ status: "conflict" });
    expect(db.records.size).toBe(0);
  });
});

import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const DATABASE = "paramyra-studio-checkpoints";
const STORE = "snapshots";
const PHYSICS_KEY = "physics-library-live";
const LIVE_MATH_KEY = "studio-library-live";

type PhysicsProjectFixture = {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  unitPolicy: "SI";
  model: {
    kind: "projectile";
    modelVersion: 1;
    parameters: {
      mass: number; gravity: number; drag: number; initialX: number;
      initialY: number; velocityX: number; velocityY: number;
    };
  };
  simulation: {
    fixedTimeStep: number; duration: number; maximumSubsteps: number;
    sampleEvery: number; integrator: "symplectic-euler"; integratorVersion: 1;
  };
  scene: {
    dimension: 2; coordinateFrame: "x-right-y-up";
    camera: { x: number; y: number; zoom: number };
    showGrid: boolean; showVectors: boolean; showTrail: boolean;
  };
  labReport: { hypothesis: string; notes: string; conclusion: string };
};

const importedProject: PhysicsProjectFixture = {
  schemaVersion: 1,
  id: "physics-import-source",
  name: "Imported motion study",
  createdAt: 1,
  updatedAt: 1,
  unitPolicy: "SI",
  model: {
    kind: "projectile", modelVersion: 1,
    parameters: { mass: 1, gravity: 9.81, drag: 0, initialX: 0, initialY: 0, velocityX: 10, velocityY: 15 },
  },
  simulation: {
    fixedTimeStep: 1 / 120, duration: 10, maximumSubsteps: 1000,
    sampleEvery: 1, integrator: "symplectic-euler", integratorVersion: 1,
  },
  scene: {
    dimension: 2, coordinateFrame: "x-right-y-up", camera: { x: 0, y: 0, zoom: 1 },
    showGrid: true, showVectors: true, showTrail: true,
  },
  labReport: { hypothesis: "Imported hypothesis", notes: "Imported observation", conclusion: "Imported conclusion" },
};

async function physicsRecord(page: Page): Promise<unknown> {
  return page.evaluate(async ({ database, store, key }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(database, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const request = db.transaction(store, "readonly").objectStore(store).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }, { database: DATABASE, store: STORE, key: PHYSICS_KEY });
}

async function writeRecord(page: Page, value: unknown): Promise<void> {
  await page.evaluate(async ({ database, store, value }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(database, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(store, "readwrite");
        transaction.objectStore(store).put(value);
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
        transaction.onerror = () => reject(transaction.error);
      });
    } finally { db.close(); }
  }, { database: DATABASE, store: STORE, value });
}

async function allStorage(page: Page): Promise<{ local: Array<[string, string]>; liveMath: unknown }> {
  return page.evaluate(async ({ database, store, key }) => {
    const local: Array<[string, string]> = [];
    for (let index = 0; index < localStorage.length; index++) {
      const name = localStorage.key(index);
      if (name !== null) local.push([name, localStorage.getItem(name) ?? ""]);
    }
    local.sort(([a], [b]) => a.localeCompare(b));
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(database, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const liveMath = await new Promise<unknown>((resolve, reject) => {
        const request = db.transaction(store, "readonly").objectStore(store).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return { local, liveMath };
    } finally { db.close(); }
  }, { database: DATABASE, store: STORE, key: LIVE_MATH_KEY });
}

async function enableMathDurableMode(page: Page): Promise<void> {
  await page.goto("/studio");
  await expect(page.locator("#frequencyX")).toBeVisible();
  await page.getByRole("button", { name: "Open project library" }).click();
  const projects = page.getByRole("dialog", { name: "Studio project library" });
  await projects.locator(".pm-project-storage-preview summary").click();
  page.once("dialog", dialog => dialog.accept());
  await projects.getByRole("button", { name: "Enable transactional autosave" }).click();
  await expect(page.getByText("Saved in IndexedDB")).toBeVisible();
}

function byteText(path: string | null): Promise<string> {
  if (!path) throw new Error("Playwright did not provide a downloaded file path");
  return readFile(path, "utf8");
}

test("A project saves its report and replays the same independently checked trajectory", async ({ page }) => {
  await page.goto("/physics/projects");
  await page.getByRole("button", { name: "New Projectile Motion" }).click();
  await expect(page.getByLabel("Project name")).toHaveValue("Projectile Motion");
  await page.getByLabel("Hypothesis").fill("A higher launch speed increases horizontal range.");
  await page.getByLabel("Observations").fill("Recorded at the first fixed step.");
  await page.getByLabel("Conclusion").fill("The measured displacement follows the fixed-step update.");
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.getByText("Project saved to the local Physics library.")).toBeVisible();
  await expect(page.locator(".px-dirty-indicator")).toHaveText("Saved");

  const saved = await physicsRecord(page) as { revision: number; library: { projects: PhysicsProjectFixture[] } };
  expect(saved.revision).toBeGreaterThan(1);
  expect(saved.library.projects[0].labReport).toEqual({
    hypothesis: "A higher launch speed increases horizontal range.",
    notes: "Recorded at the first fixed step.",
    conclusion: "The measured displacement follows the fixed-step update.",
  });

  await page.reload();
  await expect(page.getByLabel("Hypothesis")).toHaveValue("A higher launch speed increases horizontal range.");
  await expect(page.getByLabel("Observations")).toHaveValue("Recorded at the first fixed step.");
  await page.getByRole("button", { name: "Step simulation forward" }).click();
  const firstStep = page.locator(".px-measurement-table tbody tr").filter({
    has: page.locator("th[scope='row']", { hasText: /^1$/ }),
  });
  await expect(firstStep).toHaveCount(1);
  const dt = 1 / 120;
  const expectedX = 10 * dt;
  const expectedY = (15 - 9.81 * dt) * dt;
  expect(Number(await firstStep.locator("td").nth(1).textContent())).toBeCloseTo(expectedX, 4);
  expect(Number(await firstStep.locator("td").nth(2).textContent())).toBeCloseTo(expectedY, 4);
  await expect(page.locator(".px-run-status")).toContainText("Step 1");
});

test("Physics projects can be renamed, duplicated, opened, and deleted independently", async ({ page }) => {
  await page.goto("/physics/projects");
  await page.getByRole("button", { name: "New Mass–Spring Oscillator" }).click();
  await expect(page.locator("#px-project-select option")).toHaveCount(1);
  page.once("dialog", dialog => dialog.accept("Torsion Lab"));
  await page.getByRole("button", { name: "Rename project" }).click();
  await expect(page.getByLabel("Project name")).toHaveValue("Torsion Lab");
  await page.getByRole("button", { name: "Duplicate project" }).click();
  await expect(page.locator("#px-project-select option")).toHaveCount(2);
  await expect(page.locator("#px-project-select")).toHaveValue(/physics-/);
  await expect(page.getByLabel("Project name")).toHaveValue("Torsion Lab Copy");

  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Delete project" }).click();
  await expect(page.locator("#px-project-select option")).toHaveCount(1);
  await expect(page.getByLabel("Project name")).toHaveValue("Torsion Lab");
  const saved = await physicsRecord(page) as { library: { projects: PhysicsProjectFixture[] } };
  expect(saved.library.projects.map(project => project.name)).toEqual(["Torsion Lab"]);
});

test("An empty Physics library can import a versioned project JSON", async ({ page }) => {
  await page.goto("/physics/projects");
  await expect(page.getByLabel("Import project JSON")).toBeAttached();
  await page.getByLabel("Import project JSON").setInputFiles({
    name: "physics-import.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(importedProject)),
  });
  await expect(page.getByRole("heading", { name: "Imported motion study" })).toBeVisible();
  await expect(page.getByLabel("Observations")).toHaveValue("Imported observation");
  const saved = await physicsRecord(page) as { library: { activeId: string; projects: PhysicsProjectFixture[] } };
  expect(saved.library.projects).toHaveLength(1);
  expect(saved.library.activeId).toBe(saved.library.projects[0].id);
  expect(saved.library.projects[0].id).not.toBe(importedProject.id);
});

test("Project JSON exports and imports preserve validated content with a fresh library identity", async ({ page }) => {
  await page.goto("/physics/projects");
  await page.getByRole("button", { name: "New Projectile Motion" }).click();
  await page.getByLabel("Hypothesis").fill("Compare the exported model with the imported model.");
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.locator(".px-dirty-indicator")).toHaveText("Saved");

  const exportPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export project JSON" }).click();
  const exported = await exportPromise;
  expect(exported.suggestedFilename()).toMatch(/\.json$/);
  const exportedProject = JSON.parse(await byteText(await exported.path())) as PhysicsProjectFixture;
  expect(exportedProject.schemaVersion).toBe(1);
  expect(exportedProject.unitPolicy).toBe("SI");
  expect(exportedProject.labReport.hypothesis).toBe("Compare the exported model with the imported model.");

  const source = { ...exportedProject, id: "physics-json-import-source" };
  const input = page.getByLabel("Import project JSON");
  await input.setInputFiles({ name: "round-trip.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(source)) });
  await expect(page.getByRole("heading", { name: "Projectile Motion" })).toBeVisible();
  await expect(page.getByLabel("Hypothesis")).toHaveValue("Compare the exported model with the imported model.");
  await expect.poll(async () => {
    const record = await physicsRecord(page) as { library: { projects: PhysicsProjectFixture[] } };
    return record.library.projects.length;
  }).toBe(2);
  const saved = await physicsRecord(page) as { library: { activeId: string; projects: PhysicsProjectFixture[] } };
  expect(saved.library.projects).toHaveLength(2);
  expect(saved.library.activeId).toBe(saved.library.projects[1].id);
  expect(saved.library.projects[1].id).not.toBe(source.id);

  const beforeInvalidImport = JSON.stringify(saved);
  const unsupported = { ...source, id: "physics-future-source", schemaVersion: 2 };
  await input.setInputFiles({ name: "future-project.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(unsupported)) });
  await expect(page.getByRole("status").filter({ hasText: "not a valid version 1 Physics project" })).toBeVisible();
  expect(JSON.stringify(await physicsRecord(page))).toBe(beforeInvalidImport);
});

test("A stale tab exports its draft before reloading a concurrent Physics library revision", async ({ context }) => {
  const first = await context.newPage();
  const second = await context.newPage();
  try {
    await first.goto("/physics/projects");
    await first.getByRole("button", { name: "New Projectile Motion" }).click();
    await first.getByLabel("Observations").fill("Unsaved tab-local measurement.");

    await second.goto("/physics/projects");
    await second.getByRole("button", { name: "New project", exact: true }).click();
    await expect.poll(async () => (await physicsRecord(second) as { revision: number }).revision).toBeGreaterThan(2);

    await first.getByRole("button", { name: "Save project" }).click();
    const conflict = first.getByRole("alert", { name: "Library conflict" });
    await expect(conflict).toBeVisible();
    const currentRecord = await physicsRecord(first) as { revision: number; library: { projects: PhysicsProjectFixture[] } };
    expect(currentRecord.revision).toBeGreaterThan(2);
    expect(currentRecord.library.projects[0].labReport.notes).toBe("");

    const draftPromise = first.waitForEvent("download");
    await conflict.getByRole("button", { name: "Export draft JSON" }).click();
    const draftDownload = await draftPromise;
    const draft = JSON.parse(await byteText(await draftDownload.path())) as PhysicsProjectFixture;
    expect(draft.labReport.notes).toBe("Unsaved tab-local measurement.");

    const reloadExportPromise = first.waitForEvent("download");
    await conflict.getByRole("button", { name: "Export draft & reload library" }).click();
    const reloadExport = await reloadExportPromise;
    const preservedDraft = JSON.parse(await byteText(await reloadExport.path())) as PhysicsProjectFixture;
    expect(preservedDraft.labReport.notes).toBe("Unsaved tab-local measurement.");
    await expect(first.locator(".px-conflict-panel")).toHaveCount(0);
    await expect(first.locator("#px-project-select option")).toHaveCount(2);
    const afterReload = await physicsRecord(first) as { library: { projects: PhysicsProjectFixture[] } };
    expect(afterReload.library.projects[0].labReport.notes).toBe("");
  } finally {
    await first.close();
    await second.close();
  }
});

test("Edits arriving during a save remain visible and can be committed in a second save", async ({ page }) => {
  await page.goto("/physics/projects");
  await page.getByRole("button", { name: "New Projectile Motion" }).click();
  const notes = page.getByLabel("Observations");
  await notes.fill("Snapshot at save start.");

  // Dispatch both events in one browser task: the save captures the first
  // snapshot, then a later edit arrives before IndexedDB can commit it.
  await page.evaluate(() => {
    const save = Array.from(document.querySelectorAll("button")).find(button => button.textContent?.includes("Save project"));
    const field = document.querySelector<HTMLTextAreaElement>("#px-notes");
    const setter = field && Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    save?.click();
    if (field && setter) {
      setter.call(field, "Latest edit during save.");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });

  await expect(notes).toHaveValue("Latest edit during save.");
  await expect(page.getByText("Project saved. Edits made during the save are still unsaved.")).toBeVisible();
  await expect(page.locator(".px-dirty-indicator")).toHaveText("Unsaved changes");
  let saved = await physicsRecord(page) as { library: { projects: PhysicsProjectFixture[] } };
  expect(saved.library.projects[0].labReport.notes).toBe("Snapshot at save start.");

  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.getByText("Project saved to the local Physics library.")).toBeVisible();
  saved = await physicsRecord(page) as { library: { projects: PhysicsProjectFixture[] } };
  expect(saved.library.projects[0].labReport.notes).toBe("Latest edit during save.");
});

test("Corrupt and future Physics records stay byte-for-byte intact beside legacy and opt-in Mathematics storage", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.locator("#frequencyX")).toBeVisible();
  let before = await allStorage(page);

  const assertPreserved = async (damage: "corrupt" | "future") => {
    const unsupportedRecord = damage === "future"
      ? { key: PHYSICS_KEY, version: 2, revision: 7, updatedAt: 123, library: { schemaVersion: 1, activeId: null, projects: [] } }
      : { key: PHYSICS_KEY, version: 1, revision: 7, updatedAt: 123, library: { schemaVersion: 1, activeId: "missing-project", projects: [] } };
    await writeRecord(page, unsupportedRecord);
    await page.goto("/physics/projects");
    await expect(page.getByRole("heading", { name: "Library needs recovery" })).toBeVisible();
    await expect(page.getByText("It has not been replaced.")).toBeVisible();
    expect(JSON.stringify(await physicsRecord(page))).toBe(JSON.stringify(unsupportedRecord));
    const after = await allStorage(page);
    expect(after.local).toEqual(before.local);
    expect(JSON.stringify(after.liveMath)).toBe(JSON.stringify(before.liveMath));
    await page.getByRole("button", { name: "Retry library read" }).click();
    await expect(page.getByRole("heading", { name: "Library needs recovery" })).toBeVisible();
    expect(JSON.stringify(await physicsRecord(page))).toBe(JSON.stringify(unsupportedRecord));
  };

  await assertPreserved("corrupt");
  await assertPreserved("future");

  await enableMathDurableMode(page);
  before = await allStorage(page);
  await assertPreserved("corrupt");
  await assertPreserved("future");
});

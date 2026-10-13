import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

function rowForStep(page: Page, step: number) {
  return page.locator(".px-measurement-table tbody tr").filter({
    has: page.locator("th[scope='row']", { hasText: new RegExp(`^${step}$`) }),
  });
}

async function seekToPercent(page: Page, percentage: number) {
  const slider = page.getByLabel("Simulation time");
  await slider.evaluate((element, value) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("Range input value setter is unavailable");
    setter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, percentage);
  await expect.poll(async () => ({
    status: (await page.locator(".px-run-status").textContent()) ?? "",
    diagnostic: (await page.locator(".px-alert").allTextContents()).join(" "),
  })).toMatchObject({ status: expect.stringContaining("Step 120") });
}

async function exportMeasurementSnapshot(page: Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export measurements JSON" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  return JSON.parse(await readFile(path!, "utf8")) as {
    samples: Array<{ step: number; position: { x: number; y: number }; velocity: { x: number; y: number } }>;
  };
}

test("Physics navigation opens a paused experiment and stays usable on mobile", async ({ page }, testInfo) => {
  await page.goto("/physics");
  const navigation = page.getByRole("navigation", { name: "Physics navigation" });
  await expect(navigation.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  await expect(navigation.getByRole("link", { name: "Gallery" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Playground" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Studio" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/physics/projects");
  await expect(page.getByRole("link", { name: "Switch to Paramyra Mathematics" })).toHaveAttribute("href", "/");

  await navigation.getByRole("link", { name: "Projects" }).click();
  await expect(page).toHaveURL(/\/physics\/projects$/);
  await expect(page.getByRole("heading", { name: "Your next experiment starts here." })).toBeVisible();
  await navigation.getByRole("link", { name: "Overview" }).click();
  await expect(page).toHaveURL(/\/physics$/);

  await navigation.getByRole("link", { name: "Gallery" }).click();
  await expect(page.getByRole("heading", { name: "Physics Gallery" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Projectile Motion" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mass–Spring Oscillator" })).toBeVisible();
  await page.getByRole("link", { name: "Open experiment" }).first().click();
  await expect(page).toHaveURL(/\/physics\/playground\?experiment=projectile$/);

  const status = page.locator(".px-run-status");
  await expect(status).toContainText("Ready");
  await expect(status).toContainText("0.000 s");
  await expect(status).toContainText("Step 0");
  await expect(page.getByRole("button", { name: "Run simulation" })).toBeEnabled();
  await page.waitForTimeout(180);
  await expect(status).toContainText("Step 0");

  if (testInfo.project.name === "mobile-chromium") {
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  }
  await page.screenshot({ path: testInfo.outputPath(`physics-playground-${testInfo.project.name}.png`), fullPage: true });
});

test("Projectile stepping matches the fixed-step solution and replays identically", async ({ page }) => {
  await page.goto("/physics/playground?experiment=projectile");
  await expect(page.locator(".px-run-status")).toContainText("Ready");

  await page.getByRole("button", { name: "Step simulation forward" }).click();
  const firstStep = rowForStep(page, 1);
  await expect(firstStep).toHaveCount(1);
  await expect(firstStep).toBeVisible();
  await expect(firstStep.locator("td").nth(0)).toHaveText("0.0083333");
  await expect(firstStep.locator("td").nth(1)).toHaveText("0.08333");
  expect(Number(await firstStep.locator("td").nth(2).textContent())).toBeCloseTo((15 - 9.81 / 120) / 120, 4);
  const expectedMeasurements = await firstStep.locator("td").allTextContents();

  await page.getByRole("button", { name: "Reset simulation" }).click();
  await expect(page.locator(".px-run-status")).toContainText("Step 0");
  await expect(rowForStep(page, 1)).toHaveCount(0);
  await page.getByRole("button", { name: "Step simulation forward" }).click();
  const replayedStep = rowForStep(page, 1);
  await expect(replayedStep).toHaveCount(1);
  await expect(replayedStep).toBeVisible();
  expect(await replayedStep.locator("td").allTextContents()).toEqual(expectedMeasurements);
});

test("An invalid model parameter keeps the last valid simulation state", async ({ page }) => {
  await page.goto("/physics/playground?experiment=projectile");
  await page.getByRole("button", { name: "Step simulation forward" }).click();
  const lastValidRow = rowForStep(page, 1);
  await expect(lastValidRow).toHaveCount(1);
  await expect(lastValidRow).toBeVisible();
  const expectedMeasurements = await lastValidRow.locator("td").allTextContents();

  const gravity = page.getByLabel("Gravity");
  await gravity.fill("200");
  await expect(page.locator(".px-field-error[role='alert']")).toContainText("Use 0 to 100 m/s²");
  await expect(gravity).toHaveAttribute("aria-invalid", "true");
  await gravity.blur();
  // Keep the invalid text visible as a repairable draft while the simulation
  // continues to use its last validated model snapshot.
  await expect(gravity).toHaveValue("200");
  await expect(page.locator(".px-run-status")).toContainText("Step 1");
  const retainedRow = rowForStep(page, 1);
  await expect(retainedRow).toBeVisible();
  expect(await retainedRow.locator("td").allTextContents()).toEqual(expectedMeasurements);
});

test("Camera controls change the view without advancing simulation time", async ({ page }) => {
  await page.goto("/physics/playground?experiment=projectile");
  const status = page.locator(".px-run-status");
  const canvas = page.getByRole("img", { name: "Projectile motion physics visualization" });
  await expect(canvas).toBeVisible();
  await canvas.focus();
  await canvas.press("+");
  await expect(page.getByLabel("Canvas zoom")).toHaveText("120%");
  await expect(status).toContainText("Step 0");
  await expect(status).toContainText("0.000 s");

  await page.getByRole("button", { name: "Step simulation forward" }).click();
  await expect(status).toContainText("Step 1");
  const measuredRow = rowForStep(page, 1);
  await expect(measuredRow).toBeVisible();
  const beforeCameraMove = await measuredRow.locator("td").allTextContents();
  await canvas.focus();
  await canvas.press("ArrowRight");
  await expect(status).toContainText("Step 1");
  await expect(measuredRow).toBeVisible();
  expect(await measuredRow.locator("td").allTextContents()).toEqual(beforeCameraMove);
});

test("The spring can run, pause, and reset to its initial displacement", async ({ page }) => {
  await page.goto("/physics/playground?experiment=spring");
  const status = page.locator(".px-run-status");
  const elapsed = page.locator(".px-timeline-control output");
  await expect(status).toContainText("Ready");

  await page.getByRole("button", { name: "Run simulation" }).click();
  await expect(status).toContainText("Running");
  await expect.poll(async () => Number.parseFloat((await elapsed.textContent())?.split(" ")[0] ?? "0")).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause simulation" }).click();
  await expect.poll(async () => ({
    status: (await status.textContent()) ?? "",
    diagnostic: (await page.locator(".px-alert").allTextContents()).join(" "),
  })).toMatchObject({ status: expect.stringContaining("Paused"), diagnostic: "" });
  const pausedTime = Number.parseFloat((await elapsed.textContent())?.split(" ")[0] ?? "0");
  expect(pausedTime).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Reset simulation" }).click();
  await expect(status).toContainText("Step 0");
  await expect(elapsed).toHaveText("0.000 s");
  const initial = rowForStep(page, 0);
  await expect(initial.locator("td").nth(1)).toHaveText("1");
});

test("Worker seek matches the damped spring solution and replays identical frames after reset", async ({ page }) => {
  await page.goto("/physics/playground?experiment=spring");
  await expect(page.locator(".px-run-status")).toContainText("Ready");
  await page.getByRole("button", { name: "Step simulation forward" }).click();
  await expect(page.locator(".px-run-status")).toContainText("Step 1");

  await seekToPercent(page, 100);
  const firstReplay = await exportMeasurementSnapshot(page);
  const firstFrame = firstReplay.samples.find(sample => sample.step === 120);
  expect(firstFrame).toBeDefined();
  const beta = 0.1;
  const naturalFrequency = 2;
  const dampedFrequency = Math.sqrt(naturalFrequency ** 2 - beta ** 2);
  const expectedPosition = Math.exp(-beta) * (
    Math.cos(dampedFrequency) + beta / dampedFrequency * Math.sin(dampedFrequency)
  );
  const expectedVelocity = -Math.exp(-beta) * naturalFrequency ** 2 / dampedFrequency * Math.sin(dampedFrequency);
  expect(Math.abs(firstFrame!.position.x - expectedPosition)).toBeLessThan(0.01);
  expect(Math.abs(firstFrame!.velocity.x - expectedVelocity)).toBeLessThan(0.001);

  await page.getByRole("button", { name: "Reset simulation" }).click();
  await expect(page.locator(".px-run-status")).toContainText("Step 0");
  await seekToPercent(page, 100);
  const secondReplay = await exportMeasurementSnapshot(page);
  expect(secondReplay.samples).toEqual(firstReplay.samples);
});

test("Physics Playground edits leave the Mathematics document unchanged", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.locator("#frequencyX")).toBeVisible();
  await page.locator("#frequencyX").focus();
  await page.locator("#frequencyX").press("End");
  await expect(page.locator("#frequencyX")).toHaveValue("12");
  const mathDocument = await page.evaluate(() => localStorage.getItem("paramyra.document.v3"));
  expect(mathDocument).toBeTruthy();

  await page.goto("/physics/playground?experiment=projectile");
  await page.getByLabel("Gravity").fill("5");
  await expect(page.getByLabel("Gravity")).toHaveValue("5");
  expect(await page.evaluate(() => localStorage.getItem("paramyra.document.v3"))).toBe(mathDocument);
  await expect(page.getByRole("link", { name: "Switch to Paramyra Mathematics" })).toHaveAttribute("href", "/");
});

test("Measurement exports include SI units and reproducible model provenance", async ({ page }) => {
  await page.goto("/physics/playground?experiment=projectile");
  await page.getByRole("button", { name: "Step simulation forward" }).click();
  await expect(rowForStep(page, 1)).toHaveCount(1);

  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export measurements CSV" }).click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);
  const csvPath = await csv.path();
  expect(csvPath).not.toBeNull();
  const csvText = await readFile(csvPath!, "utf8");
  expect(csvText).toContain("# format,paramyra.physics.measurements,1");
  expect(csvText).toContain('"Projectile Motion"');
  expect(csvText).toContain("# unitPolicy,SI");
  expect(csvText).toContain("step,time_s,x_m,y_m,vx_m_s,vy_m_s");
  expect(csvText).toContain("1,0.008333333333333333");

  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export measurements JSON" }).click();
  const jsonFile = await jsonDownload;
  expect(jsonFile.suggestedFilename()).toMatch(/\.json$/);
  const jsonPath = await jsonFile.path();
  expect(jsonPath).not.toBeNull();
  const snapshot = JSON.parse(await readFile(jsonPath!, "utf8")) as {
    format: string;
    schemaVersion: number;
    project: { model: { kind: string }; simulation: { integrator: string } };
    units: { position: string; force: string };
    samples: Array<{ step: number; position: { x: number; y: number } }>;
  };
  expect(snapshot.format).toBe("paramyra.physics.measurements");
  expect(snapshot.schemaVersion).toBe(1);
  expect(snapshot.project.model.kind).toBe("projectile");
  expect(snapshot.project.simulation.integrator).toBe("symplectic-euler");
  expect(snapshot.units).toMatchObject({ position: "m", force: "N" });
  expect(snapshot.samples.at(-1)).toMatchObject({ step: 1, position: { y: expect.any(Number) } });
  expect(snapshot.samples.at(-1)?.position.x).toBeCloseTo(10 / 120, 14);
  expect(snapshot.samples.at(-1)?.position.y).toBeCloseTo((15 - 9.81 / 120) / 120, 14);
});

test("An unavailable project store leaves the temporary experiment exportable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { configurable: true, get: () => undefined });
  });
  await page.goto("/physics/playground?experiment=projectile");
  const gravity = page.getByLabel("Gravity (m/s²)");
  await gravity.fill("7.5");
  await gravity.blur();
  await expect(gravity).toHaveValue("7.5");
  await page.getByRole("button", { name: "Save to Studio" }).click();
  await expect(page.getByText(/Physics project storage is unavailable/)).toBeVisible();

  const projectDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export project JSON" }).click();
  const projectDownload = await projectDownloadPromise;
  const projectPath = await projectDownload.path();
  expect(projectPath).not.toBeNull();
  const project = JSON.parse(await readFile(projectPath!, "utf8")) as {
    schemaVersion: number; model: { kind: string; parameters: { gravity: number } };
  };
  expect(project.schemaVersion).toBe(1);
  expect(project.model.kind).toBe("projectile");
  expect(project.model.parameters.gravity).toBe(7.5);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export measurements JSON" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const data = JSON.parse(await readFile(path!, "utf8")) as { format: string; project: { model: { kind: string } } };
  expect(data.format).toBe("paramyra.physics.measurements");
  expect(data.project.model.kind).toBe("projectile");
});

test("A blocked worker reports the failure and initializes cleanly after recovery", async ({ page }) => {
  await page.addInitScript(() => {
    const modeKey = "__physics-worker-test-mode";
    Object.defineProperty(window, "__physics-native-worker", { configurable: true, value: window.Worker });
    if (sessionStorage.getItem(modeKey) === null) sessionStorage.setItem(modeKey, "fail");
    if (sessionStorage.getItem(modeKey) === "fail") {
      Object.defineProperty(window, "Worker", {
        configurable: true,
        writable: true,
        value: class { constructor() { throw new Error("blocked by acceptance test"); } },
      });
    }
  });
  await page.goto("/physics/playground?experiment=projectile");
  await expect(page.locator(".px-alert[role='alert']")).toContainText("Physics worker could not start");

  await page.evaluate(() => sessionStorage.setItem("__physics-worker-test-mode", "recover"));
  await page.evaluate(() => {
    const nativeWorker = Reflect.get(window, "__physics-native-worker") as typeof Worker | undefined;
    if (nativeWorker) Object.defineProperty(window, "Worker", { configurable: true, writable: true, value: nativeWorker });
  });
  await page.getByRole("button", { name: "Retry simulation worker" }).click();
  await expect(page.locator(".px-run-status")).toContainText("Ready");
  await page.getByRole("button", { name: "Step simulation forward" }).click();
  await expect(rowForStep(page, 1)).toHaveCount(1);
});

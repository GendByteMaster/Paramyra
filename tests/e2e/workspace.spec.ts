import { expect, test } from "@playwright/test";

test("gallery opens its scene in the shared editor", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: /Mathematical gallery/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Polar Rose" })).toBeVisible();
  await page.getByRole("link", { name: "Edit Polar Rose" }).click();
  await expect(page).toHaveURL(/\/studio\?kind=polar-rose$/);
  await expect(page.getByRole("heading", { name: /mathematical studio/i })).toBeVisible();
  await expect(page.locator("#scene-kind")).toHaveValue("polar-rose");
});

test("parameters remain saved after reload", async ({ page }) => {
  await page.goto("/studio");
  const slider = page.locator("#frequencyX");
  await expect(slider).toBeVisible();
  await slider.focus();
  await slider.press("End");
  await expect(slider).toHaveValue("12");
  await page.reload();
  await expect(page.locator("#frequencyX")).toHaveValue("12");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("#frequencyX")).toHaveValue("3");
});

test("play, pause and safe JSON validation", async ({ page }) => {
  await page.goto("/playground");
  await expect(page.getByRole("button", { name: "Pause animation" })).toBeVisible();
  await page.getByRole("button", { name: "Pause animation" }).click();
  await expect(page.getByRole("button", { name: "Play animation" })).toBeVisible();
  await page.getByRole("button", { name: "Play animation" }).click();
  await expect(page.getByRole("button", { name: "Pause animation" })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":1,"id":"wrong","title":"Invalid","kind":"lissajous","params":{"frequencyX":999}}'),
  });
  await expect(page.locator("p.status[role=status]")).toContainText("Invalid or unsupported scene document.");
});

test("reduced motion and narrow viewport keep the core UI usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: /mathematical studio/i })).toBeVisible();
  await expect(page.getByRole("img", { name: /Visualization of/ })).toBeVisible();
  await expect(page.locator("#scene-kind")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("home presents a functional gallery and workspace entry", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Shape the invisible/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open the Studio/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Harmonic Waves" })).toBeVisible();
  await page.getByRole("link", { name: /Open the Studio/ }).click();
  await expect(page).toHaveURL(/\/studio$/);
});

test("quick scene switch updates the inspector", async ({ page }) => {
  await page.goto("/studio");
  const library = page.getByRole("complementary", { name: "Scene library" });
  const openLibrary = async () => {
    if (!(await library.isVisible())) await page.getByRole("button", { name: "Toggle scene library" }).click();
  };
  await openLibrary();
  await library.getByRole("button", { name: /Polar Rose/ }).click();
  await expect(page.locator("#scene-kind")).toHaveValue("polar-rose");
  await expect(page.getByText("r = A cos(kθ)").first()).toBeVisible();
  await openLibrary();
  await library.getByRole("button", { name: /Harmonic Waves/ }).click();
  await expect(page.locator("#scene-kind")).toHaveValue("wave");
});

test("workspace tools have real behavior", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: /mathematical studio/i })).toBeVisible();

  await expect(page.getByLabel("Zoom level")).toHaveText("100%");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByLabel("Zoom level")).toHaveText("125%");
  await page.getByRole("button", { name: "Reset zoom" }).click();
  await expect(page.getByLabel("Zoom level")).toHaveText("100%");

  await page.getByRole("tab", { name: "Scene JSON" }).click();
  await expect(page.getByRole("tabpanel")).toContainText('"schemaVersion": 1');
  await page.getByRole("tab", { name: "Overview" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Amplitude");

  await page.getByRole("button", { name: "Toggle inspector" }).click();
  await expect(page.getByRole("complementary", { name: "Scene inspector" })).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle inspector" }).click();
  await expect(page.getByRole("complementary", { name: "Scene inspector" })).toBeVisible();
});

test("scene search filters only real registered presets", async ({ page }) => {
  await page.goto("/studio");
  const library = page.getByRole("complementary", { name: "Scene library" });
  if (!(await library.isVisible())) await page.getByRole("button", { name: "Toggle scene library" }).click();
  await page.getByRole("searchbox", { name: "Search mathematical scenes" }).fill("rose");
  await expect(library.getByRole("button", { name: /Polar Rose/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /Harmonic Waves/ })).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Search mathematical scenes" }).fill("missing scene");
  await expect(library.getByText("No scenes match your search.")).toBeVisible();
});


test("desktop studio uses viewport height without header overlap or page scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.goto("/studio");
  await expect(page.locator(".pm-projectbar")).toBeVisible();
  await expect(page.locator(".pm-viewport-panel")).toBeVisible();
  await expect(page.locator(".pm-inspector")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const bar = document.querySelector(".pm-projectbar")!.getBoundingClientRect();
    const viewport = document.querySelector(".pm-canvas-area")!.getBoundingClientRect();
    const inspector = document.querySelector(".pm-inspector")!.getBoundingClientRect();
    const canvas = document.querySelector<HTMLCanvasElement>(".pm-canvas-area canvas")!.getBoundingClientRect();
    return {
      pageHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
      headerVisible: getComputedStyle(document.querySelector(".topbar")!).display !== "none",
      footerVisible: getComputedStyle(document.querySelector("footer")!).display !== "none",
      projectBarTop: bar.top,
      viewportHeight: viewport.height,
      inspectorBottom: inspector.bottom,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    };
  });
  expect(metrics.headerVisible).toBe(false);
  expect(metrics.footerVisible).toBe(false);
  expect(metrics.pageHeight).toBeLessThanOrEqual(metrics.innerHeight + 2);
  expect(metrics.projectBarTop).toBeGreaterThanOrEqual(0);
  expect(metrics.viewportHeight).toBeGreaterThan(200);
  expect(metrics.canvasWidth).toBeGreaterThan(200);
  expect(metrics.canvasHeight).toBeGreaterThan(200);
  expect(metrics.inspectorBottom).toBeLessThanOrEqual(metrics.innerHeight + 2);
});

test("mobile library opens as dismissible drawer and does not occlude the canvas when closed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/studio");
  const toggle = page.getByRole("button", { name: "Toggle scene library" });
  const library = page.getByRole("complementary", { name: "Scene library" });
  await expect(library).toHaveCount(0);
  await toggle.click();
  await expect(library).toBeVisible();
  await expect(page.getByRole("button", { name: "Close scene library" })).toBeVisible();
  await page.getByRole("button", { name: "Close scene library" }).click({ position: { x: 350, y: 300 } });
  await expect(library).toHaveCount(0);
  await expect(page.getByRole("img", { name: /Visualization of/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("paused viewport never claims that animation is live", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.locator(".pm-live")).toContainText("LIVE");
  await page.getByRole("button", { name: "Pause animation" }).click();
  await expect(page.locator(".pm-live")).toContainText("PAUSED");
  await page.getByRole("button", { name: "Play animation" }).click();
  await expect(page.locator(".pm-live")).toContainText("LIVE");
});


test("editor sliders are thin and exact parameter inputs are editable", async ({ page }) => {
  await page.goto("/studio");
  const slider = page.locator("#frequencyX");
  const input = page.getByRole("spinbutton", { name: "Set Frequency X numerically" });
  await expect(input).toHaveValue("3");
  await input.fill("8");
  await input.press("Enter");
  await expect(slider).toHaveValue("8");
  await expect(page.getByRole("tabpanel")).toContainText("8 : 4");
  const geometry = await slider.evaluate((el) => {
    const style = getComputedStyle(el);
    return { height: el.getBoundingClientRect().height, appearance: style.appearance, backgroundImage: style.backgroundImage };
  });
  expect(geometry.height).toBeLessThan(38);
  expect(geometry.appearance).toBe("none");
  expect(geometry.backgroundImage).toContain("gradient");
});

test("polar rose only exposes parameters that affect its curve", async ({ page }) => {
  await page.goto("/studio?kind=polar-rose");
  await expect(page.getByRole("slider", { name: "Symmetry (k)" })).toBeVisible();
  await expect(page.locator("#frequencyY")).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Scene inspector" })).toContainText("Petals from a single equation");
  await expect(page.getByRole("tabpanel")).toContainText("Petal count");
  await page.getByRole("spinbutton", { name: "Set Symmetry (k) numerically" }).fill("6");
  await page.getByRole("spinbutton", { name: "Set Symmetry (k) numerically" }).press("Enter");
  await expect(page.getByRole("tabpanel")).toContainText("12");
});

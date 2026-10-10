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
  await expect(page.getByRole("tabpanel")).toContainText('"schemaVersion": 2');
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
  const symmetry = page.getByRole("spinbutton", { name: "Set Symmetry (k) numerically" });
  await symmetry.fill("6.4");
  await symmetry.press("Enter");
  await expect(symmetry).toHaveValue("6");
  await expect(page.getByRole("tabpanel")).toContainText("12");
});


test("Studio occupies the full browser width while keeping the viewport and side tools usable", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/studio");
  await expect(page.locator(".pm-workspace")).toBeVisible();
  await expect(page.locator(".pm-sidebar")).toBeVisible();
  await expect(page.locator(".pm-inspector")).toBeVisible();
  const layout = await page.evaluate(() => {
    const root = document.querySelector(".pm-workspace")!.getBoundingClientRect();
    const left = document.querySelector(".pm-sidebar")!.getBoundingClientRect();
    const right = document.querySelector(".pm-inspector")!.getBoundingClientRect();
    const canvas = document.querySelector(".pm-canvas-area")!.getBoundingClientRect();
    const details = document.querySelector(".pm-details")!.getBoundingClientRect();
    return { rootLeft: root.left, rootRight: root.right, rootWidth: root.width, leftWidth: left.width, rightWidth: right.width, canvasWidth: canvas.width, detailsHeight: details.height };
  });
  expect(layout.rootLeft).toBeLessThan(13);
  expect(layout.rootRight).toBeGreaterThan(1907);
  expect(layout.leftWidth).toBeGreaterThanOrEqual(280);
  expect(layout.rightWidth).toBeGreaterThanOrEqual(370);
  expect(layout.canvasWidth).toBeGreaterThan(850);
  expect(layout.detailsHeight).toBeLessThan(225);
});

test("fullscreen button enters and exits real browser fullscreen when supported", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Chromium-only fullscreen contract");
  await page.goto("/studio");
  const enter = page.getByRole("button", { name: "Enter fullscreen" });
  await expect(enter).toBeVisible();
  const isSupported = await page.evaluate(() => typeof document.documentElement.requestFullscreen === "function");
  test.skip(!isSupported, "Fullscreen API is not supported");
  await enter.click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await expect(page.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
  await page.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
});

test("wave renderer preserves smooth geometry when zoomed", async ({ page }) => {
  await page.goto("/studio?kind=wave");
  const canvas = page.locator(".pm-canvas-area canvas");
  await expect(canvas).toBeVisible();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByLabel("Zoom level")).toHaveText("125%");
  const resolution = await canvas.evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    return { cssWidth: canvas.getBoundingClientRect().width, bitmapWidth: canvas.width };
  });
  expect(resolution.bitmapWidth).toBeGreaterThanOrEqual(Math.round(resolution.cssWidth));
});


test("v1 scene import migrates to v2 and can be exported without losing parameters", async ({ page }) => {
  await page.goto("/studio");
  await page.locator('input[type="file"]').setInputFiles({
    name: "legacy.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      schemaVersion: 1, id: "legacy", title: "Migrated",
      kind: "lissajous", params: { frequencyX: 8, frequencyY: 4, phase: .5, amplitude: .7, strokeWidth: 2 },
    })),
  });
  await expect(page.locator("#frequencyX")).toHaveValue("8");
  await page.getByRole("tab", { name: "Scene JSON" }).click();
  await expect(page.getByRole("tabpanel")).toContainText('"schemaVersion": 2');
  await expect(page.getByRole("tabpanel")).toContainText('"frequencyX": 8');
});

test("layers are real composited objects and undo/redo is stable", async ({ page }) => {
  await page.goto("/studio");
  const library = page.getByRole("complementary", { name: "Scene library" });
  if (!(await library.isVisible())) await page.getByRole("button", { name: "Toggle scene library" }).click();
  await library.getByRole("button", { name: "Add layer" }).click();
  await expect(page.locator(".pm-layer-row")).toHaveCount(2);
  await expect(page.locator(".pm-viewport-heading")).toContainText("2 layers");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".pm-layer-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.locator(".pm-layer-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Duplicate layer" }).click();
  await expect(page.locator(".pm-layer-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Delete layer" }).click();
  await expect(page.locator(".pm-layer-row")).toHaveCount(2);
});

test("timeline, camera tools and custom presets are interactive", async ({ page }) => {
  await page.goto("/studio");
  await page.getByRole("button", { name: "Pause animation" }).click();
  const timeline = page.getByRole("slider", { name: "Timeline position" });
  await timeline.focus();
  await timeline.press("End");
  await expect(page.locator(".pm-timeline output")).toContainText("12.0");
  await page.getByRole("combobox", { name: "Playback speed" }).selectOption("2");
  await page.getByRole("button", { name: "Toggle grid" }).click();
  await expect(page.getByRole("button", { name: "Toggle grid" })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Fit scene" }).click();
  await expect(page.getByLabel("Zoom level")).toHaveText("100%");
  const library = page.getByRole("complementary", { name: "Scene library" });
  if (!(await library.isVisible())) await page.getByRole("button", { name: "Toggle scene library" }).click();
  await library.getByRole("textbox", { name: "Preset name" }).fill("My composition");
  await library.getByRole("button", { name: "Save" }).click();
  await expect(library.getByRole("button", { name: "My composition" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("complementary", { name: "Scene library" }).getByRole("button", { name: "My composition" })).toBeVisible();
});

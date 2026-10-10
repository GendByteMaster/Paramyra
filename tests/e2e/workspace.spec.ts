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

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
  await page.getByRole("button", { name: "Reset" }).click();
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
  await page.getByRole("button", { name: /Polar Rose/ }).click();
  await expect(page.locator("#scene-kind")).toHaveValue("polar-rose");
  await expect(page.getByText("r = a cos(kθ)").first()).toBeVisible();
  await page.getByRole("button", { name: /Harmonic Waves/ }).click();
  await expect(page.locator("#scene-kind")).toHaveValue("wave");
});

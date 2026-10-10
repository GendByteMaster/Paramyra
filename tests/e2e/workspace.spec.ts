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
  await page.getByRole("button", { name: "Reset layer", exact: true }).click();
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
  await expect(page.getByRole("tabpanel")).toContainText('"schemaVersion": 3');
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
  await expect(page.getByRole("complementary", { name: "Scene inspector" })).toContainText("symmetry parameter controls the petals");
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
  await expect(page.getByRole("tabpanel")).toContainText('"schemaVersion": 3');
  await expect(page.getByRole("tabpanel")).toContainText('"frequencyX": 8');
});

test("layers are real composited objects and undo/redo is stable", async ({ page }) => {
  await page.goto("/studio");
  const library = page.getByRole("complementary", { name: "Scene library" });
  if (!(await library.isVisible())) await page.getByRole("button", { name: "Toggle scene library" }).click();
  await library.getByRole("button", { name: "Add layer" }).click();
  await expect(page.locator(".pm-layer-row")).toHaveCount(2);
  await expect(page.locator(".pm-viewport-heading")).toContainText("2 layers");
  // The mobile Library is a modal drawer; close it before operating the top toolbar.
  if (await page.getByRole("button", { name: "Close scene library" }).isVisible()) {
    await page.getByRole("button", { name: "Close scene library" }).click({ position: { x: 350, y: 300 } });
  }
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".pm-viewport-heading")).toContainText("1 layers");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.locator(".pm-viewport-heading")).toContainText("2 layers");
  await page.getByRole("button", { name: "Duplicate layer" }).click();
  await expect(page.locator(".pm-viewport-heading")).toContainText("3 layers");
  await page.getByRole("button", { name: "Delete layer", exact: true }).click();
  await expect(page.locator(".pm-viewport-heading")).toContainText("2 layers");
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
  await expect(page.getByLabel("Zoom level")).toContainText("%");
  const library = page.getByRole("complementary", { name: "Scene library" });
  if (!(await library.isVisible())) await page.getByRole("button", { name: "Toggle scene library" }).click();
  await library.getByRole("textbox", { name: "Preset name" }).fill("My composition");
  await library.getByRole("button", { name: "Save" }).click();
  await expect(library.getByRole("button", { name: "My composition", exact: true })).toBeVisible();
  await page.reload();
  const reloadedLibrary = page.getByRole("complementary", { name: "Scene library" });
  if (!(await reloadedLibrary.isVisible())) await page.getByRole("button", { name: "Toggle scene library" }).click();
  await expect(reloadedLibrary.getByRole("button", { name: "My composition", exact: true })).toBeVisible();
});


test("professional canvas selects and moves a mathematical layer with Undo", async ({ page }) => {
  await page.goto("/studio");
  await page.getByRole("button", { name: "Pause animation" }).click();
  const canvas = page.locator(".pm-canvas-area canvas");
  await expect(canvas).toBeVisible();
  const point = await canvas.evaluate(node => {
    const rect = node.getBoundingClientRect();
    const raw = localStorage.getItem("paramyra.document.v3");
    if (!raw) throw new Error("Missing scene");
    const layer = JSON.parse(raw).layers[0];
    const radius = Math.min(rect.width, rect.height) * .45;
    return { x: rect.left + rect.width/2 + Math.sin(layer.params.phase) * layer.params.amplitude * radius,
      y: rect.top + rect.height/2 };
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 20, point.y - 10, { steps: 3 });
  await page.waitForTimeout(650); // One drag is one undo step, even beyond 500ms.
  await page.mouse.move(point.x + 55, point.y - 25, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].offset.x)).toBeGreaterThan(0.1);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].offset.x)).toBe(0);
});

test("reset layer preserves the other layers in a composition", async ({ page }) => {
  await page.goto("/studio");
  const library = page.getByRole("complementary", { name: "Scene library" });
  if (!(await library.isVisible())) await page.getByRole("button", { name: "Toggle scene library" }).click();
  await library.getByRole("button", { name: "Add layer" }).click();
  await expect(page.locator(".pm-layer-row")).toHaveCount(2);
  if (await page.getByRole("button", { name: "Close scene library" }).isVisible()) {
    await page.getByRole("button", { name: "Close scene library" }).click({ position: { x: 350, y: 300 } });
  }
  await page.getByRole("button", { name: "Reset layer" }).click();
  await expect(page.locator(".pm-viewport-heading")).toContainText("2 layers");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers.length)).toBe(2);
});

test("canvas tools toggle between selection and pan", async ({ page }) => {
  await page.goto("/studio");
  const select = page.getByRole("button", { name: "Select and move curve" });
  const pan = page.getByRole("button", { name: "Pan canvas" });
  await expect(select).toHaveAttribute("aria-pressed", "true");
  await pan.click();
  await expect(pan).toHaveAttribute("aria-pressed", "true");
  await select.click();
  await expect(select).toHaveAttribute("aria-pressed", "true");
});


test("custom formula can be added, edited and persisted", async ({ page }) => {
  await page.goto("/studio");
  const library=page.getByRole("complementary",{name:"Scene library"});
  if(!(await library.isVisible()))await page.getByRole("button",{name:"Toggle scene library"}).click();
  await library.getByRole("combobox",{name:"New layer kind"}).selectOption("formula");
  await library.getByRole("button",{name:"Add layer"}).click();
  await expect(page.getByRole("combobox",{name:"Mathematical form"})).toHaveValue("formula");
  if(await page.getByRole("button",{name:"Close scene library"}).isVisible()){
    await page.getByRole("button",{name:"Close scene library"}).click({position:{x:350,y:300}});
  }
  const formula=page.getByRole("textbox",{name:"Formula Y expression"});
  await formula.fill("a*cos(b*x+t)");
  await expect(page.locator(".pm-formula-feedback")).toContainText("Valid expression");
  await page.getByRole("slider",{name:"Formula parameter a"}).focus();
  await page.getByRole("slider",{name:"Formula parameter a"}).press("ArrowRight");
  await expect.poll(()=>page.evaluate(()=>{
    const value=JSON.parse(localStorage.getItem("paramyra.document.v3")!);
    return value.layers[1].formula.exprY;
  })).toBe("a*cos(b*x+t)");
  await page.reload();
  const restoredLibrary=page.getByRole("complementary",{name:"Scene library"});
  if(!(await restoredLibrary.isVisible()))await page.getByRole("button",{name:"Toggle scene library"}).click();
  await restoredLibrary.getByRole("button",{name:"Select layer Custom Formula"}).click();
  if(await page.getByRole("button",{name:"Close scene library"}).isVisible()){
    await page.getByRole("button",{name:"Close scene library"}).click({position:{x:350,y:300}});
  }
  await expect(page.getByRole("textbox",{name:"Formula Y expression"})).toHaveValue("a*cos(b*x+t)");
  await expect(page.getByRole("slider",{name:"Formula parameter a"})).toHaveValue("1.1");
});

test("unsafe expression stays in draft; committed document remains valid", async ({page}) => {
  await page.goto("/studio");
  await page.getByRole("combobox",{name:"Mathematical form"}).selectOption("formula");
  const expr=page.getByRole("textbox",{name:"Formula Y expression"});
  await expr.fill("process.exit(1)");
  await expect(page.locator(".pm-formula-feedback")).toContainText(/unknown function|unsupported|invalid/i);
  await expect(expr).toHaveAttribute("aria-invalid","true");
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].formula.exprY);
  expect(saved).toBe("a*sin(b*x+t)");
  await expr.fill("sin(x)");
  await expect(expr).toHaveAttribute("aria-invalid","false");
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].formula.exprY)).toBe("sin(x)");
});

test("v2 multilayer JSON import migrates into v3 formula-capable project", async ({page}) => {
  await page.goto("/studio");
  await page.locator('input[type="file"]').setInputFiles({
    name:"v2.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify({schemaVersion:2,id:"saved",title:"Old Composition",duration:12,
      layers:[{id:"old",title:"Old",kind:"lissajous",
        params:{frequencyX:3,frequencyY:4,phase:0.2,amplitude:0.8,strokeWidth:1.6},
        visible:true,color:"#a9b8ff",opacity:1,offset:{x:1,y:0}}]})),
  });
  await page.getByRole("tab",{name:"Scene JSON"}).click();
  await expect(page.getByRole("tabpanel")).toContainText('"schemaVersion": 3');
  await expect(page.getByRole("tabpanel")).toContainText('"x": 1');
});


test("formula shortcut reveals the editor without replacing existing layers", async ({ page }) => {
  await page.goto("/studio");
  const library=page.getByRole("complementary",{name:"Scene library"});
  if(!(await library.isVisible()))await page.getByRole("button",{name:"Toggle scene library"}).click();
  await library.getByRole("button",{name:"Add formula layer"}).click();
  await expect(page.locator(".pm-viewport-heading")).toContainText("2 layers");
  await expect(page.getByRole("combobox",{name:"Mathematical form"})).toHaveValue("formula");
  await expect(page.getByRole("textbox",{name:"Formula Y expression"})).toHaveValue("a*sin(b*x+t)");
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers.length)).toBe(2);
});

test("inline delete removes an arbitrary unselected layer, then Undo and Redo restore history", async ({ page }) => {
  await page.goto("/studio");
  const library=page.getByRole("complementary",{name:"Scene library"});
  if(!(await library.isVisible()))await page.getByRole("button",{name:"Toggle scene library"}).click();
  await library.getByRole("button",{name:"Add formula layer"}).click();
  if(!(await library.isVisible()))await page.getByRole("button",{name:"Toggle scene library"}).click();
  await library.getByRole("button",{name:"Delete layer Lissajous Curves"}).click();
  await expect(library.locator(".pm-layer-row")).toHaveCount(1);
  await expect(page.getByRole("combobox",{name:"Mathematical form"})).toHaveValue("formula");
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers.map((l:{kind:string})=>l.kind))).toEqual(["formula"]);
  if(await page.getByRole("button",{name:"Close scene library"}).isVisible()){
    await page.getByRole("button",{name:"Close scene library"}).click({position:{x:350,y:300}});
  }
  await page.getByRole("button",{name:"Undo"}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers.length)).toBe(2);
  await page.getByRole("button",{name:"Redo"}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers.length)).toBe(1);
  await page.reload();
  await expect(page.locator(".pm-viewport-heading")).toContainText("1 layers");
});

test("deleting the selected layer selects an adjacent layer and protects the last layer", async ({ page }) => {
  await page.goto("/studio");
  const library=page.getByRole("complementary",{name:"Scene library"});
  if(!(await library.isVisible()))await page.getByRole("button",{name:"Toggle scene library"}).click();
  await library.getByRole("button",{name:"Add layer"}).click();
  await expect(page.getByRole("combobox",{name:"Mathematical form"})).toHaveValue("polar-rose");
  await library.getByRole("button",{name:"Delete layer Polar Rose"}).click();
  await expect(library.locator(".pm-layer-row")).toHaveCount(1);
  await expect(page.getByRole("combobox",{name:"Mathematical form"})).toHaveValue("lissajous");
  await expect(library.getByRole("button",{name:"Delete layer Lissajous Curves"})).toBeDisabled();
  if(await page.getByRole("button",{name:"Close scene library"}).isVisible()){
    await page.getByRole("button",{name:"Close scene library"}).click({position:{x:350,y:300}});
  }
  await expect(page.getByRole("button",{name:"Delete layer",exact:true})).toBeDisabled();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers.length)).toBe(1);
});


test("Undo after creating a selected layer keeps Canvas and Inspector selection coherent", async ({ page }) => {
  await page.goto("/studio");
  const library = page.getByRole("complementary", {name:"Scene library"});
  if (!(await library.isVisible())) await page.getByRole("button", {name:"Toggle scene library"}).click();
  await library.getByRole("button", {name:"Add formula layer"}).click();
  await expect(page.getByRole("combobox", {name:"Mathematical form"})).toHaveValue("formula");
  if(await page.getByRole("button", {name:"Close scene library"}).isVisible()){
    await page.getByRole("button", {name:"Close scene library"}).click({position:{x:350,y:300}});
  }
  await page.getByRole("button", {name:"Undo"}).click();
  await expect(page.getByRole("combobox", {name:"Mathematical form"})).toHaveValue("lissajous");
  await expect(page.locator(".pm-viewport-heading")).toContainText("1 layers");
  if (!(await library.isVisible())) await page.getByRole("button", {name:"Toggle scene library"}).click();
  await expect(library.getByRole("button",{name:"Select layer Lissajous Curves"})).toHaveAttribute("aria-pressed","true");
  await expect(library.locator(".pm-layer-row.selected")).toHaveCount(1);
});

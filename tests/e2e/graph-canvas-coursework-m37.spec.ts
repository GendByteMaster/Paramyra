import { expect, test } from "@playwright/test";

test("Quick Add is anchored inside the canvas at the right-click location", async ({page}) => {
  await page.goto("/studio/graph");
  const pane = page.locator(".react-flow__pane");
  await expect(pane).toBeVisible();
  const bounds = await pane.boundingBox();
  expect(bounds).not.toBeNull();
  await pane.click({button:"right",position:{x:130,y:110}});
  const palette = page.getByRole("dialog",{name:"Add graph node"});
  await expect(palette).toBeVisible();
  const menu = await palette.boundingBox();
  expect(menu).not.toBeNull();
  expect(menu!.x).toBeGreaterThanOrEqual(bounds!.x);
  expect(menu!.y).toBeGreaterThanOrEqual(bounds!.y);
  expect(menu!.y).toBeLessThan(bounds!.y+220);
  expect(menu!.x+menu!.width).toBeLessThanOrEqual(bounds!.x+bounds!.width+2);
  expect(menu!.y+menu!.height).toBeLessThanOrEqual(bounds!.y+bounds!.height+2);
});

test("Quick Add stays fully visible when opened against the canvas bottom-right", async ({page}) => {
  await page.goto("/studio/graph");
  const pane = page.locator(".react-flow__pane");
  const rect=await pane.boundingBox();
  expect(rect).not.toBeNull();
  await pane.click({button:"right",position:{x:rect!.width-25,y:rect!.height-22}});
  const popup = page.getByRole("dialog",{name:"Add graph node"});
  await expect(popup).toBeVisible();
  const bounds=await popup.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(rect!.x);
  expect(bounds!.y).toBeGreaterThanOrEqual(rect!.y);
  expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(rect!.x+rect!.width+2);
  expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(rect!.y+rect!.height+2);
});

test("Light canvas changes canvas colors without changing graph data and persists on reload",async({page})=>{
  await page.goto("/studio/graph");
  const before = await page.evaluate(()=>localStorage.getItem("paramyra.nodegraph.v3"));
  const toggle = page.getByRole("button",{name:"Switch to light canvas"});
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator(".pm-ng-reactflow-shell")).toHaveClass(/pm-ng-canvas-light/);
  await expect(page.getByRole("button",{name:"Switch to dark canvas"})).toHaveAttribute("aria-pressed","true");
  await expect(page.getByRole("article",{name:"Amplitude node"})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem("paramyra.graph.canvas-light.v1"))).toBe("true");
  expect(await page.evaluate(()=>localStorage.getItem("paramyra.nodegraph.v3"))).toBe(before);
  await page.reload();
  await expect(page.locator(".pm-ng-reactflow-shell")).toHaveClass(/pm-ng-canvas-light/);
  await page.getByRole("button",{name:"Switch to dark canvas"}).click();
  await expect(page.locator(".pm-ng-reactflow-shell")).not.toHaveClass(/pm-ng-canvas-light/);
});

test("Coursework is a distinct editable and printable workspace backed by the real graph",async({page})=>{
  await page.goto("/studio/graph");
  const graphBefore=await page.evaluate(()=>localStorage.getItem("paramyra.nodegraph.v3"));
  await page.getByRole("button",{name:"Open coursework mode"}).click();
  const editor=page.getByRole("complementary",{name:"Настройки курсовой"});
  const report=page.getByLabel("Предпросмотр курсовой работы");
  await expect(editor).toBeVisible();
  await expect(report).toBeVisible();
  await expect(page.locator(".react-flow__pane")).toHaveCount(0);
  await editor.getByRole("textbox",{name:"Тема курсовой"}).fill("Исследование колебательной системы");
  await editor.getByRole("textbox",{name:"Студент"}).fill("Тестовый автор");
  await editor.getByRole("textbox",{name:"Цель работы"}).fill("Изучить периодическое движение");
  await expect(report.getByRole("heading",{name:"Исследование колебательной системы"})).toBeVisible();
  await expect(report.getByRole("heading",{name:"2. Математическая модель"})).toBeVisible();
  await expect(report.getByRole("img",{name:"Схема математических узлов"})).toBeVisible();
  await expect(report.getByText("(1 × sin(t))")).toBeVisible();
  await expect(report.getByText("Изучить периодическое движение")).toBeVisible();
  const graphAfter=await page.evaluate(()=>localStorage.getItem("paramyra.nodegraph.v3"));
  expect(graphAfter).toBe(graphBefore);
  await page.getByRole("button",{name:"Return to node editor"}).click();
  await expect(page.locator(".react-flow__pane")).toBeVisible();
  await page.getByRole("button",{name:"Open coursework mode"}).click();
  await expect(report.getByRole("heading",{name:"Исследование колебательной системы"})).toBeVisible();
  await page.emulateMedia({media:"print"});
  await expect(report).toBeVisible();
  await expect(page.locator(".pm-ng-projectbar")).toBeHidden();
  await expect(editor).toBeHidden();
});

test("Coursework report draft survives reload but does not overwrite scene data",async({page})=>{
  await page.goto("/studio/graph");
  const scene=await page.evaluate(()=>localStorage.getItem("paramyra.document.v3"));
  await page.getByRole("button",{name:"Open coursework mode"}).click();
  await page.getByRole("textbox",{name:"Методика исследования"}).fill("Численное исследование во времени");
  await expect(page.getByText("Черновик сохранён локально")).toBeVisible();
  await page.reload();
  await page.getByRole("button",{name:"Open coursework mode"}).click();
  await expect(page.getByRole("textbox",{name:"Методика исследования"})).toHaveValue("Численное исследование во времени");
  expect(await page.evaluate(()=>localStorage.getItem("paramyra.document.v3"))).toBe(scene);
});

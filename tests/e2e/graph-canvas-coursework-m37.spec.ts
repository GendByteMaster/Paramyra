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

test("Graph canvas has a refined background, not a second light-mode UI",async({page})=>{
  await page.goto("/studio/graph");
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem("paramyra.nodegraph.v3"))).not.toBeNull();
  const before=JSON.parse((await page.evaluate(()=>localStorage.getItem("paramyra.nodegraph.v3")))!);
  await expect(page.getByRole("button",{name:"Switch to light canvas"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Switch to dark canvas"})).toHaveCount(0);
  const flow=page.locator(".pm-ng-reactflow");
  await expect(flow).toBeVisible();
  await expect(flow).toHaveCSS("background-image",/radial-gradient/);
  const background=await flow.evaluate(el=>getComputedStyle(el).backgroundImage);
  expect(background).toContain("linear-gradient");
  await expect(page.locator(".pm-ng-reactflow-shell")).not.toHaveClass(/pm-ng-canvas-light/);
  expect(JSON.parse((await page.evaluate(()=>localStorage.getItem("paramyra.nodegraph.v3")))!)).toEqual(before);
  await page.evaluate(()=>localStorage.setItem("paramyra.graph.canvas-light.v1","true"));
  await page.reload();
  await expect(page.locator(".pm-ng-reactflow")).toHaveCSS("background-image",/radial-gradient/);
  await expect(page.locator(".pm-ng-reactflow-shell")).not.toHaveClass(/pm-ng-canvas-light/);
});

test("Coursework is a distinct editable and printable workspace backed by the real graph",async({page})=>{
  await page.goto("/studio/graph");
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem("paramyra.nodegraph.v3"))).not.toBeNull();
  const graphBefore=JSON.parse((await page.evaluate(()=>localStorage.getItem("paramyra.nodegraph.v3")))!);
  await page.getByRole("button",{name:"Open coursework mode"}).click();
  const editor=page.getByRole("complementary",{name:"Coursework settings"});
  const report=page.getByLabel("Coursework report preview");
  await expect(editor).toBeVisible();
  await expect(report).toBeVisible();
  await expect(page.locator(".react-flow__pane")).toHaveCount(0);
  await editor.getByRole("textbox",{name:"Coursework title"}).fill("Oscillatory system investigation");
  await editor.getByRole("textbox",{name:"Student"}).fill("Example Student");
  await editor.getByRole("textbox",{name:"Research objective"}).fill("Investigate periodic motion");
  await expect(report.getByRole("heading",{name:"Oscillatory system investigation"})).toBeVisible();
  await expect(report.getByRole("heading",{name:"2. Mathematical model"})).toBeVisible();
  await expect(report.getByRole("img",{name:"Mathematical node diagram"})).toBeVisible();
  await expect(report.getByText("(1 × sin(t))")).toBeVisible();
  await expect(report.getByText("Investigate periodic motion")).toBeVisible();
  expect(await report.innerText()).not.toMatch(/[А-Яа-яЁё]/);
  await expect(page.getByRole("button",{name:"Print / Save as PDF"})).toBeVisible();
  const graphAfter=JSON.parse((await page.evaluate(()=>localStorage.getItem("paramyra.nodegraph.v3")))!);
  expect(graphAfter).toEqual(graphBefore);
  await page.getByRole("button",{name:"Return to node editor"}).click();
  await expect(page.locator(".react-flow__pane")).toBeVisible();
  await page.getByRole("button",{name:"Open coursework mode"}).click();
  await expect(report.getByRole("heading",{name:"Oscillatory system investigation"})).toBeVisible();
  await page.emulateMedia({media:"print"});
  await expect(report).toBeVisible();
  await expect(page.locator(".pm-ng-projectbar")).toBeHidden();
  await expect(editor).toBeHidden();
});

test("Coursework report draft survives reload but does not overwrite scene data",async({page})=>{
  await page.goto("/studio/graph");
  // Visiting Graph alone must not create a Studio scene mirror.
  const scene=await page.evaluate(()=>localStorage.getItem("paramyra.document.v3"));
  await page.getByRole("button",{name:"Open coursework mode"}).click();
  await page.getByRole("textbox",{name:"Methodology"}).fill("Time-dependent numerical investigation");
  await expect(page.getByText("Saved in this project · Included in project export")).toBeVisible();
  await page.reload();
  await page.getByRole("button",{name:"Open coursework mode"}).click();
  await expect(page.getByRole("textbox",{name:"Methodology"})).toHaveValue("Time-dependent numerical investigation");
  expect(await page.evaluate(()=>localStorage.getItem("paramyra.document.v3"))).toBe(scene);
});

test("Previously generated Russian draft title migrates to English without rewriting user notes",async({page})=>{
  await page.addInitScript(()=>{
    // The legacy report must exist before v2 registry creation, as in a real upgrade.
    localStorage.setItem("paramyra.graph.coursework.v1.graph-1",JSON.stringify({
      version:1,institution:"School of Engineering",student:"Example Student",supervisor:"",
      title:"Исследование математической модели «Sine motion»",
      objective:"Preserve my original research objective",method:"",conclusion:""
    }));
  });
  await page.goto("/studio/graph");
  await expect(page.getByRole("button",{name:"Open coursework mode"})).toBeVisible();
  await page.getByRole("button",{name:"Open coursework mode"}).click();
  await expect(page.getByRole("textbox",{name:"Coursework title"})).toHaveValue("Mathematical modelling study: Sine motion");
  await expect(page.getByRole("textbox",{name:"Research objective"})).toHaveValue("Preserve my original research objective");
  await expect(page.getByRole("textbox",{name:"Institution"})).toHaveValue("School of Engineering");
});

import {expect,test} from "@playwright/test";

test("M3.3 full Graph Workspace groups and ungroups multiple nodes as one history step",async({page})=>{
  await page.goto("/studio/graph");
  await expect(page.getByRole("toolbar",{name:"Graph editing commands"})).toBeVisible();
  await page.getByRole("button",{name:"Select all nodes"}).click();
  await expect(page.getByLabel("Selected node count")).toContainText("5 selected");
  await page.getByRole("button",{name:"Group selected nodes",exact:true}).click();
  await expect(page.locator(".pm-ng-rf-group")).toHaveCount(1);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.nodegraph.v3")!).groups[0].nodeIds.length)).toBe(5);
  await page.getByRole("button",{name:"Ungroup selected nodes",exact:true}).click();
  await expect(page.locator(".pm-ng-rf-group")).toHaveCount(0);
  await page.getByRole("button",{name:"Undo graph edit"}).click();
  await expect(page.locator(".pm-ng-rf-group")).toHaveCount(1);
});

test("M3.3 copy/paste remaps all node and edge IDs, preserves graph and leaves Studio scene unchanged",async({page})=>{
  await page.goto("/studio/graph");
  const before=await page.evaluate(()=>localStorage.getItem("paramyra.document.v3"));
  await page.getByRole("button",{name:"Select all nodes"}).click();
  await page.getByRole("button",{name:"Copy selected nodes"}).click();
  await page.getByRole("button",{name:"Paste nodes"}).click();
  await expect(page.getByText("10 NODES",{exact:true})).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(8);
  const result=await page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.nodegraph.v3")!));
  expect(new Set(result.nodes.map((n:{id:string})=>n.id)).size).toBe(10);
  expect(new Set(result.edges.map((n:{id:string})=>n.id)).size).toBe(8);
  expect(new Set(result.nodes.filter((n:{kind:string})=>n.kind==="output").map((n:{property:string})=>n.property)).size).toBe(2);
  expect(await page.evaluate(()=>localStorage.getItem("paramyra.document.v3"))).toBe(before);
  await page.getByRole("button",{name:"Undo graph edit"}).click();
  await expect(page.getByText("5 NODES",{exact:true})).toBeVisible();
});

test("M3.3 portable project exports scene and graph together and validates before restoring",async({page})=>{
  await page.goto("/studio/graph");
  await page.getByRole("button",{name:"Select all nodes"}).click();
  await page.getByRole("button",{name:"Group selected nodes",exact:true}).click();
  const downloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:"Export full project"}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe("paramyra-project.json");
  const file=await download.path();
  expect(file).toBeTruthy();
  const {readFile}=await import("node:fs/promises");
  const serialized=await readFile(file!,"utf8");
  const bundle=JSON.parse(serialized);
  expect(bundle.format).toBe("paramyra-project");
  expect(bundle.version).toBe(2);
  expect(bundle.coursework.version).toBe(1);
  expect(bundle.scene.schemaVersion).toBe(3);
  expect(bundle.graph.schemaVersion).toBe(3);
  expect(bundle.graph.groups).toHaveLength(1);
  const before=await page.evaluate(()=>localStorage.getItem("paramyra.nodegraph.v3"));
  await page.getByLabel("Import full project JSON").setInputFiles({
    name:"invalid.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify({...bundle,graph:{...bundle.graph,nodes:[]}})),
  });
  await expect(page.getByText(/Project rejected/)).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem("paramyra.nodegraph.v3"))).toBe(before);
  await page.getByLabel("Import full project JSON").setInputFiles({
    name:"restored.json",mimeType:"application/json",buffer:Buffer.from(serialized),
  });
  await expect(page.getByText(/Project imported: scene, graph, keyframes and coursework restored/)).toBeVisible();
  await expect(page.locator(".pm-ng-rf-group")).toHaveCount(1);
});

test("M3.3 dedicated fullscreen graph workspace toggles without losing the selection",async({page})=>{
  await page.goto("/studio/graph");
  await page.getByRole("button",{name:"Select all nodes"}).click();
  await page.getByRole("button",{name:"Enter graph fullscreen"}).click();
  await expect(page.getByLabel("Node Graph Workspace")).toHaveClass(/pm-ng-fullscreen/);
  await expect(page.getByLabel("Selected node count")).toContainText("5 selected");
  await page.getByRole("button",{name:"Exit graph fullscreen"}).click();
  await expect(page.getByLabel("Node Graph Workspace")).not.toHaveClass(/pm-ng-fullscreen/);
});


test("M3.3 Shift-click multi-selection enables group operations from real React Flow nodes",async({page})=>{
  await page.goto("/studio/graph");
  await page.getByRole("article",{name:"Amplitude node"}).click();
  await page.getByRole("article",{name:"Timeline Time node"}).click({modifiers:["Shift"]});
  await expect(page.getByLabel("Selected node count")).toContainText("2 selected");
  await expect(page.getByRole("button",{name:"Group selected nodes",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Group selected nodes",exact:true}).click();
  const group=page.getByRole("region",{name:"Selected graph group"});
  await expect(group).toBeVisible();
  await group.getByRole("textbox",{name:"Group name"}).fill("Oscillator Sources");
  await expect(page.locator(".pm-ng-rf-group-header")).toContainText("Oscillator Sources");
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.nodegraph.v3")!));
  expect(stored.groups[0].nodeIds.sort()).toEqual(["amp","time"]);
});

test("Graph Workspace hides public navigation and footer, fills viewport, and keeps editor controls", async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/studio/graph");

  await expect(page.locator("header.topbar")).toHaveCount(0);
  await expect(page.locator("body > footer")).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Back to Studio"})).toBeVisible();
  const graphEditor = page.getByRole("region",{name:"Graph editor"});
  await expect(graphEditor.getByRole("toolbar",{name:"Graph editing commands"})).toBeVisible();
  await expect(graphEditor.getByRole("slider",{name:"Graph time"})).toBeVisible();
  await expect(graphEditor.getByLabel("Graph time value")).toContainText("0.00s");
  await expect(page.getByRole("navigation",{name:"Workspace modes"})).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerHeight,
    workspace: document.querySelector(".pm-ng-root")!.getBoundingClientRect().height,
    page: document.documentElement.scrollHeight,
  }));
  expect(Math.abs(dimensions.workspace + 12 - dimensions.viewport)).toBeLessThanOrEqual(1);
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);

  await page.goto("/");
  await expect(page.locator("header.topbar")).toBeVisible();
  await expect(page.locator("body > footer")).toHaveCount(1);
});

test("Graph Workspace on compact screens scrolls the document without nested page scroll traps", async ({page}) => {
  await page.setViewportSize({width:800,height:600});
  await page.goto("/studio/graph");
  await expect(page.locator(".pm-ng-layout")).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerHeight,
    page: document.documentElement.scrollHeight,
    overflowY: getComputedStyle(document.documentElement).overflowY,
    layoutOverflow: getComputedStyle(document.querySelector(".pm-ng-layout")!).overflowY,
  }));
  expect(dimensions.page).toBeGreaterThan(dimensions.viewport);
  expect(dimensions.overflowY).toBe("auto");
  expect(dimensions.layoutOverflow).not.toBe("auto");
  await expect(page.getByRole("complementary",{name:"Graph inspector"})).toBeVisible();
});

test("Graph editor playhead updates scene preview without page scrolling", async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/studio/graph");
  const editor=page.getByRole("region",{name:"Graph editor"});
  const playhead=editor.getByRole("slider",{name:"Graph time"});
  await playhead.focus();
  await playhead.press("ArrowRight");
  await expect(editor.getByLabel("Graph time value")).not.toHaveText("0.00s");
  await expect(page.getByLabel("Graph scene preview")).toBeVisible();
  const scroll=await page.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  expect(scroll).toBeLessThanOrEqual(1);
});

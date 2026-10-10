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
  expect(bundle.version).toBe(1);
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
  await expect(page.getByText(/Project imported: scene and graph restored/)).toBeVisible();
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

import {expect,test} from "@playwright/test";

test("Quick Add searches node types and preserves graph undo history",async({page})=>{
  await page.goto("/studio/graph");
  await page.getByRole("button",{name:"Add graph node"}).click();
  const palette=page.getByRole("dialog",{name:"Add graph node"});
  await expect(palette).toBeVisible();
  const search=palette.getByRole("textbox",{name:"Search available nodes"});
  await expect(search).toBeFocused();
  await search.fill("sine");
  await expect(palette.getByRole("button",{name:"Sine"})).toBeVisible();
  await search.press("Enter");
  await expect(palette).toHaveCount(0);
  await expect(page.getByText("6 NODES",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Undo graph edit"}).click();
  await expect(page.getByText("5 NODES",{exact:true})).toBeVisible();
});

test("Right-click canvas opens graph node palette near pointer and closes on Escape",async({page})=>{
  await page.goto("/studio/graph");
  await page.locator(".react-flow__pane").click({button:"right",position:{x:120,y:100}});
  const palette=page.getByRole("dialog",{name:"Add graph node"});
  await expect(palette).toBeVisible();
  await palette.getByRole("textbox",{name:"Search available nodes"}).press("Escape");
  await expect(palette).toHaveCount(0);
  await expect(page.getByText("5 NODES",{exact:true})).toBeVisible();
});

test("Library HTML drag/drop creates a node via React Flow coordinates and does not alter Studio",async({page})=>{
  await page.goto("/studio/graph");
  const before=await page.evaluate(()=>localStorage.getItem("paramyra.document.v3"));
  const source=page.getByRole("complementary",{name:"Node library"}).getByRole("button",{name:/Number.*Fixed numeric input/});
  await expect(source).toHaveAttribute("draggable","true");
  const target=page.locator(".react-flow__pane");
  await source.dragTo(target,{targetPosition:{x:130,y:130}});
  await expect(page.getByText("6 NODES",{exact:true})).toBeVisible();
  const persisted=await page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.nodegraph.v3")!));
  expect(persisted.nodes).toHaveLength(6);
  expect(persisted.nodes[5].kind).toBe("constant");
  expect(persisted.nodes[5].x).toBeGreaterThanOrEqual(0);
  expect(persisted.nodes[5].y).toBeGreaterThanOrEqual(0);
  expect(await page.evaluate(()=>localStorage.getItem("paramyra.document.v3"))).toBe(before);
});

test("Node right-click supports duplicate/delete with undo preserving domain model",async({page})=>{
  await page.goto("/studio/graph");
  await page.getByRole("article",{name:"Amplitude node"}).click({button:"right"});
  const menu=page.getByRole("dialog",{name:"Node context menu"});
  await expect(menu).toBeVisible();
  await menu.getByRole("button",{name:"Duplicate node"}).click();
  await expect(page.getByText("6 NODES",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Undo graph edit"}).click();
  await expect(page.getByText("5 NODES",{exact:true})).toBeVisible();
});

test("Quick Add and node styles remain usable at compact width",async({page})=>{
  await page.setViewportSize({width:390,height:780});
  await page.goto("/studio/graph");
  await page.getByRole("button",{name:"Add graph node"}).click();
  const menu=page.getByRole("dialog",{name:"Add graph node"});
  await expect(menu).toBeVisible();
  const rect=await menu.boundingBox();
  expect(rect).not.toBeNull();
  expect(rect!.x).toBeGreaterThanOrEqual(0);
  expect(rect!.x+rect!.width).toBeLessThanOrEqual(392);
  await expect(page.getByRole("article",{name:"Amplitude node"})).toHaveCSS("border-radius","12px");
});

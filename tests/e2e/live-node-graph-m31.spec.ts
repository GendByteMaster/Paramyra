import {test,expect} from "@playwright/test";

test("M3.1 enables persisted Live Graph and evaluates it at Studio Timeline playhead",async({page})=>{
  await page.goto("/studio/graph");
  const toggle=page.getByRole("checkbox",{name:"Enable Live Graph"});
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(toggle).toBeChecked();
  await expect(page.getByText(/Live output is active/)).toBeVisible();
  await page.getByRole("navigation",{name:"Workspace modes"}).getByRole("link",{name:"Studio",exact:true}).click();
  await expect(page.getByText("GRAPH LINKED")).toBeVisible();
  await page.getByRole("button",{name:"Pause animation"}).click();
  const timeline=page.getByRole("slider",{name:"Timeline position"});
  await timeline.focus();
  await timeline.press("End");
  await expect(page.getByLabel("At playhead Offset X")).toHaveText("-0.537");
  await expect(page.getByText("Graph",{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText("GRAPH LINKED")).toBeVisible();
  await page.getByRole("button",{name:"Pause animation"}).click();
  await page.getByRole("slider",{name:"Timeline position"}).focus();
  await page.keyboard.press("End");
  await expect(page.getByLabel("At playhead Offset X")).toHaveText("-0.537");
});

test("M3.1 keyframes win over graph outputs on the same channel",async({page})=>{
  await page.goto("/studio/graph");
  await page.getByRole("checkbox",{name:"Enable Live Graph"}).check();
  await page.goto("/studio");
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem("paramyra.document.v3"))).not.toBeNull();
  await page.evaluate(()=>{
    const key="paramyra.document.v3";
    const doc=JSON.parse(localStorage.getItem(key)!);
    doc.layers[0].keyframes=[
      {property:"offset.x",time:0,value:0.42,ease:"linear"},
      {property:"offset.x",time:12,value:0.42,ease:"linear"},
    ];
    localStorage.setItem(key,JSON.stringify(doc));
  });
  await page.reload();
  await page.getByRole("button",{name:"Pause animation"}).click();
  const timeline=page.getByRole("slider",{name:"Timeline position"});
  await timeline.focus();await timeline.press("End");
  await expect(page.getByLabel("At playhead Offset X")).toHaveText("0.42");
  await expect(page.getByText("Keyed",{exact:true})).toBeVisible();
  await expect(page.getByText("GRAPH LINKED")).toBeVisible();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!));
  expect(saved.layers[0].offset.x).toBe(0);
});

test("M3.1 keeps Studio base values when live binding is disabled",async({page})=>{
  await page.goto("/studio/graph");
  await page.getByRole("checkbox",{name:"Enable Live Graph"}).check();
  await page.getByRole("checkbox",{name:"Enable Live Graph"}).uncheck();
  await page.goto("/studio");
  await expect(page.getByText("GRAPH LINKED")).toHaveCount(0);
  await page.getByRole("button",{name:"Pause animation"}).click();
  const timeline=page.getByRole("slider",{name:"Timeline position"});
  await timeline.focus();await timeline.press("End");
  await expect(page.getByLabel("At playhead Offset X")).toHaveCount(0);
  await expect(page.getByLabel("At playhead Opacity")).toHaveText("1");
});

test("M3.1 propagates graph toggles from a second browser tab",async({page,context})=>{
  await page.goto("/studio");
  await expect(page.getByText("GRAPH LINKED")).toHaveCount(0);
  const other=await context.newPage();
  await other.goto("/studio/graph");
  await other.getByRole("checkbox",{name:"Enable Live Graph"}).check();
  await expect(page.getByText("GRAPH LINKED")).toBeVisible();
  await other.getByRole("checkbox",{name:"Enable Live Graph"}).uncheck();
  await expect(page.getByText("GRAPH LINKED")).toHaveCount(0);
  await other.close();
});

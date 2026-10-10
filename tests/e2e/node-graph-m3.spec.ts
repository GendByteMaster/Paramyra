import {test,expect} from "@playwright/test";

test("M3 opens as a separate Graph mode with a valid computed scene preview",async({page})=>{
  await page.goto("/studio/graph");
  await expect(page.getByRole("heading",{name:/Node Graph/})).toBeVisible();
  await expect(page.getByRole("region",{name:"Graph editor"})).toBeVisible();
  await expect(page.getByRole("complementary",{name:"Node library"})).toBeVisible();
  await expect(page.getByRole("complementary",{name:"Graph inspector"})).toBeVisible();
  await expect(page.getByRole("article",{name:"Multiply node"})).toBeVisible();
  await expect(page.getByRole("img",{name:/Visualization of/})).toBeVisible();
  await expect(page.getByText("Graph output is valid for the selected layer.")).toBeVisible();
  await expect(page.getByRole("link",{name:"Studio",exact:true})).toBeVisible();
});

test("M3 applies evaluated numeric output to MathDocument v3 only after explicit action",async({page})=>{
  await page.goto("/studio/graph");
  const slider=page.getByRole("slider",{name:"Graph time"});
  await slider.focus();
  await slider.press("End");
  await expect(page.getByLabel("Graph time value")).toHaveText("12.00s");
  const before=await page.evaluate(()=>localStorage.getItem("paramyra.document.v3"));
  await expect(page.getByRole("button",{name:/Apply to Studio/})).toBeEnabled();
  await page.getByRole("button",{name:/Apply to Studio/}).first().click();
  await expect(page.getByText(/Applied static graph outputs to the Studio document/)).toBeVisible();
  const saved=await page.evaluate(()=>localStorage.getItem("paramyra.document.v3"));
  expect(saved).not.toBe(before);
  const doc=JSON.parse(saved!);
  expect(doc.schemaVersion).toBe(3);
  expect(doc.layers[0].offset.x).toBeCloseTo(Math.sin(12),3);
});

test("M3 rejects numeric cycles and allows undoing new nodes without changing Studio",async({page})=>{
  await page.goto("/studio/graph");
  const before=await page.evaluate(()=>localStorage.getItem("paramyra.document.v3"));
  await page.getByRole("button",{name:"Use Multiply output as source"}).click();
  await page.getByRole("button",{name:"Connect Sine input in"}).click();
  await expect(page.getByText(/Connection rejected/)).toBeVisible();
  await expect(page.getByText("4 LINKS")).toBeVisible();
  const add=page.getByRole("button",{name:/Number.*Fixed numeric input/});
  await add.click();
  await expect(page.getByText("6 NODES")).toBeVisible();
  await page.getByRole("button",{name:"Undo graph edit"}).click();
  await expect(page.getByText("5 NODES")).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem("paramyra.document.v3"))).toBe(before);
});

test("M3 imports only validated DAG files and retains working graph on rejected input",async({page})=>{
  await page.goto("/studio/graph");
  await page.getByLabel("Import graph JSON").setInputFiles({
    name:"invalid.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify({
      schemaVersion:1,id:"broken",title:"Cycle",
      nodes:[
        {id:"a",kind:"sine",title:"A",x:10,y:10},
        {id:"b",kind:"sine",title:"B",x:250,y:10},
      ],
      edges:[
        {id:"one",source:"a",target:"b",port:"in"},
        {id:"two",source:"b",target:"a",port:"in"},
      ],
    })),
  });
  await expect(page.getByText(/Invalid graph: schema, inputs, IDs or cycle validation failed/)).toBeVisible();
  await expect(page.getByRole("article",{name:"Multiply node"})).toBeVisible();
});

test("M3 graph workspace fits mobile width and keeps the Inspector accessible",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/studio/graph");
  await expect(page.getByRole("region",{name:"Graph editor"})).toBeVisible();
  await expect(page.getByRole("complementary",{name:"Graph inspector"})).toBeVisible();
  await page.getByRole("button",{name:"Fit graph"}).click();
  await expect(page.getByLabel("Graph zoom")).not.toHaveText("NaN%");
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

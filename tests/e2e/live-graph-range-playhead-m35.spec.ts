import {expect,test} from "@playwright/test";

test("unsafe amplitude cannot be activated as a discontinuous Live Graph",async({page})=>{
  await page.goto("/studio/graph");
  await page.getByRole("article",{name:"Amplitude node"}).click();
  const number=page.getByRole("spinbutton",{name:"Constant value"});
  const toggle=page.getByRole("checkbox",{name:"Enable Live Graph"});
  await number.fill("20");
  await expect(number).toHaveValue("20");
  await toggle.check();
  await expect(toggle).not.toBeChecked();
  await expect(page.getByText(/Live Graph cannot be enabled: offset.x can reach -20.00…20.00/)).toBeVisible();

  // Editing an already-active graph must keep the edit but turn unsafe binding off.
  await number.fill("1");
  await toggle.check();
  await expect(toggle).toBeChecked();
  await number.fill("20");
  await expect(number).toHaveValue("20");
  await expect(toggle).not.toBeChecked();
  await expect(page.getByText(/Live Graph disabled: offset.x can reach -20.00…20.00/)).toBeVisible();
});

test("legacy out-of-bounds Live Graph is marked invalid and does not make Studio jump",async({page})=>{
  await page.goto("/studio");
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem("paramyra.document.v3"))).not.toBeNull();
  await page.goto("/studio/graph");
  await page.evaluate(()=>{
    const key="paramyra.nodegraph.v3";
    const graph=JSON.parse(localStorage.getItem(key)!);
    graph.binding.enabled=true;
    graph.binding.layerId=JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].id;
    graph.nodes.find((n:{id:string})=>n.id==="amp").value=20;
    localStorage.setItem(key,JSON.stringify(graph));
  });
  await page.reload();
  await expect(page.getByRole("group",{name:"Live Graph binding"})).toContainText("INVALID");
  await expect(page.getByText(/offset.x can reach -20.00…20.00/).first()).toBeVisible();

  await page.goto("/studio");
  await expect(page.getByText("GRAPH ERROR")).toBeVisible();
  await page.getByRole("button",{name:"Pause animation"}).click();
  await page.getByRole("slider",{name:"Timeline position"}).focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("region",{name:"Live Graph status"})).toContainText("outside -2…2");
});

test("Studio and Node Graph hand off the same playhead position per tab",async({page})=>{
  await page.goto("/studio");
  await page.getByRole("button",{name:"Pause animation"}).click();
  const studio=page.getByRole("slider",{name:"Timeline position"});
  await studio.focus();
  await studio.press("End");
  await expect.poll(()=>page.evaluate(()=>Number(sessionStorage.getItem("paramyra.studio.playhead.v1")))).toBe(12);

  await page.getByRole("link",{name:"Open Node Graph Workspace"}).click();
  const graph=page.getByRole("slider",{name:"Graph time"});
  await expect(graph).toHaveValue("12");
  await graph.focus();
  await graph.press("Home");
  await expect.poll(()=>page.evaluate(()=>Number(sessionStorage.getItem("paramyra.studio.playhead.v1")))).toBe(0);
  await page.getByRole("navigation",{name:"Workspace modes"}).getByRole("link",{name:"Studio",exact:true}).click();
  await page.getByRole("button",{name:"Pause animation"}).click();
  expect(Number(await page.getByRole("slider",{name:"Timeline position"}).inputValue())).toBeLessThan(0.5);
});

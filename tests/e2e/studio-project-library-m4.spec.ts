import {test,expect} from "@playwright/test";

test("Studio saves separately named projects, layers and graph snapshots",async({page})=>{
  await page.goto("/studio");
  await expect(page.locator("#frequencyX")).toBeVisible();
  await page.locator("#frequencyX").focus();
  await page.locator("#frequencyX").press("End");
  await expect(page.locator("#frequencyX")).toHaveValue("12");
  await page.getByRole("button",{name:"Open project library"}).click();
  const projects=page.getByRole("dialog",{name:"Studio project library"});
  await expect(projects).toBeVisible();
  await expect(projects.getByText("1 / 20 projects")).toBeVisible();
  await projects.getByRole("button",{name:"New Project"}).click();
  await expect(projects).toHaveCount(0);
  await expect(page.locator("#frequencyX")).toHaveValue("3");
  await page.locator("#frequencyX").focus();
  await page.locator("#frequencyX").press("Home");
  await expect(page.locator("#frequencyX")).toHaveValue("1");
  await page.getByRole("button",{name:"Open project library"}).click();
  await expect(projects.getByText("2 / 20 projects")).toBeVisible();
  await projects.getByRole("button",{name:"Open",exact:true}).click();
  await expect(page.locator("#frequencyX")).toHaveValue("12");
  await page.reload();
  await expect(page.locator("#frequencyX")).toHaveValue("12");
  const stored=JSON.parse((await page.evaluate(()=>localStorage.getItem("paramyra.studio.projects.v1")))!);
  expect(stored.projects).toHaveLength(2);
  expect(stored.projects.map((p:{scene:{layers:Array<{params:{frequencyX:number}}>}})=>p.scene.layers[0].params.frequencyX).sort()).toEqual([1,12]);
});

test("Studio project library renames, duplicates and deletes without corrupting other projects",async({page})=>{
  await page.goto("/studio");
  await page.getByRole("button",{name:"Open project library"}).click();
  const modal=page.getByRole("dialog",{name:"Studio project library"});
  await modal.getByRole("button",{name:"Duplicate project Lissajous Curves"}).click();
  await page.getByRole("button",{name:"Open project library"}).click();
  const projectName=modal.getByRole("button",{name:"Rename project Lissajous Curves Copy"});
  await projectName.click();
  await modal.getByRole("textbox",{name:"Rename Lissajous Curves Copy"}).fill("Wave Research");
  await modal.getByRole("button",{name:"Save name for Lissajous Curves Copy"}).click();
  await expect(modal.getByText("Wave Research")).toBeVisible();
  page.once("dialog",dialog=>dialog.accept());
  await modal.getByRole("button",{name:"Delete project Wave Research"}).click();
  await expect(modal.getByText("Wave Research")).toHaveCount(0);
  await expect(modal.getByText("1 / 20 projects")).toBeVisible();
  await expect(modal.getByRole("button",{name:"Delete project Lissajous Curves"})).toBeDisabled();
});

test("Switching Studio projects restores distinct Node Graph values",async({page})=>{
  await page.goto("/studio");
  await expect(page.locator("#frequencyX")).toBeVisible();
  await page.goto("/studio/graph");
  await expect(page.getByRole("article",{name:"Amplitude node"})).toBeVisible();
  await page.getByRole("article",{name:"Amplitude node"}).click();
  await page.getByRole("spinbutton",{name:"Number"}).fill("9");
  await page.getByRole("spinbutton",{name:"Number"}).blur();
  await expect(page.getByText("9.0000",{exact:true}).first()).toBeVisible();

  await page.goto("/studio");
  await page.getByRole("button",{name:"Open project library"}).click();
  await page.getByRole("dialog",{name:"Studio project library"}).getByRole("button",{name:"New Project"}).click();
  await page.goto("/studio/graph");
  await expect(page.getByRole("article",{name:"Amplitude node"})).toBeVisible();
  await page.getByRole("article",{name:"Amplitude node"}).click();
  await expect(page.getByRole("spinbutton",{name:"Number"})).toHaveValue("1");
  await page.goto("/studio");
  await page.getByRole("button",{name:"Open project library"}).click();
  await page.getByRole("dialog",{name:"Studio project library"}).getByRole("button",{name:"Open",exact:true}).click();
  await page.goto("/studio/graph");
  await page.getByRole("article",{name:"Amplitude node"}).click();
  await expect(page.getByRole("spinbutton",{name:"Number"})).toHaveValue("9");
});

test("Project Library is accessible on compact mobile widths",async({page})=>{
  await page.setViewportSize({width:390,height:780});
  await page.goto("/studio");
  await page.getByRole("button",{name:"Open project library"}).click();
  const modal=page.getByRole("dialog",{name:"Studio project library"});
  await expect(modal).toBeVisible();
  await expect(modal.getByRole("button",{name:"New Project"})).toBeVisible();
  const box=await modal.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x+box!.width).toBeLessThanOrEqual(392);
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
});

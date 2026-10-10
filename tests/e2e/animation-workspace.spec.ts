import {test,expect} from "@playwright/test";

test("Animation Workspace expands without clipping and supports keyboard resize and focus",async({page})=>{
  await page.setViewportSize({width:1365,height:768});
  await page.goto("/studio");
  await page.getByRole("button",{name:"Open animation workspace"}).click();
  const panel=page.getByRole("region",{name:"Scene details"});
  const editor=page.getByLabel("Keyframe Animation Editor");
  await expect(editor).toBeVisible();
  await expect(page.getByLabel("Animation property tracks")).toBeVisible();
  await expect(page.getByRole("img",{name:"Interpolation graph for Opacity"})).toBeVisible();
  const initial=await panel.boundingBox();
  expect(initial?.height).toBeGreaterThanOrEqual(290);
  const resize=page.getByRole("separator",{name:"Resize animation workspace"});
  await resize.focus();
  await resize.press("ArrowUp");
  await expect.poll(async()=>Math.round((await panel.boundingBox())?.height??0)).toBeGreaterThan(Math.round(initial!.height));
  await page.getByRole("button",{name:"Focus animation workspace"}).click();
  await expect(page.getByLabel("Scene inspector")).toBeHidden();
  await expect(page.getByLabel("Scene library")).toBeHidden();
  await expect(editor).toBeVisible();
  await page.getByRole("button",{name:"Exit animation focus mode"}).click();
  await expect(page.getByLabel("Scene inspector")).toBeVisible();
  await page.getByRole("button",{name:"Restore animation workspace height"}).click();
  await page.getByRole("tab",{name:"Overview"}).click();
  await expect(resize).toHaveCount(0);
  await expect(page.getByLabel("Visualization preview")).toBeVisible();
});

test("Mobile toolbar remains within viewport and animation controls are reachable",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/studio");
  await expect(page.getByRole("button",{name:"Toggle scene library"})).toBeInViewport();
  await expect(page.getByRole("button",{name:"Undo",exact:true})).toBeInViewport();
  await expect(page.getByRole("button",{name:"Open animation workspace"})).toBeInViewport();
  await page.getByRole("button",{name:"Open animation workspace"}).click();
  await expect(page.getByLabel("Keyframe Animation Editor")).toBeVisible();
  await expect(page.getByRole("separator",{name:"Resize animation workspace"})).toBeHidden();
  await expect(page.getByLabel("Animation property tracks")).toBeVisible();
  await expect(page.getByRole("img",{name:"Interpolation graph for Opacity"})).toBeVisible();
  const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(2);
});

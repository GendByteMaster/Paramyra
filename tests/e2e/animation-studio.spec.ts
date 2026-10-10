import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";

test("Animation Studio keyframes persist, interpolate, and follow Undo/Redo",async({page})=>{
  await page.goto("/studio");
  await expect(page.locator(".pm-workspace")).toBeVisible();
  await page.getByRole("button",{name:"Pause animation"}).click();
  await page.getByRole("tab",{name:"Animation"}).click();
  const panel=page.getByLabel("Keyframe Animation Editor");
  await expect(panel).toBeVisible();
  await panel.getByRole("combobox",{name:"Animated property"}).selectOption("opacity");
  const seek=page.getByRole("slider",{name:"Timeline position"});
  await seek.focus();await seek.press("Home");
  await panel.getByRole("button",{name:"Add keyframe at playhead"}).click();
  await panel.getByRole("spinbutton",{name:"Animated value"}).fill("0.2");
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes?.[0]?.value)).toBe(.2);
  await seek.focus();await seek.press("End");
  await panel.getByRole("button",{name:"Add keyframe at playhead"}).click();
  await panel.getByRole("spinbutton",{name:"Animated value"}).fill("0.8");
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes?.length)).toBe(2);
  await expect(panel.getByRole("img",{name:"Interpolation graph for Opacity"})).toBeVisible();
  await panel.getByRole("combobox",{name:"Keyframe easing"}).selectOption("hold");
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes[1].ease)).toBe("hold");
  await page.getByRole("button",{name:"Undo",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes[1].ease)).toBe("ease-in-out");
  await page.getByRole("button",{name:"Redo",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes[1].ease)).toBe("hold");
  await page.reload();
  await expect(page.locator(".pm-workspace")).toBeVisible();
  await page.getByRole("tab",{name:"Animation"}).click();
  await expect(page.getByLabel("Keyframe Animation Editor")).toContainText("2 markers");
});

test("Animation Studio downloads safe SVG and PNG frames",async({page})=>{
  await page.goto("/studio");
  await expect(page.locator(".pm-workspace")).toBeVisible();
  await page.getByRole("button",{name:"Pause animation"}).click();
  await page.getByRole("button",{name:"Open image export options"}).click();
  const options=page.getByRole("group",{name:"Image export options"});
  await expect(options).toBeVisible();
  await options.getByRole("combobox",{name:"Export resolution"}).selectOption("1280x720");
  await options.getByRole("combobox",{name:"Export background"}).selectOption("transparent");
  const [svg]=await Promise.all([page.waitForEvent("download"),options.getByRole("button",{name:"Download SVG"}).click()]);
  expect(svg.suggestedFilename()).toMatch(/^paramyra-.+\.svg$/);
  const xml=await readFile(await svg.path(),"utf8");
  expect(xml).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
  expect(xml).toContain("<path");
  expect(xml).not.toContain("<script");
  await page.getByRole("button",{name:"Open image export options"}).click();
  const [png]=await Promise.all([page.waitForEvent("download"),page.getByRole("button",{name:"Download PNG"}).click()]);
  expect(png.suggestedFilename()).toMatch(/^paramyra-.+\.png$/);
  const bytes=await readFile(await png.path());
  expect(bytes.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
});

test("Animation timeline and Export Image options are usable on mobile",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/studio");await expect(page.locator(".pm-workspace")).toBeVisible();
  await page.getByRole("tab",{name:"Animation"}).click();
  await expect(page.getByLabel("Keyframe Animation Editor")).toBeVisible();
  await expect(page.getByRole("button",{name:"Add keyframe at playhead"})).toBeVisible();
  await page.getByRole("button",{name:"Open image export options"}).click();
  await expect(page.getByRole("button",{name:"Download PNG"})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

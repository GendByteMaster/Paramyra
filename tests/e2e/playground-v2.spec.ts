import { expect, test } from "@playwright/test";

test("Playground experiments never overwrite the persisted Studio document",async({page})=>{
  await page.goto("/studio");
  await expect(page.locator("#frequencyX")).toBeVisible();
  await page.locator("#frequencyX").focus();
  await page.locator("#frequencyX").press("End");
  await expect(page.locator("#frequencyX")).toHaveValue("12");
  const studioBefore=await page.evaluate(()=>localStorage.getItem("paramyra.document.v3"));
  expect(studioBefore).toBeTruthy();

  await page.goto("/playground");
  await expect(page.getByRole("heading",{name:"Mathematics Playground"})).toBeVisible();
  await page.getByRole("button",{name:/Polar Rose/}).click();
  await page.getByRole("slider",{name:"Frequency X"}).fill("8");
  await expect(page.getByRole("slider",{name:"Frequency X"})).toHaveValue("8");
  const values=await page.evaluate(()=>({
    saved:localStorage.getItem("paramyra.document.v3"),
    temporary:sessionStorage.getItem("paramyra.playground.experiment.v2"),
  }));
  expect(JSON.parse(values.saved!)).toEqual(JSON.parse(studioBefore!));
  expect(JSON.parse(values.temporary!).params.frequencyX).toBe(8);
  await page.reload();
  await expect(page.getByRole("heading",{name:"Mathematics Playground"})).toBeVisible();
  await expect(page.getByRole("slider",{name:"Frequency X"})).toHaveValue("8");
  expect(JSON.parse((await page.evaluate(()=>localStorage.getItem("paramyra.document.v3")))!)).toEqual(JSON.parse(studioBefore!));
  await page.goto("/studio");
  await expect(page.locator("#frequencyX")).toHaveValue("12");
});

test("Open in Studio transfers a scene into an isolated unsaved draft, then saves on explicit confirmation",async({page})=>{
  await page.goto("/studio");
  await expect(page.locator("#frequencyX")).toBeVisible();
  await page.locator("#frequencyX").focus();
  await page.locator("#frequencyX").press("End");
  await expect(page.locator("#frequencyX")).toHaveValue("12");
  const original=await page.evaluate(()=>localStorage.getItem("paramyra.document.v3"));

  await page.goto("/playground");
  await page.getByRole("button",{name:/Polar Rose/}).click();
  await page.getByRole("slider",{name:"Frequency X"}).fill("7");
  await page.getByRole("button",{name:/Open in Studio/}).click();
  await expect(page).toHaveURL(/\/studio\?playgroundTransfer=/);
  await expect(page.getByText("Playground experiment · Unsaved Studio draft")).toBeVisible();
  await expect(page.locator("#scene-kind")).toHaveValue("polar-rose");
  await expect(page.locator("#frequencyX")).toHaveValue("7");
  expect(JSON.parse((await page.evaluate(()=>localStorage.getItem("paramyra.document.v3")))!)).toEqual(JSON.parse(original!));

  await page.reload();
  await expect(page.getByText("Playground experiment · Unsaved Studio draft")).toBeVisible();
  await expect(page.locator("#frequencyX")).toHaveValue("7");
  expect(JSON.parse((await page.evaluate(()=>localStorage.getItem("paramyra.document.v3")))!)).toEqual(JSON.parse(original!));

  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"Save to Studio"}).click();
  await expect(page.getByText("Playground experiment · Unsaved Studio draft")).toHaveCount(0);
  await expect(page).toHaveURL(/\/studio$/);
  const next=JSON.parse((await page.evaluate(()=>localStorage.getItem("paramyra.document.v3")))!);
  expect(next.layers[0].kind).toBe("polar-rose");
  expect(next.layers[0].params.frequencyX).toBe(7);
  expect(next.id).not.toBe(JSON.parse(original!).id);
  await page.reload();
  await expect(page.locator("#scene-kind")).toHaveValue("polar-rose");
});

test("Declining Save to Studio keeps the old document and the isolated draft",async({page})=>{
  await page.goto("/studio");
  await expect(page.locator("#frequencyX")).toBeVisible();
  const original=await page.evaluate(()=>localStorage.getItem("paramyra.document.v3"));
  await page.goto("/playground");
  await page.getByRole("button",{name:/Harmonic Waves/}).click();
  await page.getByRole("button",{name:/Open in Studio/}).click();
  await expect(page.getByText("Playground experiment · Unsaved Studio draft")).toBeVisible();
  page.once("dialog",dialog=>dialog.dismiss());
  await page.getByRole("button",{name:"Save to Studio"}).click();
  await expect(page.getByText("Playground experiment · Unsaved Studio draft")).toBeVisible();
  expect(JSON.parse((await page.evaluate(()=>localStorage.getItem("paramyra.document.v3")))!)).toEqual(JSON.parse(original!));
  await page.getByRole("button",{name:"Discard draft"}).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByText("Playground experiment · Unsaved Studio draft")).toHaveCount(0);
  expect(JSON.parse((await page.evaluate(()=>localStorage.getItem("paramyra.document.v3")))!)).toEqual(JSON.parse(original!));
});

test("An untrusted URL token cannot import an arbitrary document into Studio",async({page})=>{
  await page.goto("/studio");
  await expect(page.locator("#frequencyX")).toBeVisible();
  const saved=await page.evaluate(()=>localStorage.getItem("paramyra.document.v3"));
  await page.goto("/studio?playgroundTransfer=not-a-valid-token");
  await expect(page.getByText("Playground experiment · Unsaved Studio draft")).toHaveCount(0);
  expect(JSON.parse((await page.evaluate(()=>localStorage.getItem("paramyra.document.v3")))!)).toEqual(JSON.parse(saved!));
});

test("Playground uses experiment controls rather than Studio layers or Node Graph",async({page})=>{
  await page.goto("/playground");
  await expect(page.getByRole("complementary",{name:"Experiment presets"})).toBeVisible();
  await expect(page.getByRole("complementary",{name:"Experiment controls"})).toBeVisible();
  await expect(page.getByRole("slider",{name:"Experiment time"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Surprise me"})).toBeVisible();
  await expect(page.getByRole("button",{name:/Open in Studio/})).toBeVisible();
  await expect(page.locator(".pm-editor-pane-layout")).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Add graph node"})).toHaveCount(0);
});

test("Playground remains usable with reduced motion on a narrow screen",async({page})=>{
  await page.setViewportSize({width:390,height:780});
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/playground");
  await expect(page.getByRole("heading",{name:"Mathematics Playground"})).toBeVisible();
  await expect(page.getByRole("img",{name:/Visualization of/})).toBeVisible();
  await expect(page.getByRole("slider",{name:"Frequency X"})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

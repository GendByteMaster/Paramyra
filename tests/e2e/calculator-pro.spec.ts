import {test,expect} from "@playwright/test";

test("Calculator Pro remembers results, supports ANS and secure scientific operations",async({page})=>{
  await page.goto("/studio");await expect(page.locator(".pm-workspace")).toBeVisible();
  await page.getByRole("button",{name:"Open calculator window",exact:true}).click();
  const input=page.getByRole("textbox",{name:"Calculator expression"});
  await input.fill("sin(30)");
  await page.getByRole("button",{name:"Angle unit"}).click();
  await expect(page.getByLabel("Calculator result")).toHaveText("0.5");
  await page.getByRole("button",{name:"Equals",exact:true}).click();
  await page.getByRole("button",{name:/History/}).click();
  await expect(page.getByRole("region",{name:"Calculator history"})).toContainText("sin(30)");
  await input.fill("ans+1");
  await expect(page.getByLabel("Calculator result")).toHaveText("1.5");
  await page.getByRole("button",{name:"Use result"}).click();
  await expect(input).toHaveValue("1.5");
  await page.getByRole("button",{name:"Close calculator window"}).click();
  await page.reload();await expect(page.locator(".pm-workspace")).toBeVisible();
  await page.getByRole("button",{name:"Open calculator window",exact:true}).click();
  await page.getByRole("button",{name:/History/}).click();
  await expect(page.getByRole("button",{name:"Recall ans+1"})).toBeVisible();
  await page.getByRole("button",{name:"Clear history"}).click();
  await expect(page.getByRole("region",{name:"Calculator history"})).toContainText("Press = or Enter");
  await input.fill("10!");
  await expect(page.locator(".pm-calc-error")).toContainText(/Undefined/i);
  await input.fill("9!");
  await expect(page.getByLabel("Calculator result")).toHaveText("362880");
});

test("Calculator Pro Plot creates an undoable formula layer and rejects unsafe graph expressions",async({page})=>{
  await page.goto("/studio");await expect(page.locator(".pm-workspace")).toBeVisible();
  await page.getByRole("button",{name:"Open calculator window",exact:true}).click();
  const input=page.getByRole("textbox",{name:"Calculator expression"});
  await input.fill("x^2+a");
  await page.getByRole("button",{name:"Plot graph"}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers.length)).toBe(2);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[1].formula.exprY)).toBe("x^2+a");
  await page.getByRole("button",{name:"Close calculator window"}).click();
  await page.getByRole("button",{name:"Undo",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers.length)).toBe(1);
  await page.getByRole("button",{name:"Open calculator window",exact:true}).click();
  await input.fill("ans+x");
  await expect(page.getByRole("button",{name:"Plot graph"})).toBeEnabled();
  await input.fill("u+1");
  await expect(page.getByRole("button",{name:"Plot graph"})).toBeDisabled();
  await input.fill("sin(30)+x");
  await page.getByRole("button",{name:"Angle unit"}).click();
  await expect(page.getByRole("button",{name:"Plot graph"})).toBeDisabled();
});

test("Calculator Pro docks and resizes desktop window, restoring size after reload",async({page})=>{
  await page.setViewportSize({width:1365,height:768});
  await page.goto("/studio");await expect(page.locator(".pm-workspace")).toBeVisible();
  await page.getByRole("button",{name:"Open calculator window",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Scientific calculator window"});
  const original=await dialog.boundingBox();expect(original).not.toBeNull();
  const handle=page.getByRole("separator",{name:"Resize calculator window"});
  const box=await handle.boundingBox();expect(box).not.toBeNull();
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
  await page.mouse.down();
  await page.mouse.move(box!.x+box!.width/2+64,box!.y+box!.height/2,{steps:8});
  await page.mouse.up();
  const resized=await dialog.boundingBox();expect(resized).not.toBeNull();
  expect(resized!.width).toBeGreaterThan(original!.width+30);
  await page.getByRole("button",{name:"Dock calculator right"}).click();
  await expect(dialog).toHaveClass(/is-docked-right/);
  await page.getByRole("button",{name:"Dock calculator right"}).click();
  await expect(dialog).not.toHaveClass(/is-docked-right/);
  await page.getByRole("button",{name:"Close calculator window"}).click();
  await page.reload();await expect(page.locator(".pm-workspace")).toBeVisible();
  await page.getByRole("button",{name:"Open calculator window",exact:true}).click();
  const restored=await dialog.boundingBox();expect(restored).not.toBeNull();
  expect(restored!.width).toBeGreaterThan(original!.width+30);
});

test("Calculator Pro short desktop keeps Plot controls within the visible window",async({page})=>{
  await page.setViewportSize({width:1365,height:768});
  await page.goto("/studio");await expect(page.locator(".pm-workspace")).toBeVisible();
  await page.getByRole("button",{name:"Open calculator window",exact:true}).click();
  const metrics=await page.evaluate(()=>{
    const panel=document.querySelector(".pm-calc-window-content")!.getBoundingClientRect();
    const plot=document.querySelector(".pm-calc-plot")!.getBoundingClientRect();
    const actions=document.querySelector(".pm-calc-actions")!.getBoundingClientRect();
    return {plotBottom:plot.bottom,actionsBottom:actions.bottom,panelBottom:panel.bottom,
      plotWidth:plot.width,viewportHeight:innerHeight};
  });
  expect(metrics.plotWidth).toBeGreaterThan(90);
  expect(metrics.actionsBottom).toBeLessThanOrEqual(metrics.panelBottom+1);
  expect(metrics.plotBottom).toBeLessThanOrEqual(metrics.viewportHeight-20);
});

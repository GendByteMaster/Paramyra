
import { expect, test } from "@playwright/test";

test("Calculator evaluates arithmetic, functions, variables and keypad without changing the graph",async({page})=>{
  await page.goto("/studio");
  await expect(page.locator(".pm-workspace")).toBeVisible();
  await page.getByRole("combobox",{name:"Mathematical form"}).selectOption("formula");
  const original=await page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].formula.exprY);
  await page.getByRole("button",{name:"Open calculator window",exact:true}).click();
  const input=page.getByRole("textbox",{name:"Calculator expression"});
  await expect(input).toHaveValue("2+2");
  await expect(page.getByLabel("Calculator result")).toHaveText("4");
  await input.fill("sin(pi/2)+sqrt(9)");
  await expect(page.getByLabel("Calculator result")).toHaveText("4");
  await input.fill("a*x+b+t");
  await page.getByRole("spinbutton",{name:"Calculator x value"}).fill("2");
  await page.getByRole("spinbutton",{name:"Calculator t value"}).fill("1");
  await expect(page.getByLabel("Calculator result")).toHaveText("6");
  await page.getByRole("button",{name:"Clear calculator"}).click();
  await page.getByRole("button",{name:"7",exact:true}).click();
  await page.getByRole("button",{name:"×",exact:true}).click();
  await page.getByRole("button",{name:"8",exact:true}).click();
  await expect(page.getByLabel("Calculator result")).toHaveText("56");
  await page.getByRole("button",{name:"Backspace"}).click();
  await expect(input).toHaveValue("7*");
  await page.getByRole("button",{name:"8",exact:true}).click();
  await page.getByRole("button",{name:"= Use result"}).click();
  await expect(input).toHaveValue("56");
  await page.getByRole("button",{name:"Use graph equation"}).click();
  await expect(input).toHaveValue("a*sin(b*x+t)");
  await page.getByRole("button",{name:"Close calculator window"}).click();
  await expect(page.getByRole("textbox",{name:"Formula Y expression"})).toHaveValue(original);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].formula.exprY)).toBe(original);
});

test("Calculator rejects unsafe syntax and invalid numeric domains",async({page})=>{
  await page.goto("/studio");
  await expect(page.locator(".pm-workspace")).toBeVisible();
  await page.getByRole("combobox",{name:"Mathematical form"}).selectOption("formula");
  await page.getByRole("button",{name:"Open calculator window",exact:true}).click();
  const input=page.getByRole("textbox",{name:"Calculator expression"});
  await input.fill("constructor(1)");
  await expect(page.locator(".pm-calc-error")).toBeVisible();
  await expect(page.getByRole("button",{name:"= Use result"})).toBeDisabled();
  await input.fill("1/0");
  await expect(page.locator(".pm-calc-error")).toContainText(/undefined/i);
  await input.fill("2+2");
  await expect(page.getByLabel("Calculator result")).toHaveText("4");
});

test("Calculator opens as a mobile modal window without horizontal overflow",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/studio");
  await expect(page.locator(".pm-workspace")).toBeVisible();
  await page.getByRole("combobox",{name:"Mathematical form"}).selectOption("formula");
  await page.getByRole("button",{name:"Open calculator window",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Scientific calculator window"})).toHaveAttribute("aria-modal","true");
  await expect(page.getByRole("button",{name:"Dismiss calculator window"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Backspace"})).toBeVisible();
  await expect(page.getByLabel("Calculator result")).toHaveText("4");
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  await page.getByRole("button",{name:"Dismiss calculator window"}).click({position:{x:6,y:6}});
  await expect(page.getByRole("dialog",{name:"Scientific calculator window"})).toHaveCount(0);
});


test("Calculator is an independent desktop window with dragging, maximize and Escape",async({page})=>{
  await page.setViewportSize({width:1365,height:768});
  await page.goto("/studio");
  await expect(page.locator(".pm-workspace")).toBeVisible();
  await page.getByRole("button",{name:"Toggle inspector"}).click();
  await expect(page.getByRole("complementary",{name:"Scene inspector"})).toHaveCount(0);
  const launcher=page.getByRole("button",{name:"Open calculator window",exact:true});
  await launcher.click();
  const dialog=page.getByRole("dialog",{name:"Scientific calculator window"});
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal","false");
  await expect(page.getByRole("textbox",{name:"Calculator expression"})).toBeFocused();
  const before=await dialog.boundingBox();
  expect(before).not.toBeNull();
  const grip=page.locator(".pm-calc-window-grip");
  await grip.dragTo(page.locator(".pm-viewport-toolbar"),{force:true});
  const after=await dialog.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after!.x-before!.x)+Math.abs(after!.y-before!.y)).toBeGreaterThan(15);
  await page.getByRole("button",{name:"Maximize calculator window"}).click();
  await expect(dialog).toHaveClass(/is-maximized/);
  await page.getByRole("button",{name:"Restore calculator window"}).click();
  await expect(dialog).not.toHaveClass(/is-maximized/);
  await page.getByRole("textbox",{name:"Calculator expression"}).fill("15/3");
  await expect(page.getByLabel("Calculator result")).toHaveText("5");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(launcher).toBeFocused();
  await launcher.click();
  await expect(page.getByRole("textbox",{name:"Calculator expression"})).toHaveValue("15/3");
});

test("Calculator opens from Formula Editor and works inside fullscreen",async({page},testInfo)=>{
  await page.goto("/studio");
  await expect(page.locator(".pm-workspace")).toBeVisible();
  await page.getByRole("combobox",{name:"Mathematical form"}).selectOption("formula");
  await page.getByRole("button",{name:"Open calculator from Formula Editor"}).click();
  await expect(page.getByRole("dialog",{name:"Scientific calculator window"})).toBeVisible();
  await page.getByRole("button",{name:"Close calculator window"}).click();
  // Mobile Chromium emulation exposes requestFullscreen without reliably completing it.
  // The mobile modal window is covered independently above; desktop owns the Fullscreen API test.
  if(testInfo.project.name==="mobile-chromium")return;
  const supported=await page.evaluate(()=>typeof document.documentElement.requestFullscreen==="function");
  if(supported){
    await page.getByRole("button",{name:"Enter fullscreen"}).click();
    await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);
    await page.getByRole("button",{name:"Open calculator window",exact:true}).click();
    await expect(page.getByRole("dialog",{name:"Scientific calculator window"})).toBeVisible();
    await page.getByRole("button",{name:"Close calculator window"}).click();
    await page.getByRole("button",{name:"Exit fullscreen"}).click();
  }
});

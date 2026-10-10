
import { expect, test } from "@playwright/test";

test("Calculator evaluates arithmetic, functions, variables and keypad without changing the graph",async({page})=>{
  await page.goto("/studio");
  await expect(page.locator(".pm-workspace")).toBeVisible();
  await page.getByRole("combobox",{name:"Mathematical form"}).selectOption("formula");
  const original=await page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].formula.exprY);
  await page.getByRole("tab",{name:"Calculator"}).click();
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
  await page.getByRole("tab",{name:"Graph",exact:true}).click();
  await expect(page.getByRole("textbox",{name:"Formula Y expression"})).toHaveValue(original);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].formula.exprY)).toBe(original);
});

test("Calculator rejects unsafe syntax and invalid numeric domains",async({page})=>{
  await page.goto("/studio");
  await expect(page.locator(".pm-workspace")).toBeVisible();
  await page.getByRole("combobox",{name:"Mathematical form"}).selectOption("formula");
  await page.getByRole("tab",{name:"Calculator"}).click();
  const input=page.getByRole("textbox",{name:"Calculator expression"});
  await input.fill("constructor(1)");
  await expect(page.locator(".pm-calc-error")).toBeVisible();
  await expect(page.getByRole("button",{name:"= Use result"})).toBeDisabled();
  await input.fill("1/0");
  await expect(page.locator(".pm-calc-error")).toContainText(/undefined/i);
  await input.fill("2+2");
  await expect(page.getByLabel("Calculator result")).toHaveText("4");
});

test("Calculator works on mobile without horizontal overflow",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/studio");
  await expect(page.locator(".pm-workspace")).toBeVisible();
  await page.getByRole("combobox",{name:"Mathematical form"}).selectOption("formula");
  await page.getByRole("tab",{name:"Calculator"}).click();
  await expect(page.getByRole("button",{name:"Backspace"})).toBeVisible();
  await expect(page.getByLabel("Calculator result")).toHaveText("4");
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

import { test, expect } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

const MAX_LAYERS = 12;
const formulas = Array.from({length:MAX_LAYERS},(_,i)=>{
  const mode = (["explicit","parametric","polar"] as const)[i%3];
  const expression = mode==="explicit"
    ? i===0 ? "tan(x)" : "a*sin(b*x+t)+c*cos(x*x)/(1+x*x)+sqrt(abs(x))"
    : mode==="parametric" ? "sin(c*u+t)+cos(5*u)/10" : "a*cos(b*theta+t)+sin(c*theta)/5";
  return {
    id:"stress-"+i,
    title:"Stress formula "+(i+1),
    kind:"formula",
    formula:{
      mode,
      exprX:mode==="parametric"?"a*cos(b*u+t)+sin(4*u)/10":"",
      exprY:expression,
      min:mode==="explicit"?-3:0,
      max:mode==="explicit"?3:Math.PI*2,
      a:1,b:3,c:2,
    },
    params:{frequencyX:3,frequencyY:2,phase:0,amplitude:1,strokeWidth:1.8},
    color:i%2===0?"#80e3db":"#a9b8ff",opacity:0.95,visible:true,
    offset:{x:(i%3-1)*0.1,y:(i%4-2)*0.1},
  };
});
const documentV3={
  schemaVersion:3, id:"stress-12",title:"12-Layer Formula Stress",
  duration:12, layers:formulas,
};

test("12 formula layers remain interactive and exportable without freezing the browser",async({page},testInfo)=>{
  test.setTimeout(60000);
  const pageErrors:string[]=[];
  page.on("pageerror",error=>pageErrors.push(error.message));
  await page.goto("/studio");
  await page.getByRole("button",{name:"Pause animation"}).click();
  await page.locator('input[type="file"]').setInputFiles({
    name:"stress.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(documentV3)),
  });
  await expect(page.locator(".pm-viewport-heading")).toContainText("12 layers");
  const library=page.getByRole("complementary",{name:"Scene library"});
  if(!(await library.isVisible()))await page.getByRole("button",{name:"Toggle scene library"}).click();
  await expect(library.getByRole("button",{name:"Add layer"})).toBeDisabled();
  if(await page.getByRole("button",{name:"Close scene library"}).isVisible()){
    await page.getByRole("button",{name:"Close scene library"}).click({position:{x:350,y:300}});
  }
  const canvas=page.locator(".pm-canvas-area canvas");
  await expect(canvas).toBeVisible();
  await page.getByRole("button",{name:"Fit scene"}).click();
  const imageLength=await canvas.evaluate(node=>(node as HTMLCanvasElement).toDataURL("image/png").length);
  expect(imageLength).toBeGreaterThan(2000);
  await page.getByRole("button",{name:"Zoom in"}).click();
  await page.getByRole("button",{name:"Toggle grid"}).click();
  await page.getByRole("button",{name:"Play animation"}).click();
  const frameGaps=await page.evaluate(async()=>{
    const deltas:number[]=[];
    let last=await new Promise<number>(resolve=>requestAnimationFrame(resolve));
    for(let i=0;i<24;i++){
      const next=await new Promise<number>(resolve=>requestAnimationFrame(resolve));
      deltas.push(next-last);last=next;
    }
    return deltas.sort((a,b)=>a-b);
  });
  const p95=frameGaps[Math.floor(frameGaps.length*.95)];
  testInfo.annotations.push({type:"performance-smoke",description:"p95 animation frame gap "+p95.toFixed(1)+"ms (headless CI, not an FPS guarantee)"});
  expect(p95).toBeLessThan(500);
  await page.getByRole("button",{name:"Pause animation"}).click();
  const [download]=await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button",{name:"Export JSON"}).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^paramyra-.*\.json$/);
  const exported=JSON.parse(await readFile((await download.path())!,"utf-8"));
  expect(exported.schemaVersion).toBe(3);
  expect(exported.layers).toHaveLength(MAX_LAYERS);
  const persist=await page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!));
  expect(persist.layers).toHaveLength(MAX_LAYERS);
  await page.reload();
  await expect(page.locator(".pm-viewport-heading")).toContainText("12 layers");
  expect(pageErrors).toEqual([]);
});

const sizes=[
  {name:"desktop-1920x1080",width:1920,height:1080},
  {name:"desktop-1365x768",width:1365,height:768},
  {name:"mobile-390x844",width:390,height:844},
] as const;

for(const size of sizes){
  test("capture visual-review evidence "+size.name, async({page},testInfo)=>{
    await page.setViewportSize({width:size.width,height:size.height});
    await page.goto("/studio");
    await page.getByRole("button",{name:"Pause animation"}).click();
    // Show the v0.9 authoring UI in every viewport, not merely the legacy preset.
    await page.getByRole("combobox",{name:"Mathematical form"}).selectOption("formula");
    const expression=page.getByRole("textbox",{name:"Formula Y expression"});
    await expect(expression).toBeVisible();
    await expression.scrollIntoViewIfNeeded();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    await mkdir("test-results/release-review",{recursive:true});
    await page.screenshot({
      path:"test-results/release-review/"+testInfo.project.name+"-"+size.name+".png",
      animations:"disabled",fullPage:true,
    });
  });
}

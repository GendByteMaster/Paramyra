import {expect,test} from "@playwright/test";

test("M3.2 renders React Flow with real handle connections and a navigable inspector",async({page})=>{
  await page.goto("/studio/graph");
  const flow=page.locator(".react-flow");
  await expect(flow).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  await expect(page.locator(".react-flow__edge")).toHaveCount(4);
  await expect(page.getByRole("complementary",{name:"Graph inspector"})).toBeVisible();
  await expect(page.getByRole("group",{name:"Live Graph binding"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Fit graph"})).toBeVisible();

  // Real XYFlow handle-to-handle drag must be validated by the authoritative
  // typed DAG operations, including atomic replacement of existing input.
  const time=page.locator(".react-flow__node").filter({
    has:page.getByRole("article",{name:"Timeline Time node"}),
  });
  const multiply=page.locator(".react-flow__node").filter({
    has:page.getByRole("article",{name:"Multiply node"}),
  });
  const source=time.locator(".pm-ng-rf-handle.output");
  const target=multiply.locator(".pm-ng-rf-handle.input").first();
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();
  await source.dragTo(target);
  await expect.poll(()=>page.evaluate(()=>{
    const stored=localStorage.getItem("paramyra.nodegraph.v2");
    if(!stored)return null;
    const graph=JSON.parse(stored);
    return graph.edges.find((edge:{target:string;port:string})=>edge.target==="product"&&edge.port==="a")?.source;
  })).toBe("time");
  await expect(page.locator(".react-flow__edge")).toHaveCount(4);
});

test("M3.2 canvas fits and Inspector remains readable on narrow desktop and phone",async({page})=>{
  for(const width of [1050,390]){
    await page.setViewportSize({width,height:850});
    await page.goto("/studio/graph");
    await expect(page.locator(".react-flow__viewport")).toBeVisible();
    await expect(page.getByRole("complementary",{name:"Graph inspector"})).toBeVisible();
    const live=page.getByRole("group",{name:"Live Graph binding"});
    await live.scrollIntoViewIfNeeded();
    const box=await live.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(220);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x+box!.width).toBeLessThanOrEqual(width+2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  }
});

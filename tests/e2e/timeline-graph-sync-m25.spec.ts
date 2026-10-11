import {test,expect} from "@playwright/test";

test("M2.5 Graph Editor follows the zoomed and panned Timeline viewport",async({page})=>{
  await page.goto("/studio");
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem("paramyra.document.v3"))).not.toBeNull();
  await page.evaluate(()=>{
    const key="paramyra.document.v3";
    const doc=JSON.parse(localStorage.getItem(key)!);
    doc.layers[0].keyframes=[
      {property:"opacity",time:0,value:0.2,ease:"linear"},
      {property:"opacity",time:8,value:0.8,ease:"linear"},
    ];
    localStorage.setItem(key,JSON.stringify(doc));
  });
  await page.reload();
  await page.getByRole("button",{name:"Pause animation"}).click();
  await page.getByRole("button",{name:"Open animation workspace"}).click();
  const editor=page.getByLabel("Keyframe Animation Editor");
  const graph=editor.getByRole("img",{name:"Interpolation graph for Opacity"});
  const points=graph.locator("polyline");
  const slider=page.getByRole("slider",{name:"Timeline position"});
  await slider.focus();await slider.press("Home");
  await expect(graph.locator("circle")).toHaveCount(2);
  await editor.getByRole("button",{name:"Zoom timeline in"}).click();
  await expect(editor.getByLabel("Visible timeline range")).toHaveText("0.00–6.00s");
  await expect(graph.locator("circle")).toHaveCount(1);
  const before=(await points.getAttribute("points"))!.split(" ")[0];
  await editor.getByRole("button",{name:"Pan timeline right"}).click();
  await expect(editor.getByLabel("Visible timeline range")).toHaveText("3.00–9.00s");
  await expect(graph.locator("circle")).toHaveCount(1);
  const after=(await points.getAttribute("points"))!.split(" ")[0];
  expect(after).not.toBe(before);
  await expect(graph.locator("path")).toHaveCount(1); // grid only; playhead is outside the viewport
  await editor.getByRole("button",{name:"Fit entire timeline"}).click();
  await expect(graph.locator("circle")).toHaveCount(2);
});

test("M2.5 keyboard precision editing keeps focus and preserves atomic group edits",async({page})=>{
  await page.goto("/studio");
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem("paramyra.document.v3"))).not.toBeNull();
  await page.evaluate(()=>{
    const key="paramyra.document.v3";
    const doc=JSON.parse(localStorage.getItem(key)!);
    doc.layers[0].keyframes=[
      {property:"opacity",time:1,value:0.3,ease:"linear"},
      {property:"opacity",time:2,value:0.7,ease:"linear"},
    ];
    localStorage.setItem(key,JSON.stringify(doc));
  });
  await page.reload();
  await page.getByRole("button",{name:"Pause animation"}).click();
  await page.getByRole("button",{name:"Open animation workspace"}).click();
  const editor=page.getByLabel("Keyframe Animation Editor");
  await editor.getByRole("combobox",{name:"Keyframe snapping"}).selectOption("1");
  const first=editor.getByRole("button",{name:"Seek to Opacity keyframe at 1.00 seconds"});
  await first.click();
  await first.press("ArrowRight");
  let moved=editor.getByRole("button",{name:"Seek to Opacity keyframe at 1.01 seconds"});
  await expect(moved).toHaveAttribute("aria-pressed","true");
  await expect(moved).toBeFocused();
  await page.keyboard.press("Shift+ArrowRight");
  moved=editor.getByRole("button",{name:"Seek to Opacity keyframe at 1.11 seconds"});
  await expect(moved).toBeFocused();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes.map((f:{time:number})=>f.time))).toEqual([1.11,2]);
  const second=editor.getByRole("button",{name:"Seek to Opacity keyframe at 2.00 seconds"});
  await second.click({modifiers:["Control"]});
  await expect(editor.getByRole("group",{name:"Multi-keyframe selection"})).toContainText("2 selected");
  await second.press("ArrowLeft");
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes.map((f:{time:number})=>f.time))).toEqual([1.1,1.99]);
  await editor.getByRole("button",{name:"Seek to Opacity keyframe at 1.99 seconds"}).press("Delete");
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes.length)).toBe(0);
  await expect(editor.getByRole("group",{name:"Multi-keyframe selection"})).toContainText("0 selected");
});

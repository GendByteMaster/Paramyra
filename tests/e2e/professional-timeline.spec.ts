import {test,expect} from "@playwright/test";

test("M2.3 timeline zoom, pan and fit use a bounded time viewport",async({page})=>{
  await page.goto("/studio");
  await page.getByRole("button",{name:"Pause animation"}).click();
  await page.getByRole("button",{name:"Open animation workspace"}).click();
  const editor=page.getByLabel("Keyframe Animation Editor");
  const slider=page.getByRole("slider",{name:"Timeline position"});
  await slider.focus();await slider.press("Home");
  const range=editor.getByLabel("Visible timeline range");
  await expect(range).toHaveText("0.00–12.00s");
  await editor.getByRole("button",{name:"Zoom timeline in"}).click();
  await expect(editor.getByLabel("Timeline zoom level")).toHaveText("2×");
  await expect(range).toHaveText("0.00–6.00s");
  await editor.getByRole("button",{name:"Pan timeline right"}).click();
  await expect(range).toHaveText("3.00–9.00s");
  const track=editor.getByLabel("Keyframe track for Opacity");
  const box=await track.boundingBox();
  expect(box).not.toBeNull();
  await track.click({position:{x:box!.width*.5,y:box!.height/2}});
  await editor.getByRole("button",{name:"Add keyframe at playhead"}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes.length)).toBe(1);
  const timestamp=await page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes[0].time as number);
  expect(timestamp).toBeGreaterThan(5.9);
  expect(timestamp).toBeLessThan(6.1);
  await editor.getByRole("button",{name:"Fit entire timeline"}).click();
  await expect(range).toHaveText("0.00–12.00s");
  await expect(track.getByRole("button",{name:"Seek to Opacity keyframe at "+timestamp.toFixed(2)+" seconds"})).toBeVisible();
});

test("M2.3 All Layers shows authoritative document tracks and navigates to another layer",async({page})=>{
  await page.goto("/studio");
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem("paramyra.document.v3"))).not.toBeNull();
  const firstTitle=await page.evaluate(()=>{
    const key="paramyra.document.v3";
    const doc=JSON.parse(localStorage.getItem(key)!);
    const second={...structuredClone(doc.layers[0]),id:"m23-second",title:"Second Track",color:"#80e3db",
      keyframes:[{property:"opacity",time:12,value:.7,ease:"linear"}]};
    doc.layers[0].keyframes=[{property:"opacity",time:0,value:.3,ease:"linear"}];
    doc.layers.push(second);
    localStorage.setItem(key,JSON.stringify(doc));
    return doc.layers[0].title as string;
  });
  await page.reload();
  await page.getByRole("button",{name:"Pause animation"}).click();
  await page.getByRole("button",{name:"Open animation workspace"}).click();
  const editor=page.getByLabel("Keyframe Animation Editor");
  await editor.getByRole("button",{name:"All layer tracks"}).click();
  const overview=editor.getByRole("region",{name:"All layer animation tracks"});
  await expect(overview).toBeVisible();
  await expect(overview.getByRole("button",{name:"Edit layer "+firstTitle})).toBeVisible();
  await expect(overview.getByRole("button",{name:"Edit layer Second Track"})).toBeVisible();
  await overview.getByRole("button",{name:"Navigate "+firstTitle+" Opacity keyframe 0.00 seconds"}).click();
  await expect(overview.getByRole("button",{name:"Edit layer "+firstTitle})).toHaveAttribute("aria-pressed","true");
  await overview.getByRole("button",{name:"Navigate Second Track Opacity keyframe 12.00 seconds"}).click();
  await expect(overview.getByRole("button",{name:"Edit layer Second Track"})).toHaveAttribute("aria-pressed","true");
  await editor.getByRole("button",{name:"Selected layer tracks"}).click();
  await expect(editor.getByLabel("Keyframe track for Opacity")).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers.length)).toBe(2);
});

test("M2.3 optional snapping rounds inserts while Snap Off retains hundredths",async({page})=>{
  await page.goto("/studio");
  await page.getByRole("button",{name:"Pause animation"}).click();
  await page.getByRole("button",{name:"Open animation workspace"}).click();
  const editor=page.getByLabel("Keyframe Animation Editor");
  const track=editor.getByLabel("Keyframe track for Opacity");
  const box=await track.boundingBox();
  expect(box).not.toBeNull();
  await editor.getByRole("combobox",{name:"Keyframe snapping"}).selectOption("0.5");
  await track.click({position:{x:box!.width*.21,y:box!.height/2}});
  await editor.getByRole("button",{name:"Add keyframe at playhead"}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes[0].time)).toBe(2.5);
  await editor.getByRole("combobox",{name:"Keyframe snapping"}).selectOption("0");
  await track.click({position:{x:box!.width*.36,y:box!.height/2}});
  await editor.getByRole("button",{name:"Add keyframe at playhead"}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes.length)).toBe(2);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes[1].time))
    .toBeGreaterThan(4.15);
  const actual=await page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes[1].time);
  expect(actual).toBeLessThan(4.5);
  expect(actual%0.5).not.toBe(0);
});

test("M2.3 marquee selects keys across tracks without mutating document",async({page})=>{
  await page.goto("/studio");
  await page.getByRole("button",{name:"Pause animation"}).click();
  await page.getByRole("button",{name:"Open animation workspace"}).click();
  const editor=page.getByLabel("Keyframe Animation Editor");
  const opacity=editor.getByLabel("Keyframe track for Opacity");
  const position=editor.getByLabel("Keyframe track for Position X");
  let bounds=await opacity.boundingBox();expect(bounds).not.toBeNull();
  await opacity.click({position:{x:bounds!.width*.25,y:bounds!.height/2}});
  await editor.getByRole("button",{name:"Add keyframe at playhead"}).click();
  await editor.getByRole("combobox",{name:"Animated property"}).selectOption("offset.x");
  bounds=await position.boundingBox();expect(bounds).not.toBeNull();
  await position.click({position:{x:bounds!.width*.65,y:bounds!.height/2}});
  await editor.getByRole("button",{name:"Add keyframe at playhead"}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes.length)).toBe(2);
  const before=await page.evaluate(()=>localStorage.getItem("paramyra.document.v3"));
  await editor.getByRole("button",{name:"Toggle box selection tool"}).click();
  await expect(editor.getByRole("button",{name:"Toggle box selection tool"})).toHaveAttribute("aria-pressed","true");
  const first=await opacity.boundingBox(),second=await position.boundingBox();
  expect(first).not.toBeNull();expect(second).not.toBeNull();
  await page.mouse.move(first!.x+first!.width*.17,first!.y+first!.height/2);
  await page.mouse.down();
  await page.mouse.move(second!.x+second!.width*.75,second!.y+second!.height/2,{steps:9});
  await page.mouse.up();
  await expect(editor.getByRole("group",{name:"Multi-keyframe selection"})).toContainText("2 selected");
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem("paramyra.document.v3"))).toBe(before);
});

test("M2.3 timeline controls remain usable on narrow mobile screens",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/studio");
  await page.getByRole("button",{name:"Open animation workspace"}).click();
  const editor=page.getByLabel("Keyframe Animation Editor");
  await editor.getByRole("button",{name:"Zoom timeline in"}).click();
  await expect(editor.getByLabel("Timeline zoom level")).toHaveText("2×");
  await editor.getByRole("button",{name:"All layer tracks"}).click();
  await expect(editor.getByRole("region",{name:"All layer animation tracks"})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

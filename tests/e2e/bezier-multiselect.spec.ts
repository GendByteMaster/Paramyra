import {test,expect} from "@playwright/test";

test("M2.2 cubic Bezier easing persists and Undo/Redo covers handle edits",async({page})=>{
  await page.goto("/studio");
  await page.getByRole("button",{name:"Pause animation"}).click();
  await page.getByRole("button",{name:"Open animation workspace"}).click();
  const editor=page.getByLabel("Keyframe Animation Editor");
  const slider=page.getByRole("slider",{name:"Timeline position"});
  await slider.focus();await slider.press("Home");
  await editor.getByRole("button",{name:"Add keyframe at playhead"}).click();
  await slider.focus();await slider.press("End");
  await editor.getByRole("button",{name:"Add keyframe at playhead"}).click();
  await slider.focus();await slider.press("Home");
  await editor.getByRole("combobox",{name:"Keyframe easing"}).selectOption("bezier");
  const curve=editor.getByRole("group",{name:"Cubic Bezier curve editor"});
  await expect(curve).toBeVisible();
  await expect(curve.getByRole("group",{name:"Cubic Bezier control handles"})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes[0].bezier.x1)).toBe(.42);
  await curve.getByRole("spinbutton",{name:"Bezier x1"}).fill("0.19");
  await curve.getByRole("spinbutton",{name:"Bezier x1"}).press("Tab");
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes[0].bezier.x1)).toBe(.19);
  await page.getByRole("button",{name:"Undo",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes[0].bezier.x1)).toBe(.42);
  await page.getByRole("button",{name:"Redo",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes[0].bezier.x1)).toBe(.19);
  await page.reload();
  await page.getByRole("button",{name:"Open animation workspace"}).click();
  const reloaded=page.getByLabel("Keyframe Animation Editor");
  const first=reloaded.getByRole("button",{name:"Seek to Opacity keyframe at 0.00 seconds"});
  await first.click();
  await expect(reloaded.getByRole("group",{name:"Cubic Bezier curve editor"})).toBeVisible();
});

test("M2.2 Bezier handle supports real pointer dragging and keyboard nudging",async({page})=>{
  await page.goto("/studio");
  await page.getByRole("button",{name:"Pause animation"}).click();
  await page.getByRole("button",{name:"Open animation workspace"}).click();
  const editor=page.getByLabel("Keyframe Animation Editor");
  const seek=page.getByRole("slider",{name:"Timeline position"});
  await seek.focus();await seek.press("Home");
  await editor.getByRole("button",{name:"Add keyframe at playhead"}).click();
  await seek.focus();await seek.press("End");
  await editor.getByRole("button",{name:"Add keyframe at playhead"}).click();
  await seek.focus();await seek.press("Home");
  await editor.getByRole("combobox",{name:"Keyframe easing"}).selectOption("bezier");
  const handle=editor.getByRole("button",{name:"Bezier control handle 1"});
  await handle.scrollIntoViewIfNeeded();
  const box=await handle.boundingBox();
  expect(box).not.toBeNull();
  const cx=box!.x+box!.width/2,cy=box!.y+box!.height/2;
  await page.mouse.move(cx,cy);
  await page.mouse.down();
  await page.mouse.move(cx+25,cy-28,{steps:5});
  await page.mouse.up();
  const x1=await expect.poll(()=>page.evaluate(()=>
    JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes[0].bezier.x1
  )).toBeGreaterThan(.42);
  void x1;
  await handle.focus();await handle.press("ArrowUp");
  await expect.poll(()=>page.evaluate(()=>
    JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes[0].bezier.y1
  )).toBeGreaterThan(0);
});

test("M2.2 multi-select translates keys atomically and supports Delete/Undo",async({page})=>{
  await page.goto("/studio");
  await page.getByRole("button",{name:"Pause animation"}).click();
  await page.getByRole("button",{name:"Open animation workspace"}).click();
  const editor=page.getByLabel("Keyframe Animation Editor");
  const track=editor.getByLabel("Keyframe track for Opacity");
  const rect=await track.boundingBox();
  expect(rect).not.toBeNull();
  await track.click({position:{x:rect!.width*.25,y:rect!.height/2}});
  await editor.getByRole("button",{name:"Add keyframe at playhead"}).click();
  await track.click({position:{x:rect!.width*.65,y:rect!.height/2}});
  await editor.getByRole("button",{name:"Add keyframe at playhead"}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes.length)).toBe(2);
  const markers=track.locator(".pm-keyframe-marker");
  await markers.nth(0).click();
  await markers.nth(1).click({modifiers:["Control"]});
  const group=editor.getByRole("group",{name:"Multi-keyframe selection"});
  await expect(group).toContainText("2 selected");
  const original=await page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes.map((f:{time:number})=>f.time));
  await group.getByRole("spinbutton",{name:"Keyframe group shift"}).fill("0.25");
  await group.getByRole("button",{name:"Move selected keyframes"}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes.map((f:{time:number})=>f.time)))
    .toEqual(original.map((t:number)=>Math.round((t+.25)*100)/100));
  await page.getByRole("button",{name:"Undo",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes.map((f:{time:number})=>f.time))).toEqual(original);
  await page.getByRole("button",{name:"Redo",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes.map((f:{time:number})=>f.time)))
    .toEqual(original.map((t:number)=>Math.round((t+.25)*100)/100));
  await group.getByRole("button",{name:"Delete selected keyframes"}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes.length)).toBe(0);
  await page.getByRole("button",{name:"Undo",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("paramyra.document.v3")!).layers[0].keyframes.length)).toBe(2);
});

test("M2.2 Bezier and multi-selection controls fit mobile",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/studio");
  await page.getByRole("button",{name:"Open animation workspace"}).click();
  const editor=page.getByLabel("Keyframe Animation Editor");
  await page.getByRole("button",{name:"Pause animation"}).click();
  await page.getByRole("slider",{name:"Timeline position"}).focus();
  await page.getByRole("slider",{name:"Timeline position"}).press("Home");
  await editor.getByRole("button",{name:"Add keyframe at playhead"}).click();
  await editor.getByRole("combobox",{name:"Keyframe easing"}).selectOption("bezier");
  await expect(editor.getByRole("group",{name:"Cubic Bezier curve editor"})).toBeVisible();
  await expect(editor.getByRole("group",{name:"Multi-keyframe selection"})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

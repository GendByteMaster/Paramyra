import {test,expect} from "@playwright/test";

test("Studio saves separately named projects, layers and graph snapshots",async({page})=>{
  await page.goto("/studio");
  await expect(page.locator("#frequencyX")).toBeVisible();
  await page.locator("#frequencyX").focus();
  await page.locator("#frequencyX").press("End");
  await expect(page.locator("#frequencyX")).toHaveValue("12");
  await page.getByRole("button",{name:"Open project library"}).click();
  const projects=page.getByRole("dialog",{name:"Studio project library"});
  await expect(projects).toBeVisible();
  await expect(projects.getByText("1 / 20 projects")).toBeVisible();
  await projects.getByRole("button",{name:"New Project"}).click();
  await expect(projects).toHaveCount(0);
  await expect(page.locator("#frequencyX")).toHaveValue("3");
  await page.locator("#frequencyX").focus();
  await page.locator("#frequencyX").press("Home");
  await expect(page.locator("#frequencyX")).toHaveValue("1");
  await page.getByRole("button",{name:"Open project library"}).click();
  await expect(projects.getByText("2 / 20 projects")).toBeVisible();
  await projects.getByRole("button",{name:"Open",exact:true}).click();
  await expect(page.locator("#frequencyX")).toHaveValue("12");
  await page.reload();
  await expect(page.locator("#frequencyX")).toHaveValue("12");
  const stored=JSON.parse((await page.evaluate(()=>localStorage.getItem("paramyra.studio.projects.v1")))!);
  expect(stored.projects).toHaveLength(2);
  expect(stored.projects.map((p:{scene:{layers:Array<{params:{frequencyX:number}}>}})=>p.scene.layers[0].params.frequencyX).sort()).toEqual([1,12]);
});

test("Studio project library renames, duplicates and deletes without corrupting other projects",async({page})=>{
  await page.goto("/studio");
  await page.getByRole("button",{name:"Open project library"}).click();
  const modal=page.getByRole("dialog",{name:"Studio project library"});
  await modal.getByRole("button",{name:"Duplicate project Lissajous Curves"}).click();
  await page.getByRole("button",{name:"Open project library"}).click();
  const projectName=modal.getByRole("button",{name:"Rename project Lissajous Curves Copy"});
  await projectName.click();
  await modal.getByRole("textbox",{name:"Rename Lissajous Curves Copy"}).fill("Wave Research");
  await modal.getByRole("button",{name:"Save name for Lissajous Curves Copy"}).click();
  await expect(modal.getByText("Wave Research")).toBeVisible();
  page.once("dialog",dialog=>dialog.accept());
  await modal.getByRole("button",{name:"Delete project Wave Research"}).click();
  // Deleting the active project switches to the preserved original and closes the dialog.
  await expect(modal).toHaveCount(0);
  await page.getByRole("button",{name:"Open project library"}).click();
  await expect(modal.getByText("Wave Research")).toHaveCount(0);
  await expect(modal.getByText("1 / 20 projects")).toBeVisible();
  await expect(modal.getByRole("button",{name:"Delete project Lissajous Curves"})).toBeDisabled();
});

test("Switching Studio projects restores distinct Node Graph values",async({page})=>{
  await page.goto("/studio");
  await expect(page.locator("#frequencyX")).toBeVisible();
  await page.goto("/studio/graph");
  await expect(page.getByRole("article",{name:"Amplitude node"})).toBeVisible();
  await page.getByRole("article",{name:"Amplitude node"}).click();
  await page.getByRole("spinbutton",{name:"Constant value"}).fill("9");
  await page.getByRole("spinbutton",{name:"Constant value"}).blur();
  await expect(page.getByRole("spinbutton",{name:"Constant value"})).toHaveValue("9");

  await page.goto("/studio");
  await page.getByRole("button",{name:"Open project library"}).click();
  await page.getByRole("dialog",{name:"Studio project library"}).getByRole("button",{name:"New Project"}).click();
  await page.goto("/studio/graph");
  await expect(page.getByRole("article",{name:"Amplitude node"})).toBeVisible();
  await page.getByRole("article",{name:"Amplitude node"}).click();
  await expect(page.getByRole("spinbutton",{name:"Constant value"})).toHaveValue("1");
  await page.goto("/studio");
  await page.getByRole("button",{name:"Open project library"}).click();
  await page.getByRole("dialog",{name:"Studio project library"}).getByRole("button",{name:"Open",exact:true}).click();
  await page.goto("/studio/graph");
  await page.getByRole("article",{name:"Amplitude node"}).click();
  await expect(page.getByRole("spinbutton",{name:"Constant value"})).toHaveValue("9");
});

test("Project Library is accessible on compact mobile widths",async({page})=>{
  await page.setViewportSize({width:390,height:780});
  await page.goto("/studio");
  await page.getByRole("button",{name:"Open project library"}).click();
  const modal=page.getByRole("dialog",{name:"Studio project library"});
  await expect(modal).toBeVisible();
  await expect(modal.getByRole("button",{name:"New Project"})).toBeVisible();
  const box=await modal.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x+box!.width).toBeLessThanOrEqual(392);
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
});

test("Duplicate projects preserve independent Coursework and timeline snapshots",async({page})=>{
  await page.goto("/studio/graph");
  await page.getByRole("button",{name:"Open coursework mode"}).click();
  await page.getByRole("textbox",{name:"Research objective"}).fill("Original project study");
  await expect(page.getByText("Saved in this project · Included in project export")).toBeVisible();
  await page.goto("/studio");
  await page.getByRole("button",{name:"Open project library"}).click();
  const dialog=page.getByRole("dialog",{name:"Studio project library"});
  await dialog.getByRole("button",{name:"Duplicate project Lissajous Curves"}).click();
  await page.goto("/studio/graph");
  await page.getByRole("button",{name:"Open coursework mode"}).click();
  await expect(page.getByRole("textbox",{name:"Research objective"})).toHaveValue("Original project study");
  await page.getByRole("textbox",{name:"Research objective"}).fill("Copy-only study");
  await page.goto("/studio");
  await page.getByRole("button",{name:"Open project library"}).click();
  await page.getByRole("dialog",{name:"Studio project library"}).getByRole("button",{name:"Open",exact:true}).click();
  await page.goto("/studio/graph");
  await page.getByRole("button",{name:"Open coursework mode"}).click();
  await expect(page.getByRole("textbox",{name:"Research objective"})).toHaveValue("Original project study");
  const data=JSON.parse((await page.evaluate(()=>localStorage.getItem("paramyra.studio.projects.v1")))!);
  expect(data.version).toBe(2);
  expect(data.projects.map((p:{coursework:{objective:string}})=>p.coursework.objective).sort()).toEqual(["Copy-only study","Original project study"]);
});


test("M4.2 IndexedDB checkpoint saves full project and restores the requested revision",async({page})=>{
  await page.goto("/studio");
  await expect(page.locator("#frequencyX")).toBeVisible();
  const open=page.getByRole("button",{name:"Open project library"});
  await open.click();
  const modal=page.getByRole("dialog",{name:"Studio project library"});
  await expect(modal.getByText("No recovery checkpoint saved yet")).toBeVisible();
  await modal.getByRole("button",{name:"Save checkpoint"}).click();
  await expect(modal.getByText("Recovery checkpoint saved · Revision 1")).toBeVisible();
  await modal.getByRole("button",{name:"Close project library"}).click();
  await page.locator("#frequencyX").focus();
  await page.locator("#frequencyX").press("End");
  await expect(page.locator("#frequencyX")).toHaveValue("12");
  await open.click();
  await expect(modal.getByText("Recovery checkpoint · Revision 1")).toBeVisible();
  page.once("dialog",dialog=>dialog.accept());
  await modal.getByRole("button",{name:"Restore checkpoint"}).click();
  await expect(page.locator("#frequencyX")).toHaveValue("3");
  const snapshot=await page.evaluate(async()=>{
    const request=indexedDB.open("paramyra-studio-checkpoints",1);
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    try{return await new Promise<{revision:number;library:{version:number}}>((resolve,reject)=>{
      const tx=db.transaction("snapshots","readonly");
      const get=tx.objectStore("snapshots").get("studio-library");
      get.onsuccess=()=>resolve(get.result);get.onerror=()=>reject(get.error);
    });}finally{db.close();}
  });
  expect(snapshot.revision).toBe(1);
  expect(snapshot.library.version).toBe(2);
});

test("M4.2 refuses to overwrite a recovery checkpoint committed in another tab",async({context})=>{
  const left=await context.newPage(),right=await context.newPage();
  try{
    await Promise.all([left.goto("/studio"),right.goto("/studio")]);
    await left.getByRole("button",{name:"Open project library"}).click();
    await right.getByRole("button",{name:"Open project library"}).click();
    const a=left.getByRole("dialog",{name:"Studio project library"});
    const b=right.getByRole("dialog",{name:"Studio project library"});
    await expect(a.getByText("No recovery checkpoint saved yet")).toBeVisible();
    await expect(b.getByText("No recovery checkpoint saved yet")).toBeVisible();
    await a.getByRole("button",{name:"Save checkpoint"}).click();
    await expect(a.getByText("Recovery checkpoint saved · Revision 1")).toBeVisible();
    await b.getByRole("button",{name:"Save checkpoint"}).click();
    await expect(b.getByText(/Conflict: another tab updated/)).toBeVisible();
  }finally{await left.close();await right.close();}
});


test("M4.2.1 transactional snapshot bootstrap and CAS reject stale tab edits",async({context})=>{
  const left=await context.newPage(),right=await context.newPage();
  try{
    await Promise.all([left.goto("/studio"),right.goto("/studio")]);
    await left.getByRole("button",{name:"Open project library"}).click();
    await right.getByRole("button",{name:"Open project library"}).click();
    const a=left.getByRole("dialog",{name:"Studio project library"});
    const b=right.getByRole("dialog",{name:"Studio project library"});
    const previewA=a.locator(".pm-project-storage-preview");
    const previewB=b.locator(".pm-project-storage-preview");
    await previewA.locator("summary").click();
    await previewB.locator("summary").click();
    await expect(previewA.getByText("No transactional snapshot initialized")).toBeVisible();
    await expect(previewB.getByText("No transactional snapshot initialized")).toBeVisible();
    await previewA.getByRole("button",{name:"Initialize snapshot"}).click();
    await expect(previewA.getByText("Initialized transactional snapshot · Revision 1")).toBeVisible();
    await previewB.getByRole("button",{name:"Initialize snapshot"}).click();
    await expect(previewB.getByText("Loaded existing transactional snapshot · Revision 1")).toBeVisible();
    await previewA.getByRole("button",{name:"Commit local snapshot"}).click();
    await expect(previewA.getByText("Transaction committed · Revision 2")).toBeVisible();
    await previewB.getByRole("button",{name:"Commit local snapshot"}).click();
    await expect(previewB.getByText(/Conflict: transactional snapshot changed/)).toBeVisible();
    const record=await left.evaluate(async()=>{
      const db=await new Promise<IDBDatabase>((resolve,reject)=>{
        const request=indexedDB.open("paramyra-studio-checkpoints");
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
      });
      try{return await new Promise<{revision:number;library:{version:number;projects:unknown[]}}>((resolve,reject)=>{
        const request=db.transaction("snapshots","readonly").objectStore("snapshots").get("studio-library-live");
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
      });}finally{db.close();}
    });
    expect(record.revision).toBe(2);
    expect(record.library.version).toBe(2);
    expect(record.library.projects).toHaveLength(1);
  }finally{await left.close();await right.close();}
});

test("M4.2.1 corrupt legacy registry must not initialize transactional storage",async({page})=>{
  await page.goto("/studio");
  await page.evaluate(()=>localStorage.setItem("paramyra.studio.projects.v1",'{"version":999}'));
  await page.getByRole("button",{name:"Open project library"}).click();
  const preview=page.locator(".pm-project-storage-preview");
  await preview.locator("summary").click();
  await preview.getByRole("button",{name:"Initialize snapshot"}).click();
  await expect(preview.getByText(/Cannot initialize: invalid-legacy/)).toBeVisible();
  const record=await page.evaluate(async()=>{
    const request=indexedDB.open("paramyra-studio-checkpoints");
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    try{return await new Promise<unknown>((resolve,reject)=>{
      const get=db.transaction("snapshots","readonly").objectStore("snapshots").get("studio-library-live");
      get.onsuccess=()=>resolve(get.result);get.onerror=()=>reject(get.error);
    });}finally{db.close();}
  });
  expect(record).toBeUndefined();
});

import {test,expect,type Page} from "@playwright/test";

async function durableSnapshot(page:Page){
  return page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{
      const req=indexedDB.open("paramyra-studio-checkpoints",1);
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
    try{return await new Promise<{
      revision:number;library:{activeId:string;projects:Array<{
        name:string;scene:{layers:Array<{params:{frequencyX:number}}>};
        graph:{nodes:Array<{id:string;value?:number}>};
        coursework:{objective:string};
      }>};
    }>((resolve,reject)=>{
      const req=db.transaction("snapshots","readonly").objectStore("snapshots").get("studio-library-live");
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });}finally{db.close();}
  });
}
async function enableDurable(page:Page){
  await page.goto("/studio");
  await expect(page.locator("#frequencyX")).toBeVisible();
  await page.getByRole("button",{name:"Open project library"}).click();
  const projects=page.getByRole("dialog",{name:"Studio project library"});
  await projects.locator(".pm-project-storage-preview summary").click();
  page.once("dialog",dialog=>dialog.accept());
  await projects.getByRole("button",{name:"Enable transactional autosave"}).click();
  await expect(page.getByText("Saved in IndexedDB")).toBeVisible();
}

test("M4.2.2 authoritative IDB persists Studio scene, graph, Coursework and new projects",async({page})=>{
  await enableDurable(page);
  const control=page.locator("#frequencyX");
  await control.focus();await control.press("End");
  await expect(control).toHaveValue("12");
  await expect.poll(async()=>(await durableSnapshot(page)).library.projects[0].scene.layers[0].params.frequencyX).toBe(12);
  await page.goto("/studio/graph");
  await expect(page.getByText("Saved in IndexedDB")).toBeVisible();
  await page.getByRole("article",{name:"Amplitude node"}).click();
  await page.getByRole("spinbutton",{name:"Constant value"}).fill("9");
  await page.getByRole("spinbutton",{name:"Constant value"}).blur();
  await expect.poll(async()=>{
    const snapshot=await durableSnapshot(page);
    return snapshot.library.projects.find(p=>p.graph.nodes.some(n=>n.id==="amp"))?.graph.nodes.find(n=>n.id==="amp")?.value;
  }).toBe(9);
  await page.getByRole("button",{name:"Open coursework mode"}).click();
  await page.getByRole("textbox",{name:"Research objective"}).fill("Durable report on mathematical models");
  await expect.poll(async()=>(await durableSnapshot(page)).library.projects[0].coursework.objective).toBe("Durable report on mathematical models");
  await page.goto("/studio");
  await expect(page.locator("#frequencyX")).toHaveValue("12");
  await page.getByRole("button",{name:"Open project library"}).click();
  const modal=page.getByRole("dialog",{name:"Studio project library"});
  await modal.getByRole("button",{name:"New Project"}).click();
  await expect(modal).toHaveCount(0);
  await expect.poll(async()=>(await durableSnapshot(page)).library.projects.length).toBe(2);
  await page.reload();
  await expect(page.locator("#frequencyX")).toHaveValue("3");
  const durable=await durableSnapshot(page);
  expect(durable.library.projects).toHaveLength(2);
  expect(durable.revision).toBeGreaterThan(3);
});

test("M4.2.2 concurrent editing fails closed and preserves saved project revision",async({context})=>{
  const a=await context.newPage(),b=await context.newPage();
  try{
    await enableDurable(a);
    await b.goto("/studio");
    await expect(b.getByText("Saved in IndexedDB")).toBeVisible();
    const first=a.locator("#frequencyX");
    await first.focus();await first.press("End");
    await expect.poll(async()=>(await durableSnapshot(a)).library.projects[0].scene.layers[0].params.frequencyX).toBe(12);
    const revision=(await durableSnapshot(a)).revision;
    const stale=b.locator("#frequencyX");
    await stale.focus();await stale.press("Home");
    await expect(b.getByRole("alert").filter({hasText:"Save conflict / unavailable storage"})).toBeVisible();
    const saved=await durableSnapshot(a);
    expect(saved.revision).toBe(revision);
    expect(saved.library.projects[0].scene.layers[0].params.frequencyX).toBe(12);
    await b.reload();
    await expect(b.locator("#frequencyX")).toHaveValue("12");
  }finally{await a.close();await b.close();}
});


test("M4.2.2 Gallery launch creates a separate project instead of replacing the active one",async({page})=>{
  await enableDurable(page);
  const original=await durableSnapshot(page);
  await page.goto("/studio?kind=polar-rose");
  await expect.poll(async()=>(await durableSnapshot(page)).library.projects.length).toBe(2);
  await expect(page.locator("#frequencyX")).toBeVisible();
  const stored=await durableSnapshot(page);
  expect(stored.library.projects.map(p=>p.scene.layers[0].params.frequencyX)).toContain(original.library.projects[0].scene.layers[0].params.frequencyX);
  expect(stored.library.activeId).not.toBe(original.library.activeId);
  expect(new URL(page.url()).searchParams.has("kind")).toBe(false);
});

test("M4.2.2 checkpoint restore replaces durable project through a revisioned commit",async({page})=>{
  await enableDurable(page);
  const launch=page.getByRole("button",{name:"Open project library"});
  await launch.click();
  const dialog=page.getByRole("dialog",{name:"Studio project library"});
  await expect(dialog.getByText("No recovery checkpoint saved yet")).toBeVisible();
  await dialog.getByRole("button",{name:"Save checkpoint"}).click();
  await expect(dialog.getByText("Recovery checkpoint saved · Revision 1")).toBeVisible();
  await dialog.getByRole("button",{name:"Close project library"}).click();
  const control=page.locator("#frequencyX");
  await control.focus();await control.press("End");
  await expect.poll(async()=>(await durableSnapshot(page)).library.projects[0].scene.layers[0].params.frequencyX).toBe(12);
  await launch.click();
  page.once("dialog",d=>d.accept());
  await dialog.getByRole("button",{name:"Restore checkpoint"}).click();
  await expect(page.locator("#frequencyX")).toHaveValue("3");
  expect((await durableSnapshot(page)).library.projects[0].scene.layers[0].params.frequencyX).toBe(3);
});


test("M4.2.2 rejected invalid project rename does not lock valid transactional edits",async({page})=>{
  await enableDurable(page);
  await page.getByRole("button",{name:"Open project library"}).click();
  const modal=page.getByRole("dialog",{name:"Studio project library"});
  await modal.getByRole("button",{name:"Rename project Lissajous Curves"}).click();
  await modal.getByRole("textbox",{name:"Rename Lissajous Curves"}).fill("    ");
  await modal.getByRole("button",{name:"Save name for Lissajous Curves"}).click();
  await expect(page.getByRole("alert").filter({hasText:"Save conflict / unavailable storage"})).toHaveCount(0);
  await modal.getByRole("button",{name:"Rename project Lissajous Curves"}).click();
  await modal.getByRole("textbox",{name:"Rename Lissajous Curves"}).fill("Verified Project");
  await modal.getByRole("button",{name:"Save name for Lissajous Curves"}).click();
  await expect(modal.getByText("Verified Project")).toBeVisible();
  await expect.poll(async()=>(await durableSnapshot(page)).library.projects[0].name).toBe("Verified Project");
});

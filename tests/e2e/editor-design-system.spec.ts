import { expect, test, type Page } from "@playwright/test";

type EditorGeometry = {
  shell: { x: number; y: number; width: number; height: number };
  header: { x: number; y: number; width: number; height: number };
  grid: { display: string; columns: string };
  left: { width: number; radius: string; background: string; headingHeight: number };
  right: { width: number; radius: string; background: string; headingHeight: number };
  viewportHeaderHeight: number;
  inspectorScroll: string;
  documentOverflow: number;
};

async function inspectEditor(page: Page, path: string): Promise<EditorGeometry> {
  await page.goto(path);
  await expect(page.locator(".pm-editor-shell")).toBeVisible();
  return page.evaluate(() => {
    const find = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error("Missing shared workspace primitive: " + selector);
      return element;
    };
    const bounds = (element: HTMLElement) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    const panel = (element: HTMLElement) => ({
      width: element.getBoundingClientRect().width,
      radius: getComputedStyle(element).borderTopLeftRadius,
      background: getComputedStyle(element).backgroundImage,
      headingHeight: element.querySelector<HTMLElement>(".pm-editor-panel-heading")!.getBoundingClientRect().height,
    });
    const shell = find(".pm-editor-shell");
    const grid = find(".pm-editor-pane-layout");
    const left = grid.querySelector<HTMLElement>("aside.pm-editor-panel")!;
    const right = grid.querySelector<HTMLElement>("aside.pm-editor-panel:last-child")!;
    return {
      shell: bounds(shell),
      header: bounds(find(".pm-editor-topbar")),
      grid: {
        display: getComputedStyle(grid).display,
        columns: getComputedStyle(grid).gridTemplateColumns,
      },
      left: panel(left),
      right: panel(right),
      viewportHeaderHeight: find(".pm-editor-viewport-heading").getBoundingClientRect().height,
      inspectorScroll: getComputedStyle(find(".pm-inspector-scroll, .pm-ng-inspector-scroll")).overflowY,
      documentOverflow: document.documentElement.scrollHeight - window.innerHeight,
    };
  });
}

test("Studio and Node Graph have identical desktop shell, pane tracks, headings and scroll ownership", async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  const studio = await inspectEditor(page, "/studio");
  const graph = await inspectEditor(page, "/studio/graph");

  expect(studio.grid.display).toBe("grid");
  expect(graph.grid.display).toBe("grid");
  expect(graph.grid.columns).toBe(studio.grid.columns);
  expect(graph.shell).toEqual(studio.shell);
  expect(graph.header).toEqual(studio.header);
  expect(graph.left).toEqual(studio.left);
  expect(graph.right).toEqual(studio.right);
  expect(graph.viewportHeaderHeight).toBe(studio.viewportHeaderHeight);
  expect(studio.inspectorScroll).toBe("auto");
  expect(graph.inspectorScroll).toBe("auto");
  expect(studio.documentOverflow).toBeLessThanOrEqual(1);
  expect(graph.documentOverflow).toBeLessThanOrEqual(1);
});

test("Shared desktop shell keeps equal panel tracks on compact desktop widths", async ({page}) => {
  await page.setViewportSize({width:1000,height:800});
  const studio = await inspectEditor(page, "/studio");
  const graph = await inspectEditor(page, "/studio/graph");
  expect(studio.grid.display).toBe("grid");
  expect(graph.grid.display).toBe("grid");
  expect(graph.grid.columns).toBe(studio.grid.columns);
  expect(graph.shell).toEqual(studio.shell);
  expect(studio.documentOverflow).toBeLessThanOrEqual(1);
  expect(graph.documentOverflow).toBeLessThanOrEqual(1);
});

test("Studio and Graph use document scroll on compact screens without public site chrome", async ({page}) => {
  await page.setViewportSize({width:800,height:600});
  for (const path of ["/studio", "/studio/graph"]) {
    await page.goto(path);
    await expect(page.locator(".pm-editor-shell")).toBeVisible();
    await expect(page.locator("header.topbar")).toHaveCount(0);
    await expect(page.locator("body > footer")).toHaveCount(0);
    const state = await page.evaluate(() => ({
      htmlOverflow: getComputedStyle(document.documentElement).overflowY,
      bodyOverflow: getComputedStyle(document.body).overflowY,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      viewport: innerHeight,
    }));
    expect(state.htmlOverflow).toBe("auto");
    expect(state.bodyOverflow).toBe("auto");
    expect(state.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(state.scrollHeight).toBeGreaterThan(state.viewport);
  }
});

test("Studio and Graph share real heading markup, icons, mode navigation and viewport title hierarchy", async ({page}) => {
  await page.setViewportSize({width:1728,height:900});
  for (const path of ["/studio","/studio/graph"]) {
    await page.goto(path);

    const headings=page.locator(".pm-editor-panel-heading");
    await expect(headings).toHaveCount(2);
    await expect(headings.nth(0).locator("h2")).toHaveText(path==="/studio"?"Scene Library":"Node Library");
    await expect(headings.nth(1).locator("h2")).toHaveText("Inspector");
    await expect(headings.nth(0).locator(".pm-editor-panel-kicker")).toHaveText("LIBRARY");
    await expect(headings.nth(1).locator(".pm-editor-panel-kicker")).toHaveText("PROPERTIES");
    await expect(headings.locator(".pm-editor-panel-icon")).toHaveCount(2);

    const switcher=page.getByRole("navigation",{name:"Workspace modes"});
    await expect(switcher).toBeVisible();
    if (path==="/studio") {
      await expect(switcher.getByRole("link",{name:"Studio"})).toHaveAttribute("aria-current","page");
    } else {
      await expect(switcher.getByRole("link",{name:"Node Graph"})).toHaveAttribute("aria-current","page");
    }
    await expect(page.locator(".pm-editor-viewport-title strong")).toHaveCount(1);

    const geometric = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".pm-editor-panel-heading")].map(head => ({
      height: head.getBoundingClientRect().height,
      iconWidth: head.querySelector<HTMLElement>(".pm-editor-panel-icon")!.getBoundingClientRect().width,
      direction: getComputedStyle(head).display,
    })));
    expect(geometric[0]).toEqual(geometric[1]);
    expect(geometric[0].height).toBe(96);
    expect(geometric[0].iconWidth).toBe(35);
    expect(geometric[0].direction).toBe("flex");
  }
});

test("Studio and Graph workspace tabs navigate both ways without loading the marketing chrome", async ({page}) => {
  await page.goto("/studio");
  await page.getByRole("link",{name:"Open Node Graph Workspace"}).click();
  await expect(page).toHaveURL(/\/studio\/graph$/);
  await expect(page.getByRole("navigation",{name:"Workspace modes"}).getByRole("link",{name:"Node Graph"})).toHaveAttribute("aria-current","page");
  await page.getByRole("navigation",{name:"Workspace modes"}).getByRole("link",{name:"Studio"}).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByRole("navigation",{name:"Workspace modes"}).getByRole("link",{name:"Studio"})).toHaveAttribute("aria-current","page");
  await expect(page.locator("header.topbar")).toHaveCount(0);
});

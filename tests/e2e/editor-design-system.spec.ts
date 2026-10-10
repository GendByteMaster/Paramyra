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

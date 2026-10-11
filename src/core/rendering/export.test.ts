import {describe,expect,it} from "vitest";
import {documentFromScene} from "../document/schema";
import {presets} from "../scenes/presets";
import {upsertKeyframe} from "../animation/keyframes";
import {defaultView} from "./canvas2d";
import {createSceneSvg,validateExportSize} from "./export";
describe("bounded frame export",()=>{
  const doc=documentFromScene(presets[0]);
  it("generates standalone SVG with escaped user content and no executable nodes",()=>{
    const edited={...doc,title:'Demo <script>alert("x")</script>'};
    const svg=createSceneSvg(edited,0,defaultView,{width:1280,height:720});
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("<path ");
    expect(svg).toContain('fill="#090e17"');
  });
  it("supports transparent export and deterministic animated opacity",()=>{
    const layer=upsertKeyframe(upsertKeyframe(doc.layers[0],
      {property:"opacity",time:0,value:0,ease:"linear"}),
      {property:"opacity",time:12,value:1,ease:"linear"});
    const edited={...doc,layers:[layer]};
    const svg=createSceneSvg(edited,6,defaultView,{width:1280,height:720},"transparent");
    expect(svg).toContain('stroke-opacity="0.5"');
    expect(svg).not.toContain('fill="#090e17"');
    expect(svg).toBe(createSceneSvg(edited,6,defaultView,{width:1280,height:720},"transparent"));
  });
  it("rejects unbounded size and invalid time",()=>{
    for(const size of [{width:0,height:900},{width:2401,height:900},{width:300,height:900},{width:1920.5,height:1080},{width:3000,height:3000}]){
      expect(validateExportSize(size)).toBe(false);
      expect(()=>createSceneSvg(doc,0,defaultView,size)).toThrow();
    }
    expect(()=>createSceneSvg(doc,13,defaultView,{width:1280,height:720})).toThrow();
    expect(()=>createSceneSvg(doc,NaN,defaultView,{width:1280,height:720})).toThrow();
  });
});

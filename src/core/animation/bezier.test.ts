import {describe,expect,it} from "vitest";
import {documentFromScene,newFormulaLayer,parseDocument,type MathLayer} from "../document/schema";
import {presets} from "../scenes/presets";
import {commitDocument,initializeHistory,undoDocument,redoDocument} from "../document/history";
import {cubicBezierFraction,DEFAULT_BEZIER,deleteKeyframes,moveKeyframes,sampleProperty,upsertKeyframe,
  type LayerKeyframe} from "./keyframes";

const key=(property:LayerKeyframe["property"],time:number,value:number,
  ease:LayerKeyframe["ease"]="linear",bezier?:LayerKeyframe["bezier"]):LayerKeyframe=>
  bezier?{property,time,value,ease,bezier}:{property,time,value,ease};

describe("v1.0 M2.2 deterministic Bezier and atomic multi-keyframe operations",()=>{
  it("inverts Bezier x and preserves exact endpoints and deterministic sampling",()=>{
    expect(cubicBezierFraction(0,DEFAULT_BEZIER)).toBe(0);
    expect(cubicBezierFraction(1,DEFAULT_BEZIER)).toBe(1);
    expect(cubicBezierFraction(.5,DEFAULT_BEZIER)).toBeCloseTo(.5,5);
    const fast={x1:0,y1:1,x2:1,y2:1};
    expect(cubicBezierFraction(.25,fast)).toBeGreaterThan(.25);
    let layer:MathLayer=newFormulaLayer("formula");
    layer=upsertKeyframe(layer,key("formula.a",0,-10,"bezier",fast));
    layer=upsertKeyframe(layer,key("formula.a",10,10));
    expect(sampleProperty(layer,"formula.a",0)).toBe(-10);
    expect(sampleProperty(layer,"formula.a",10)).toBe(10);
    expect(sampleProperty(layer,"formula.a",2.5)).toBeGreaterThan(-5);
    expect(sampleProperty(layer,"formula.a",5)).toBeLessThanOrEqual(10);
    expect(sampleProperty(layer,"formula.a",5)).toBe(sampleProperty(layer,"formula.a",5));
  });

  it("keeps legacy documents valid and rejects malformed/unsafe Bezier data",()=>{
    const doc={...documentFromScene(presets[0]),layers:[newFormulaLayer("formula")]};
    const frame=key("opacity",0,.2,"bezier",DEFAULT_BEZIER);
    const frames=[frame,key("opacity",12,.8)];
    const valid={...doc,layers:[{...doc.layers[0],keyframes:frames}]};
    expect(parseDocument(valid)).toEqual(valid);
    expect(upsertKeyframe(valid.layers[0],{...frame,bezier:{...DEFAULT_BEZIER}})).toBe(valid.layers[0]); // no empty Undo entry
    expect(parseDocument({...doc,layers:[{...doc.layers[0],keyframes:[key("opacity",0,.2)]}]})).not.toBeNull();
    const reject=(value:unknown)=>parseDocument({...doc,layers:[{...doc.layers[0],keyframes:[value]}]});
    expect(reject({...frame,bezier:{...DEFAULT_BEZIER,x1:-.01}})).toBeNull();
    expect(reject({...frame,bezier:{...DEFAULT_BEZIER,x2:1.01}})).toBeNull();
    expect(reject({...frame,bezier:{...DEFAULT_BEZIER,y1:Infinity}})).toBeNull();
    expect(reject({...frame,bezier:{...DEFAULT_BEZIER,constructor:"evil"}})).toBeNull();
    expect(reject({...frame,bezier:{x1:0,y1:0,x2:1}})).toBeNull();
    expect(reject({...frame,bezier:undefined})).toBeNull();
    expect(reject({...key("opacity",0,.2),bezier:DEFAULT_BEZIER})).toBeNull();
    expect(upsertKeyframe(doc.layers[0],{...frame,bezier:{...DEFAULT_BEZIER,x1:NaN}})).toBe(doc.layers[0]);
  });

  it("moves multi-property selections atomically without overwriting or partial writes",()=>{
    let layer:MathLayer=newFormulaLayer("formula");
    layer=upsertKeyframe(layer,key("opacity",1,.2));
    layer=upsertKeyframe(layer,key("opacity",3,.8));
    layer=upsertKeyframe(layer,key("formula.a",1,-1,"bezier",DEFAULT_BEZIER));
    const selected=[{property:"opacity" as const,time:1},{property:"formula.a" as const,time:1}];
    const moved=moveKeyframes(layer,selected,.5,12);
    expect(moved.keyframes?.filter(f=>f.time===1.5)).toHaveLength(2);
    expect(moved.keyframes?.find(f=>f.property==="formula.a")?.bezier).toEqual(DEFAULT_BEZIER);
    expect(layer.keyframes?.filter(f=>f.time===1)).toHaveLength(2);
    expect(moveKeyframes(layer,selected,2,12)).toBe(layer); // collides with unselected opacity at t=3
    expect(moveKeyframes(layer,selected,-1.1,12)).toBe(layer);
    expect(moveKeyframes(layer,selected,12,12)).toBe(layer);
    expect(moveKeyframes(layer,[selected[0],selected[0]],.5,12)).toBe(layer);
    expect(moveKeyframes(layer,[{property:"opacity",time:2}],.5,12)).toBe(layer);
    expect(deleteKeyframes(layer,selected).keyframes).toHaveLength(1);
    const document={...documentFromScene(presets[0]),layers:[layer]};
    const movedDocument={...document,layers:[moved]};
    const history=commitDocument(initializeHistory(document),movedDocument);
    expect(undoDocument(history).present).toEqual(document);
    expect(redoDocument(undoDocument(history)).present).toEqual(movedDocument);
    expect(parseDocument(movedDocument)).toEqual(movedDocument);
  });
});

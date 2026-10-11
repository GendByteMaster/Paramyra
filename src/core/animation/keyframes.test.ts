import {describe,it,expect} from "vitest";
import {documentFromScene,parseDocument,newFormulaLayer,type MathLayer} from "../document/schema";
import {presets} from "../scenes/presets";
import {commitDocument,initializeHistory,undoDocument,redoDocument} from "../document/history";
import {duplicateLayer,updateLayer} from "../document/operations";
import {sampleProperty,upsertKeyframe,moveKeyframe,deleteKeyframe,resolveAnimatedDocument,KEYFRAME_LIMIT,type LayerKeyframe} from "./keyframes";

const f=(property:LayerKeyframe["property"],time:number,value:number,ease:LayerKeyframe["ease"]="linear"):LayerKeyframe=>
  ({property,time,value,ease});

describe("deterministic Animation Studio keyframes",()=>{
  it("interpolates linear, holds, eases and clamps endpoints",()=>{
    let layer:MathLayer=newFormulaLayer("a");
    layer=upsertKeyframe(layer,f("offset.x",2,-1));
    layer=upsertKeyframe(layer,f("offset.x",6,1));
    expect(sampleProperty(layer,"offset.x",-2)).toBe(-1);
    expect(sampleProperty(layer,"offset.x",2)).toBe(-1);
    expect(sampleProperty(layer,"offset.x",4)).toBe(0);
    expect(sampleProperty(layer,"offset.x",99)).toBe(1);
    layer=upsertKeyframe(layer,f("offset.x",2,-1,"hold"));
    expect(sampleProperty(layer,"offset.x",4)).toBe(-1);
    layer=upsertKeyframe(layer,f("offset.x",2,-1,"ease-in"));
    expect(sampleProperty(layer,"offset.x",3)).toBeCloseTo(-0.875);
    layer=upsertKeyframe(layer,f("offset.x",2,-1,"ease-out"));
    expect(sampleProperty(layer,"offset.x",3)).toBeCloseTo(-0.125);
    layer=upsertKeyframe(layer,f("offset.x",2,-1,"ease-in-out"));
    expect(sampleProperty(layer,"offset.x",3)).toBeCloseTo(-0.6875);
    expect(sampleProperty(layer,"opacity",3)).toBe(1);
    expect(sampleProperty(layer,"offset.x",NaN)).toBe(0);
  });
  it("validates a strict, bounded, undoable document animation",()=>{
    const original=documentFromScene(presets[0]);
    const edited=updateLayer(original,original.layers[0].id,l=>upsertKeyframe(
      upsertKeyframe(l,f("offset.y",0,-1)),f("offset.y",12,1)));
    expect(parseDocument(edited)).toEqual(edited);
    expect(original.layers[0].keyframes).toBeUndefined();
    expect(resolveAnimatedDocument(edited,6).layers[0].offset.y).toBe(0);
    expect(resolveAnimatedDocument(edited,3).layers[0].offset.y).toBe(-0.5);
    expect(edited.layers[0].offset.y).toBe(0);
    const history=commitDocument(initializeHistory(original),edited);
    expect(undoDocument(history).present).toEqual(original);
    expect(redoDocument(undoDocument(history)).present).toEqual(edited);
    const duplicate=duplicateLayer(edited,edited.layers[0].id,"second");
    expect(duplicate.layers[1].keyframes).toEqual(edited.layers[0].keyframes);
    expect(duplicate.layers[1].keyframes).not.toBe(edited.layers[0].keyframes);
    const deleted=updateLayer(edited,edited.layers[0].id,l=>deleteKeyframe(l,"offset.y",12));
    expect(deleted.layers[0].keyframes).toHaveLength(1);
  });
  it("rejects wrong types, values, duplicate times, out-of-duration and oversized keyframes",()=>{
    const base=documentFromScene(presets[0]);
    const orig=base.layers[0];
    const doc=(items:unknown[])=>({...base,layers:[{...orig,keyframes:items}]});
    expect(parseDocument(doc([f("opacity",2,0.5)]))).not.toBeNull();
    expect(parseDocument(doc([f("opacity",12.1,0.5)]))).toBeNull();
    expect(parseDocument(doc([f("opacity",2,0.5),f("opacity",2,0.7)]))).toBeNull();
    expect(parseDocument(doc([f("opacity",1,2)]))).toBeNull();
    expect(parseDocument(doc([{...f("opacity",1,0.5),property:"constructor"}]))).toBeNull();
    expect(parseDocument(doc([{...f("opacity",1,0.5),prototype:"script"}]))).toBeNull();
    expect(parseDocument(doc([{...f("offset.x",1,0.2),value:Infinity}]))).toBeNull();
    expect(parseDocument(doc(Array.from({length:KEYFRAME_LIMIT+1},(_,i)=>f("opacity",i/10,i/100))))).toBeNull();
    const l=upsertKeyframe(orig,f("offset.x",1,1e9));
    expect(l).toBe(orig);
  });
  it("animates formula parameters and stroke width through the shared renderer projection",()=>{
    let layer:MathLayer=newFormulaLayer("formula");
    layer=upsertKeyframe(layer,f("formula.a",0,-2));
    layer=upsertKeyframe(layer,f("formula.a",8,2));
    layer=upsertKeyframe(layer,f("formula.b",0,1));
    layer=upsertKeyframe(layer,f("formula.b",8,3));
    layer=upsertKeyframe(layer,f("params.strokeWidth",0,1));
    layer=upsertKeyframe(layer,f("params.strokeWidth",8,4));
    const doc={...documentFromScene(presets[0]),layers:[layer]};
    expect(parseDocument(doc)).toEqual(doc);
    const resolved=resolveAnimatedDocument(doc,4).layers[0];
    expect(resolved.kind).toBe("formula");
    if(resolved.kind==="formula"){
      expect(resolved.formula.a).toBe(0);
      expect(resolved.formula.b).toBe(2);
      expect(resolved.formula.c).toBe(layer.kind==="formula"?layer.formula.c:0);
    }
    expect(resolved.params.strokeWidth).toBe(2.5);
    expect(doc.layers[0].params.strokeWidth).toBe(1.8);
    const legacy=documentFromScene(presets[0]);
    expect(upsertKeyframe(legacy.layers[0],f("formula.a",0,1))).toBe(legacy.layers[0]);
    expect(parseDocument({...legacy,layers:[{...legacy.layers[0],keyframes:[f("formula.a",0,1)]}]})).toBeNull();
    expect(parseDocument({...doc,layers:[{...layer,keyframes:[f("params.strokeWidth",1,0)]}]})).toBeNull();
  });
  it("moves keyframes without clobbering collisions and respects duration",()=>{
    let layer:MathLayer=newFormulaLayer("formula");
    layer=upsertKeyframe(layer,f("formula.c",1,1));
    layer=upsertKeyframe(layer,f("formula.c",3,3));
    const moved=moveKeyframe(layer,"formula.c",1,2,12);
    expect(moved.keyframes?.map(frame=>frame.time)).toEqual([2,3]);
    expect(sampleProperty(moved,"formula.c",2.5)).toBe(2);
    expect(layer.keyframes?.[0].time).toBe(1);
    expect(moveKeyframe(moved,"formula.c",2,3,12)).toBe(moved);
    expect(moveKeyframe(moved,"formula.c",2,13,12)).toBe(moved);
    expect(moveKeyframe(moved,"formula.c",2,NaN,12)).toBe(moved);
    expect(moveKeyframe(moved,"formula.c",0,4,12)).toBe(moved);
    expect(parseDocument({...documentFromScene(presets[0]),layers:[moved]})).not.toBeNull();
  });
});

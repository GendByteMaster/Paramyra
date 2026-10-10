import type { MathDocument, MathLayer } from "../document/schema";

/** Explicit, type-safe numeric properties. Never resolve user-defined object paths. */
export type AnimatableProperty =
  "offset.x" | "offset.y" | "opacity" | "params.strokeWidth" |
  "formula.a" | "formula.b" | "formula.c";
export type KeyframeEase = "linear" | "ease-in" | "ease-out" | "ease-in-out" | "hold";
export type LayerKeyframe = Readonly<{property:AnimatableProperty;time:number;value:number;ease:KeyframeEase}>;
export const ANIMATABLE_PROPERTIES:readonly AnimatableProperty[] =
  ["offset.x","offset.y","opacity","params.strokeWidth","formula.a","formula.b","formula.c"];
export const KEYFRAME_LIMIT = 72;

export function supportsProperty(layer:MathLayer,property:AnimatableProperty):boolean{
  return !property.startsWith("formula.") || layer.kind==="formula";
}
export function propertyBounds(property:AnimatableProperty):{min:number;max:number;step:number}{
  if(property==="opacity")return {min:0,max:1,step:0.05};
  if(property==="params.strokeWidth")return {min:0.5,max:4,step:0.1};
  if(property==="formula.a"||property==="formula.b"||property==="formula.c")
    return {min:-10,max:10,step:0.1};
  return {min:-2,max:2,step:0.05};
}
export function getLayerProperty(layer:MathLayer,property:AnimatableProperty):number{
  switch(property){
    case "opacity":return layer.opacity;
    case "offset.x":return layer.offset.x;
    case "offset.y":return layer.offset.y;
    case "params.strokeWidth":return layer.params.strokeWidth;
    case "formula.a":return layer.kind==="formula"?layer.formula.a:0;
    case "formula.b":return layer.kind==="formula"?layer.formula.b:0;
    case "formula.c":return layer.kind==="formula"?layer.formula.c:0;
  }
}
function easeFraction(value:number,ease:KeyframeEase):number{
  const t=Math.max(0,Math.min(1,value));
  if(ease==="hold")return 0;
  if(ease==="ease-in")return t*t;
  if(ease==="ease-out")return 1-(1-t)*(1-t);
  if(ease==="ease-in-out")return t*t*(3-2*t);
  return t;
}
/** Pure deterministic interpolation. Easing belongs to the starting keyframe. */
export function sampleProperty(layer:MathLayer,property:AnimatableProperty,time:number):number{
  const base=getLayerProperty(layer,property);
  if(!supportsProperty(layer,property)||!Number.isFinite(time))return base;
  const frames=(layer.keyframes??[]).filter(frame=>frame.property===property)
    .sort((a,b)=>a.time-b.time);
  if(!frames.length)return base;
  if(time<=frames[0].time)return frames[0].value;
  const end=frames[frames.length-1];
  if(time>=end.time)return end.value;
  for(let index=1;index<frames.length;index++){
    const right=frames[index],left=frames[index-1];
    if(time>right.time)continue;
    const t=easeFraction((time-left.time)/(right.time-left.time),left.ease);
    return left.value+(right.value-left.value)*t;
  }
  return end.value;
}
export function resolveAnimatedLayer(layer:MathLayer,time:number):MathLayer{
  if(!layer.keyframes?.length)return layer;
  const resolved={...layer,
    opacity:sampleProperty(layer,"opacity",time),
    offset:{x:sampleProperty(layer,"offset.x",time),y:sampleProperty(layer,"offset.y",time)},
    params:{...layer.params,strokeWidth:sampleProperty(layer,"params.strokeWidth",time)},
  };
  if(layer.kind==="formula")return {...resolved,
    formula:{...layer.formula,
      a:sampleProperty(layer,"formula.a",time),
      b:sampleProperty(layer,"formula.b",time),
      c:sampleProperty(layer,"formula.c",time),
    },
  };
  return resolved;
}
export function resolveAnimatedDocument(doc:MathDocument,time:number):MathDocument{
  if(!doc.layers.some(layer=>layer.keyframes?.length))return doc;
  return {...doc,layers:doc.layers.map(layer=>resolveAnimatedLayer(layer,time))};
}
export function upsertKeyframe(layer:MathLayer,frame:LayerKeyframe):MathLayer{
  if(!supportsProperty(layer,frame.property))return layer;
  const bounds=propertyBounds(frame.property);
  if(!Number.isFinite(frame.time)||frame.time<0||frame.time>60||!Number.isFinite(frame.value)
    ||frame.value<bounds.min||frame.value>bounds.max)return layer;
  const frames=layer.keyframes??[];
  const time=Math.round(frame.time*100)/100;
  const index=frames.findIndex(item=>item.property===frame.property&&Math.abs(item.time-time)<0.005);
  if(index<0&&frames.length>=KEYFRAME_LIMIT)return layer;
  const updated={...frame,time};
  const next=index<0?[...frames,updated]:frames.map((item,i)=>i===index?updated:item);
  return {...layer,keyframes:next.sort((a,b)=>a.time-b.time||a.property.localeCompare(b.property))};
}
/** Move, rather than overwrite, a keyframe. Collisions and out-of-range times are rejected. */
export function moveKeyframe(layer:MathLayer,property:AnimatableProperty,from:number,to:number,duration:number):MathLayer{
  if(!supportsProperty(layer,property)||!Number.isFinite(to)||!Number.isFinite(duration)
    ||duration<0||to<0||to>duration||to>60)return layer;
  const frames=layer.keyframes??[];
  const index=frames.findIndex(frame=>frame.property===property&&Math.abs(frame.time-from)<0.005);
  if(index<0)return layer;
  const time=Math.round(to*100)/100;
  if(time===frames[index].time)return layer;
  if(frames.some((frame,i)=>i!==index&&frame.property===property&&Math.abs(frame.time-time)<0.005))return layer;
  const next=frames.map((frame,i)=>i===index?{...frame,time}:frame);
  return {...layer,keyframes:next.sort((a,b)=>a.time-b.time||a.property.localeCompare(b.property))};
}
export function deleteKeyframe(layer:MathLayer,property:AnimatableProperty,time:number):MathLayer{
  const frames=layer.keyframes??[];
  const next=frames.filter(frame=>!(frame.property===property&&Math.abs(frame.time-time)<0.005));
  return next.length===frames.length?layer:{...layer,keyframes:next};
}

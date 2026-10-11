import type { MathDocument, MathLayer } from "../document/schema";

/** Explicit, type-safe numeric properties. Never resolve user-defined object paths. */
export type AnimatableProperty =
  "offset.x" | "offset.y" | "opacity" | "params.strokeWidth" |
  "formula.a" | "formula.b" | "formula.c";
export type KeyframeEase = "linear" | "ease-in" | "ease-out" | "ease-in-out" | "hold" | "bezier";
export type BezierHandles = Readonly<{x1:number;y1:number;x2:number;y2:number}>;
export type KeyframeRef = Readonly<{property:AnimatableProperty;time:number}>;
export type LayerKeyframe = Readonly<{property:AnimatableProperty;time:number;value:number;ease:KeyframeEase;bezier?:BezierHandles}>;
export const DEFAULT_BEZIER:BezierHandles={x1:0.42,y1:0,x2:0.58,y2:1};
const ALL_EASES:readonly KeyframeEase[]=["linear","ease-in","ease-out","ease-in-out","hold","bezier"];
export function validBezier(v:BezierHandles):boolean{
  return [v.x1,v.y1,v.x2,v.y2].every(n=>Number.isFinite(n)&&n>=0&&n<=1);
}
const curve=(u:number,a:number,b:number)=>3*(1-u)*(1-u)*u*a+3*(1-u)*u*u*b+u*u*u;
/** Inverse x(t) by bounded bisection: handles constrained to [0,1] make x monotone. */
export function cubicBezierFraction(progress:number,handles:BezierHandles):number{
  if(!Number.isFinite(progress)||!validBezier(handles))return 0;
  const target=Math.max(0,Math.min(1,progress));
  if(target===0||target===1)return target;
  let lo=0,hi=1;
  for(let i=0;i<28;i++){
    const mid=(lo+hi)/2;
    if(curve(mid,handles.x1,handles.x2)<target)lo=mid;
    else hi=mid;
  }
  return curve((lo+hi)/2,handles.y1,handles.y2);
}
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
function easeFraction(value:number,frame:LayerKeyframe):number{
  const t=Math.max(0,Math.min(1,value));
  if(frame.ease==="bezier")return cubicBezierFraction(t,frame.bezier??DEFAULT_BEZIER);
  if(frame.ease==="hold")return 0;
  if(frame.ease==="ease-in")return t*t;
  if(frame.ease==="ease-out")return 1-(1-t)*(1-t);
  if(frame.ease==="ease-in-out")return t*t*(3-2*t);
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
    const t=easeFraction((time-left.time)/(right.time-left.time),left);
    return left.value+(right.value-left.value)*t;
  }
  return end.value;
}
export function resolveAnimatedLayer(layer:MathLayer,time:number):MathLayer{
  if(!layer.keyframes?.length)return layer;
  const opacity=sampleProperty(layer,"opacity",time);
  const offset={x:sampleProperty(layer,"offset.x",time),y:sampleProperty(layer,"offset.y",time)};
  const params={...layer.params,strokeWidth:sampleProperty(layer,"params.strokeWidth",time)};
  if(layer.kind==="formula")return {...layer,opacity,offset,params,
    formula:{...layer.formula,
      a:sampleProperty(layer,"formula.a",time),
      b:sampleProperty(layer,"formula.b",time),
      c:sampleProperty(layer,"formula.c",time),
    },
  };
  return {...layer,opacity,offset,params};
}
export function resolveAnimatedDocument(doc:MathDocument,time:number):MathDocument{
  if(!doc.layers.some(layer=>layer.keyframes?.length))return doc;
  return {...doc,layers:doc.layers.map(layer=>resolveAnimatedLayer(layer,time))};
}
export function upsertKeyframe(layer:MathLayer,frame:LayerKeyframe):MathLayer{
  if(!supportsProperty(layer,frame.property)||!ALL_EASES.includes(frame.ease)
    ||(frame.ease==="bezier"?!frame.bezier||!validBezier(frame.bezier):frame.bezier!==undefined))return layer;
  const bounds=propertyBounds(frame.property);
  if(!Number.isFinite(frame.time)||frame.time<0||frame.time>60||!Number.isFinite(frame.value)
    ||frame.value<bounds.min||frame.value>bounds.max)return layer;
  const frames=layer.keyframes??[];
  const time=Math.round(frame.time*100)/100;
  const index=frames.findIndex(item=>item.property===frame.property&&Math.abs(item.time-time)<0.005);
  if(index<0&&frames.length>=KEYFRAME_LIMIT)return layer;
  const updated={...frame,time};
  if(index>=0){
    const old=frames[index];
    if(old.value===updated.value&&old.ease===updated.ease&&
      (old.bezier===updated.bezier||(
        old.bezier!==undefined&&updated.bezier!==undefined&&
        old.bezier.x1===updated.bezier.x1&&old.bezier.y1===updated.bezier.y1&&
        old.bezier.x2===updated.bezier.x2&&old.bezier.y2===updated.bezier.y2
      )))return layer;
  }
  const next=index<0?[...frames,updated]:frames.map((item,i)=>i===index?updated:item);
  return {...layer,keyframes:next.sort((a,b)=>a.time-b.time||a.property.localeCompare(b.property))};
}
/** Atomic group translation: rejects collisions, partial edits, missing refs and time overflow. */
export function moveKeyframes(layer:MathLayer,selected:readonly KeyframeRef[],delta:number,duration:number):MathLayer{
  if(!selected.length||selected.length>KEYFRAME_LIMIT||!Number.isFinite(delta)
    ||!Number.isFinite(duration)||duration<0||duration>60)return layer;
  const frames=layer.keyframes??[];
  const refs=new Set(selected.map(f=>f.property+":"+f.time.toFixed(2)));
  if(refs.size!==selected.length||refs.size>frames.length)return layer;
  const found=new Set<string>();
  const next=frames.map(frame=>{
    const key=frame.property+":"+frame.time.toFixed(2);
    if(!refs.has(key))return frame;
    found.add(key);
    const time=Math.round((frame.time+delta)*100)/100;
    return {...frame,time};
  });
  if(found.size!==refs.size || next.some(frame=>frame.time<0||frame.time>duration||frame.time>60))return layer;
  const nextKeys=new Set(next.map(f=>f.property+":"+f.time.toFixed(2)));
  if(nextKeys.size!==next.length)return layer;
  if(next.every((frame,index)=>frame.time===frames[index].time))return layer;
  return {...layer,keyframes:next.sort((a,b)=>a.time-b.time||a.property.localeCompare(b.property))};
}
export function moveKeyframe(layer:MathLayer,property:AnimatableProperty,from:number,to:number,duration:number):MathLayer{
  if(!Number.isFinite(from)||!Number.isFinite(to)||!supportsProperty(layer,property))return layer;
  return moveKeyframes(layer,[{property,time:from}],to-from,duration);
}
export function deleteKeyframes(layer:MathLayer,selected:readonly KeyframeRef[]):MathLayer{
  if(!selected.length)return layer;
  const refs=new Set(selected.map(f=>f.property+":"+f.time.toFixed(2)));
  const frames=layer.keyframes??[];
  const next=frames.filter(frame=>!refs.has(frame.property+":"+frame.time.toFixed(2)));
  return next.length===frames.length?layer:{...layer,keyframes:next};
}
export function deleteKeyframe(layer:MathLayer,property:AnimatableProperty,time:number):MathLayer{
  const frames=layer.keyframes??[];
  const next=frames.filter(frame=>!(frame.property===property&&Math.abs(frame.time-time)<0.005));
  return next.length===frames.length?layer:{...layer,keyframes:next};
}

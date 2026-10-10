import type { MathDocument, MathLayer } from "../document/schema";

/** A fixed, versioned set of numeric paths: no property-path evaluation. */
export type AnimatableProperty="offset.x"|"offset.y"|"opacity";
export type KeyframeEase="linear"|"ease-in"|"ease-out"|"ease-in-out"|"hold";
export type LayerKeyframe=Readonly<{property:AnimatableProperty;time:number;value:number;ease:KeyframeEase}>;
export const ANIMATABLE_PROPERTIES:readonly AnimatableProperty[]=["offset.x","offset.y","opacity"];
export const KEYFRAME_LIMIT=72;

export function propertyBounds(property:AnimatableProperty):{min:number;max:number;step:number}{
  return property==="opacity"?{min:0,max:1,step:0.05}:{min:-2,max:2,step:0.05};
}
export function getLayerProperty(layer:MathLayer,property:AnimatableProperty):number{
  if(property==="opacity")return layer.opacity;
  return property==="offset.x"?layer.offset.x:layer.offset.y;
}
function easeFraction(value:number,ease:KeyframeEase):number{
  const t=Math.max(0,Math.min(1,value));
  if(ease==="hold")return 0;
  if(ease==="ease-in")return t*t;
  if(ease==="ease-out")return 1-(1-t)*(1-t);
  if(ease==="ease-in-out")return t*t*(3-2*t);
  return t;
}
/** Pure deterministic interpolation. Easings belong to the starting keyframe. */
export function sampleProperty(layer:MathLayer,property:AnimatableProperty,time:number):number{
  const base=getLayerProperty(layer,property);
  if(!Number.isFinite(time))return base;
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
  return {...layer,
    opacity:sampleProperty(layer,"opacity",time),
    offset:{x:sampleProperty(layer,"offset.x",time),y:sampleProperty(layer,"offset.y",time)},
  };
}
export function resolveAnimatedDocument(doc:MathDocument,time:number):MathDocument{
  if(!doc.layers.some(layer=>layer.keyframes?.length))return doc;
  return {...doc,layers:doc.layers.map(layer=>resolveAnimatedLayer(layer,time))};
}
export function upsertKeyframe(layer:MathLayer,frame:LayerKeyframe):MathLayer{
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
export function deleteKeyframe(layer:MathLayer,property:AnimatableProperty,time:number):MathLayer{
  const frames=layer.keyframes??[];
  const next=frames.filter(frame=>!(frame.property===property&&Math.abs(frame.time-time)<0.005));
  return next.length===frames.length?layer:{...layer,keyframes:next};
}

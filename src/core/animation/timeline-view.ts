import type {AnimatableProperty,LayerKeyframe} from "./keyframes";

export type TimelineWindow=Readonly<{start:number;end:number}>;
export type TimelineSnap=0|0.1|0.25|0.5|1;
export const TIMELINE_SNAP_OPTIONS:readonly TimelineSnap[]=[0,0.1,0.25,0.5,1];

const clamp=(n:number,minimum:number,maximum:number)=>Math.max(minimum,Math.min(maximum,n));
const hundredth=(n:number)=>Math.round(n*100)/100;

/** The viewport is UI state, never persisted in a MathDocument. */
export function timelineWindow(duration:number,zoom:number,anchor:number,previous?:TimelineWindow):TimelineWindow{
  if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(zoom)||zoom<1||zoom>8)return {start:0,end:Math.max(0,duration)};
  const span=duration/zoom;
  const old=previous??{start:0,end:duration};
  const oldSpan=Math.max(Number.EPSILON,old.end-old.start);
  const ratio=clamp((anchor-old.start)/oldSpan,0,1);
  const start=clamp(anchor-ratio*span,0,duration-span);
  return {start,end:start+span};
}
export function panTimeline(duration:number,window:TimelineWindow,fraction:number):TimelineWindow{
  const span=window.end-window.start;
  if(!Number.isFinite(fraction)||!Number.isFinite(span)||span<=0)return window;
  const start=clamp(window.start+span*fraction,0,Math.max(0,duration-span));
  return {start,end:start+span};
}
export function timelineFraction(time:number,window:TimelineWindow):number{
  const span=window.end-window.start;
  return span>0?(time-window.start)/span:0;
}
export function timeAtPointer(clientX:number,left:number,width:number,window:TimelineWindow):number{
  if(!Number.isFinite(width)||width<=0)return window.start;
  return hundredth(window.start+clamp((clientX-left)/width,0,1)*(window.end-window.start));
}
/** Neighbour markers within a small visual tolerance beat the optional grid. */
export function snapTimelineTime(time:number,duration:number,grid:TimelineSnap,neighbours:readonly number[],
  window:TimelineWindow,width:number,px=9):number{
  if(!Number.isFinite(time)||!Number.isFinite(duration)||duration<=0)return 0;
  const bounded=clamp(time,0,duration);
  if(grid===0)return hundredth(bounded);
  const threshold=(window.end-window.start)*px/Math.max(1,width);
  const close=neighbours.filter(t=>Number.isFinite(t)&&t>=0&&t<=duration&&Math.abs(t-bounded)<=threshold)
    .sort((a,b)=>Math.abs(a-bounded)-Math.abs(b-bounded));
  if(close.length)return hundredth(close[0]);
  return hundredth(clamp(Math.round(bounded/grid)*grid,0,duration));
}
export type BoxRow=Readonly<{property:AnimatableProperty;top:number;bottom:number}>;
/** Domain-space hit testing: independent of DOM nodes and rectangle drag direction. */
export function keyframesInBox(frames:readonly LayerKeyframe[],from:number,to:number,
  top:number,bottom:number,rows:readonly BoxRow[]):readonly {property:AnimatableProperty;time:number}[]{
  const minTime=Math.min(from,to),maxTime=Math.max(from,to);
  const minY=Math.min(top,bottom),maxY=Math.max(top,bottom);
  const properties=new Set(rows.filter(r=>r.top<=maxY&&r.bottom>=minY).map(r=>r.property));
  return frames.filter(f=>properties.has(f.property)&&f.time>=minTime&&f.time<=maxTime)
    .map(f=>({property:f.property,time:f.time}));
}

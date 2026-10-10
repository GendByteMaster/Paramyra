"use client";
import {useState} from "react";
import {KeyRound,Plus,Trash2} from "lucide-react";
import {ANIMATABLE_PROPERTIES,deleteKeyframe,propertyBounds,sampleProperty,upsertKeyframe,
  type AnimatableProperty,type KeyframeEase,type LayerKeyframe} from "@/core/animation/keyframes";
import type {MathLayer} from "@/core/document/schema";

type Props={layer:MathLayer;time:number;duration:number;onSeek:(time:number)=>void;
  onEdit:(fn:(layer:MathLayer)=>MathLayer)=>void};
const names:Record<AnimatableProperty,string>={
  "opacity":"Opacity","offset.x":"Position X","offset.y":"Position Y",
};
const EASES:KeyframeEase[]=["linear","ease-in","ease-out","ease-in-out","hold"];
export function AnimationTimeline({layer,time,duration,onSeek,onEdit}:Props){
  const [property,setProperty]=useState<AnimatableProperty>("opacity");
  const frames=(layer.keyframes??[]).filter(frame=>frame.property===property).sort((a,b)=>a.time-b.time);
  const selected=frames.find(frame=>Math.abs(frame.time-time)<0.051);
  const bounds=propertyBounds(property);
  const currentValue=sampleProperty(layer,property,time);
  const playhead=Math.max(0,Math.min(100,time/duration*100));
  const add=()=>{
    const frame:LayerKeyframe={property,time:Math.round(time*100)/100,
      value:Number(currentValue.toFixed(4)),ease:"ease-in-out"};
    onEdit(layer=>upsertKeyframe(layer,frame));
  };
  const setValue=(raw:number)=>{
    if(!Number.isFinite(raw)||raw<bounds.min||raw>bounds.max)return;
    const frame:LayerKeyframe=selected
      ?{...selected,value:raw}:{property,time:Math.round(time*100)/100,value:raw,ease:"ease-in-out"};
    onEdit(layer=>upsertKeyframe(layer,frame));
  };
  const points=Array.from({length:81},(_,index)=>{
    const at=duration*index/80;
    const value=sampleProperty(layer,property,at);
    return (index/80*640).toFixed(1)+","+(8+(1-(value-bounds.min)/(bounds.max-bounds.min))*110).toFixed(1);
  }).join(" ");
  return <div className="pm-animation-editor" aria-label="Keyframe Animation Editor">
    <div className="pm-animation-heading"><span><KeyRound size={14}/> KEYFRAME ANIMATION</span>
      <small>{layer.title} · {frames.length} markers</small>
    </div>
    <div className="pm-animation-control-row">
      <label>Property<select aria-label="Animated property" value={property} onChange={e=>setProperty(e.target.value as AnimatableProperty)}>
        {ANIMATABLE_PROPERTIES.map(p=><option key={p} value={p}>{names[p]}</option>)}
      </select></label>
      <label>Value<input type="number" aria-label="Animated value" min={bounds.min} max={bounds.max}
        step={bounds.step} value={Number(currentValue.toFixed(4))}
        onChange={e=>setValue(e.target.valueAsNumber)}/></label>
      <label>Easing<select aria-label="Keyframe easing" value={selected?.ease??"ease-in-out"}
        disabled={!selected} onChange={e=>{
          if(!selected)return;
          const ease=e.target.value as KeyframeEase;
          onEdit(layer=>upsertKeyframe(layer,{...selected,ease}));
        }}>{EASES.map(ease=><option key={ease} value={ease}>{ease}</option>)}</select></label>
    </div>
    <div className="pm-animation-controls">
      <button type="button" onClick={add} disabled={!Number.isFinite(currentValue)||!Number.isFinite(time)}
        aria-label="Add keyframe at playhead"><Plus size={14}/> {selected?"Update keyframe":"Add keyframe"}</button>
      <button type="button" aria-label="Delete keyframe at playhead" disabled={!selected}
        onClick={()=>onEdit(layer=>deleteKeyframe(layer,property,selected!.time))}><Trash2 size={14}/> Remove</button>
      <small>{time.toFixed(2)}s / {duration.toFixed(2)}s</small>
    </div>
    <div className="pm-animation-track" aria-label="Keyframe track">
      <div className="pm-animation-track-fill" style={{width:playhead+"%"}}/>
      <div className="pm-animation-playhead" style={{left:playhead+"%"}}/>
      {frames.map((frame,index)=><button key={frame.time+":"+index} type="button"
        style={{left:(frame.time/duration*100)+"%"}} className={"pm-keyframe-marker"+(selected?.time===frame.time?" selected":"")}
        aria-label={"Seek to keyframe at "+frame.time.toFixed(2)+" seconds"}
        title={frame.time+"s · "+frame.value+" · "+frame.ease} onClick={()=>onSeek(frame.time)}/>)}
    </div>
    <div className="pm-animation-ruler"><span>0s</span><span>{(duration/2).toFixed(1)}s</span><span>{duration.toFixed(1)}s</span></div>
    <div className="pm-animation-graph-label"><span>GRAPH EDITOR</span><small>Value over time · {names[property]}</small></div>
    <svg className="pm-animation-graph" role="img" aria-label={"Interpolation graph for "+names[property]}
      viewBox="0 0 640 128" preserveAspectRatio="none">
      <path d="M0 8H640 M0 63H640 M0 118H640" stroke="#6f8dae44" strokeWidth="1" fill="none"/>
      <polyline points={points} fill="none" stroke="#6de7cf" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {frames.map(frame=><circle key={frame.time} cx={frame.time/duration*640}
        cy={8+(1-(frame.value-bounds.min)/(bounds.max-bounds.min))*110} r="5.5" fill="#bce9ff" stroke="#376e97" strokeWidth="2"/>)}
      <path d={"M"+(playhead/100*640)+" 0V128"} stroke="#d2e5ff9c" strokeWidth="1" strokeDasharray="5 4"/>
    </svg>
    <p className="pm-animation-help">Choose a property, seek the timeline and add a keyframe. Select a diamond to edit it. Changes are undoable and exported with the scene document.</p>
  </div>;
}

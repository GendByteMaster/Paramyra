"use client";
import {useRef,useState} from "react";
import {KeyRound,Plus,Trash2} from "lucide-react";
import {ANIMATABLE_PROPERTIES,deleteKeyframe,moveKeyframe,propertyBounds,sampleProperty,supportsProperty,upsertKeyframe,
  type AnimatableProperty,type KeyframeEase,type LayerKeyframe} from "@/core/animation/keyframes";
import type {MathLayer} from "@/core/document/schema";

type Props={layer:MathLayer;time:number;duration:number;onSeek:(time:number)=>void;
  onEdit:(fn:(layer:MathLayer)=>MathLayer)=>void};
const names:Record<AnimatableProperty,string>={
  "opacity":"Opacity","offset.x":"Position X","offset.y":"Position Y",
  "params.strokeWidth":"Stroke width","formula.a":"Formula a","formula.b":"Formula b","formula.c":"Formula c",
};
const EASES:KeyframeEase[]=["linear","ease-in","ease-out","ease-in-out","hold"];
type Drag={pointerId:number;property:AnimatableProperty;from:number;startX:number;left:number;width:number};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export function AnimationTimeline({layer,time,duration,onSeek,onEdit}:Props){
  const [property,setProperty]=useState<AnimatableProperty>("opacity");
  const drag=useRef<Drag|null>(null);
  const suppressClick=useRef(false);
  const available=ANIMATABLE_PROPERTIES.filter(p=>supportsProperty(layer,p));
  const active=available.includes(property)?property:"opacity";
  const getFrames=(p:AnimatableProperty)=>(layer.keyframes??[]).filter(frame=>frame.property===p).sort((a,b)=>a.time-b.time);
  const frames=getFrames(active);
  const selected=frames.find(frame=>Math.abs(frame.time-time)<0.051);
  const bounds=propertyBounds(active);
  const currentValue=sampleProperty(layer,active,time);
  const playhead=clamp(time/duration*100,0,100);
  const move=(p:AnimatableProperty,from:number,to:number)=>{
    if(!Number.isFinite(to)||to<0||to>duration||to>60)return;
    const snapped=Math.round(to*100)/100;
    if(getFrames(p).some(frame=>frame.time!==from&&Math.abs(frame.time-snapped)<0.005))return;
    onEdit(l=>moveKeyframe(l,p,from,snapped,duration));
    setProperty(p);onSeek(snapped);
  };
  const add=()=>{
    const frame:LayerKeyframe={property:active,time:Math.round(time*100)/100,
      value:Number(currentValue.toFixed(4)),ease:"ease-in-out"};
    onEdit(l=>upsertKeyframe(l,frame));
  };
  const setValue=(raw:number)=>{
    if(!Number.isFinite(raw)||raw<bounds.min||raw>bounds.max)return;
    const frame:LayerKeyframe=selected
      ?{...selected,value:raw}:{property:active,time:Math.round(time*100)/100,value:raw,ease:"ease-in-out"};
    onEdit(l=>upsertKeyframe(l,frame));
  };
  const points=Array.from({length:81},(_,index)=>{
    const at=duration*index/80;
    const value=sampleProperty(layer,active,at);
    return (index/80*640).toFixed(1)+","+(8+(1-(value-bounds.min)/(bounds.max-bounds.min))*110).toFixed(1);
  }).join(" ");
  return <div className="pm-animation-editor" aria-label="Keyframe Animation Editor">
    <div className="pm-animation-heading"><span><KeyRound size={14}/> ADVANCED KEYFRAME ANIMATION</span>
      <small>{layer.title} · {frames.length} markers</small>
    </div>
    <div className="pm-animation-control-row">
      <label>Property<select aria-label="Animated property" value={active} onChange={e=>setProperty(e.target.value as AnimatableProperty)}>
        {available.map(p=><option key={p} value={p}>{names[p]}</option>)}
      </select></label>
      <label>Value<input type="number" aria-label="Animated value" min={bounds.min} max={bounds.max}
        step={bounds.step} value={Number(currentValue.toFixed(4))}
        onChange={e=>setValue(e.target.valueAsNumber)}/></label>
      <label>Easing<select aria-label="Keyframe easing" value={selected?.ease??"ease-in-out"}
        disabled={!selected} onChange={e=>{
          if(!selected)return;
          const ease=e.target.value as KeyframeEase;
          onEdit(l=>upsertKeyframe(l,{...selected,ease}));
        }}>{EASES.map(ease=><option key={ease} value={ease}>{ease}</option>)}</select></label>
    </div>
    <div className="pm-animation-controls">
      <button type="button" onClick={add} disabled={!Number.isFinite(currentValue)||!Number.isFinite(time)}
        aria-label="Add keyframe at playhead"><Plus size={14}/> {selected?"Update keyframe":"Add keyframe"}</button>
      <button type="button" aria-label="Delete keyframe at playhead" disabled={!selected}
        onClick={()=>onEdit(l=>deleteKeyframe(l,active,selected!.time))}><Trash2 size={14}/> Remove</button>
      {selected&&<label className="pm-keyframe-time-label">Keyframe time
        <input type="number" key={active+":"+selected.time} aria-label="Keyframe time" min={0}
          max={duration} step={0.01} defaultValue={selected.time}
          onBlur={e=>move(active,selected.time,e.target.valueAsNumber)}
          onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}/>
      </label>}
      <small>{time.toFixed(2)}s / {duration.toFixed(2)}s</small>
    </div>
    <div className="pm-multitrack" aria-label="Animation property tracks">
      {available.map(p=>{
        const trackFrames=getFrames(p);
        return <div className={"pm-multitrack-row"+(p===active?" is-active":"")} key={p}>
          <button type="button" className="pm-multitrack-label" aria-pressed={p===active}
            onClick={()=>setProperty(p)} title={names[p]}>{names[p]}</button>
          <div className="pm-animation-track" aria-label={"Keyframe track for "+names[p]}>
            <div className="pm-animation-track-fill" style={{width:playhead+"%"}}/>
            <div className="pm-animation-playhead" style={{left:playhead+"%"}}/>
            {trackFrames.map((frame,index)=><button key={frame.time+":"+index} type="button"
              style={{left:(frame.time/duration*100)+"%"}} className={"pm-keyframe-marker"+(p===active&&selected?.time===frame.time?" selected":"")}
              aria-label={"Seek to "+names[p]+" keyframe at "+frame.time.toFixed(2)+" seconds"}
              title={frame.time+"s · "+frame.value+" · "+frame.ease}
              onPointerDown={e=>{
                if(e.button!==0)return;
                const rect=e.currentTarget.parentElement?.getBoundingClientRect();
                if(!rect||rect.width<=0)return;
                suppressClick.current=false;
                drag.current={pointerId:e.pointerId,property:p,from:frame.time,startX:e.clientX,left:rect.left,width:rect.width};
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerUp={e=>{
                const current=drag.current;
                if(!current||current.pointerId!==e.pointerId)return;
                drag.current=null;
                if(Math.abs(e.clientX-current.startX)<4)return;
                suppressClick.current=true;
                const to=clamp((e.clientX-current.left)/current.width*duration,0,duration);
                move(current.property,current.from,to);
              }}
              onPointerCancel={()=>{drag.current=null;}}
              onClick={e=>{
                if(suppressClick.current){suppressClick.current=false;e.preventDefault();return;}
                setProperty(p);onSeek(frame.time);
              }}
              onKeyDown={e=>{
                if(e.key==="ArrowLeft"||e.key==="ArrowRight"){
                  e.preventDefault();
                  move(p,frame.time,clamp(frame.time+(e.key==="ArrowRight"?1:-1)*(e.shiftKey?0.1:0.01),0,duration));
                }
              }}/>)}
          </div>
        </div>;
      })}
    </div>
    <div className="pm-animation-ruler"><span>0s</span><span>{(duration/2).toFixed(1)}s</span><span>{duration.toFixed(1)}s</span></div>
    <div className="pm-animation-graph-label"><span>GRAPH EDITOR</span><small>Value over time · {names[active]}</small></div>
    <svg className="pm-animation-graph" role="img" aria-label={"Interpolation graph for "+names[active]}
      viewBox="0 0 640 128" preserveAspectRatio="none">
      <path d="M0 8H640 M0 63H640 M0 118H640" stroke="#6f8dae44" strokeWidth="1" fill="none"/>
      <polyline points={points} fill="none" stroke="#6de7cf" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {frames.map(frame=><circle key={frame.time} cx={frame.time/duration*640}
        cy={8+(1-(frame.value-bounds.min)/(bounds.max-bounds.min))*110} r="5.5" fill="#bce9ff" stroke="#376e97" strokeWidth="2"/>)}
      <path d={"M"+(playhead/100*640)+" 0V128"} stroke="#d2e5ff9c" strokeWidth="1" strokeDasharray="5 4"/>
    </svg>
    <p className="pm-animation-help">Select a track and seek to add a keyframe. Drag diamonds or use arrow keys to move them; edit exact time numerically. Formula tracks appear only on formula layers. All changes support Undo/Redo and JSON export.</p>
  </div>;
}

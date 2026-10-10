"use client";
import {useRef,useState} from "react";
import {KeyRound,Plus,Trash2} from "lucide-react";
import {BezierCurveEditor} from "./bezier-curve-editor";
import {TimelineLayerOverview} from "./timeline-layer-overview";
import {keyframesInBox,panTimeline,snapTimelineTime,timeAtPointer,timelineFraction,timelineWindow,
  type TimelineSnap,type TimelineWindow} from "@/core/animation/timeline-view";
import {ANIMATABLE_PROPERTIES,DEFAULT_BEZIER,deleteKeyframe,deleteKeyframes,moveKeyframe,moveKeyframes,propertyBounds,sampleProperty,supportsProperty,upsertKeyframe,
  type AnimatableProperty,type KeyframeEase,type KeyframeRef,type LayerKeyframe} from "@/core/animation/keyframes";
import type {MathLayer} from "@/core/document/schema";

type Props={layer:MathLayer;layers:readonly MathLayer[];time:number;duration:number;
  onSeek:(time:number)=>void;onSelectLayer:(layerId:string)=>void;
  onEdit:(fn:(layer:MathLayer)=>MathLayer)=>void};
const names:Record<AnimatableProperty,string>={
  "opacity":"Opacity","offset.x":"Position X","offset.y":"Position Y",
  "params.strokeWidth":"Stroke width","formula.a":"Formula a","formula.b":"Formula b","formula.c":"Formula c",
};
const EASES:KeyframeEase[]=["linear","ease-in","ease-out","ease-in-out","hold","bezier"];
const frameKey=(p:AnimatableProperty,t:number)=>p+":"+t.toFixed(2);
type Drag={pointerId:number;property:AnimatableProperty;from:number;startX:number;left:number;width:number;refs:KeyframeRef[]};
type BoxDrag={pointerId:number;startX:number;startY:number;rect:DOMRect;extend:boolean};
type BoxVisual={left:number;top:number;width:number;height:number};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export function AnimationTimeline({layer,layers,time,duration,onSeek,onSelectLayer,onEdit}:Props){
  const [property,setProperty]=useState<AnimatableProperty>("opacity");
  const [selection,setSelection]=useState<{layerId:string;keys:string[];anchor:string}>({layerId:"",keys:[],anchor:""});
  const [batchOffset,setBatchOffset]=useState("0.25");
  const [zoom,setZoom]=useState(1);
  const [windowStart,setWindowStart]=useState(0);
  const [snap,setSnap]=useState<TimelineSnap>(0);
  const [trackMode,setTrackMode]=useState<"selected"|"all">("selected");
  const span=duration/zoom;
  const start=clamp(windowStart,0,Math.max(0,duration-span));
  const window:TimelineWindow={start,end:start+span};
  const zoomTo=(next:number)=>{
    const ratio=clamp(next,1,8);
    const nextWindow=timelineWindow(duration,ratio,time,window);
    setZoom(ratio);setWindowStart(nextWindow.start);
  };
  const pan=(fraction:number)=>setWindowStart(panTimeline(duration,window,fraction).start);
  const snapTo=(at:number,refs:KeyframeRef[],width:number)=>{
    const keys=new Set(refs.map(f=>frameKey(f.property,f.time)));
    const neighbourTimes=(layer.keyframes??[]).filter(f=>!keys.has(frameKey(f.property,f.time))).map(f=>f.time);
    return snapTimelineTime(at,duration,snap,neighbourTimes,window,width);
  };
  const drag=useRef<Drag|null>(null);
  const suppressClick=useRef(false);
  const suppressTrackClick=useRef(false);
  const trackList=useRef<HTMLDivElement|null>(null);
  const boxDrag=useRef<BoxDrag|null>(null);
  const [boxVisual,setBoxVisual]=useState<BoxVisual|null>(null);
  const available=ANIMATABLE_PROPERTIES.filter(p=>supportsProperty(layer,p));
  const active=available.includes(property)?property:"opacity";
  const getFrames=(p:AnimatableProperty)=>(layer.keyframes??[]).filter(frame=>frame.property===p).sort((a,b)=>a.time-b.time);
  const frames=getFrames(active);
  const liveKeys=new Set((layer.keyframes??[]).map(f=>frameKey(f.property,f.time)));
  const selectedKeys=selection.layerId===layer.id?selection.keys.filter(key=>liveKeys.has(key)):[];
  const selectedRefs:KeyframeRef[]=(layer.keyframes??[])
    .filter(f=>selectedKeys.includes(frameKey(f.property,f.time)))
    .map(f=>({property:f.property,time:f.time}));
  const playheadSelected=frames.find(frame=>Math.abs(frame.time-time)<0.051);
  const selected=selectedKeys.length===1
    ?frames.find(frame=>frameKey(frame.property,frame.time)===selectedKeys[0])??playheadSelected
    :playheadSelected;
  const selectFrame=(p:AnimatableProperty,at:number,shift:boolean,toggle:boolean)=>{
    const key=frameKey(p,at);
    const previous=selection.layerId===layer.id?selection:{layerId:layer.id,keys:[],anchor:""};
    if(shift&&previous.anchor.startsWith(p+":")){
      const first=Number(previous.anchor.slice(p.length+1));
      const range=getFrames(p).filter(f=>f.time>=Math.min(first,at)&&f.time<=Math.max(first,at))
        .map(f=>frameKey(p,f.time));
      setSelection({layerId:layer.id,keys:[...new Set([...previous.keys,...range])],anchor:previous.anchor});
    }else if(toggle){
      setSelection({layerId:layer.id,keys:previous.keys.includes(key)?previous.keys.filter(k=>k!==key):[...previous.keys,key],anchor:key});
    }else setSelection({layerId:layer.id,keys:[key],anchor:key});
    setProperty(p);
  };
  const clearSelection=()=>setSelection({layerId:layer.id,keys:[],anchor:""});
  const applyDelta=(refs:KeyframeRef[],delta:number)=>{
    if(!Number.isFinite(delta)||!refs.length)return;
    const adjusted=snap===0?delta:snapTo(refs[0].time+delta,refs,400)-refs[0].time;
    const changed=moveKeyframes(layer,refs,adjusted,duration);
    if(changed===layer)return;
    onEdit(l=>moveKeyframes(l,refs,adjusted,duration));
    setSelection({layerId:layer.id,keys:refs.map(f=>frameKey(f.property,Math.round((f.time+adjusted)*100)/100)),anchor:frameKey(refs[0].property,Math.round((refs[0].time+adjusted)*100)/100)});
  };
  const bounds=propertyBounds(active);
  const currentValue=sampleProperty(layer,active,time);
  const playhead=timelineFraction(time,window)*100;
  const playheadVisible=playhead>=0&&playhead<=100;
  const move=(p:AnimatableProperty,from:number,to:number)=>{
    if(!Number.isFinite(to)||to<0||to>duration||to>60)return;
    const snapped=snapTo(to,[{property:p,time:from}],400);
    if(getFrames(p).some(frame=>frame.time!==from&&Math.abs(frame.time-snapped)<0.005))return;
    onEdit(l=>moveKeyframe(l,p,from,snapped,duration));
    setProperty(p);onSeek(snapped);
  };
  const setFrameEase=(frame:LayerKeyframe,ease:KeyframeEase)=>{
    const next:LayerKeyframe=ease==="bezier"
      ?{...frame,ease,bezier:frame.bezier??DEFAULT_BEZIER}
      :{property:frame.property,time:frame.time,value:frame.value,ease};
    onEdit(l=>upsertKeyframe(l,next));
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
  const finishBox=(event:React.PointerEvent<HTMLDivElement>)=>{
    const dragState=boxDrag.current;
    if(!dragState||dragState.pointerId!==event.pointerId)return;
    boxDrag.current=null;setBoxVisual(null);
    if(Math.hypot(event.clientX-dragState.startX,event.clientY-dragState.startY)<5)return;
    suppressTrackClick.current=true;
    const rows=(trackList.current?Array.from(trackList.current.querySelectorAll<HTMLElement>(".pm-multitrack-row")):[])
      .map((element,index)=>({property:available[index],top:element.getBoundingClientRect().top,bottom:element.getBoundingClientRect().bottom}));
    const refs=keyframesInBox(layer.keyframes??[],
      timeAtPointer(dragState.startX,dragState.rect.left,dragState.rect.width,window),
      timeAtPointer(event.clientX,dragState.rect.left,dragState.rect.width,window),
      dragState.startY,event.clientY,rows);
    const selectedNow=refs.map(f=>frameKey(f.property,f.time));
    const previouslySelected=dragState.extend&&selection.layerId===layer.id?selection.keys:[];
    const next=[...new Set([...previouslySelected,...selectedNow])];
    setSelection({layerId:layer.id,keys:next,anchor:next[0]??""});
  };
  return <div className="pm-animation-editor" aria-label="Keyframe Animation Editor">
    <div className="pm-animation-heading"><span><KeyRound size={14}/> ADVANCED KEYFRAME ANIMATION</span>
      <small>{layer.title} · {frames.length} markers</small>
    </div>
    <div className="pm-timeline-toolbar" role="group" aria-label="Professional Timeline controls">
      <div className="pm-timeline-mode" role="group" aria-label="Layer track view">
        <button type="button" aria-label="Selected layer tracks" aria-pressed={trackMode==="selected"}
          onClick={()=>setTrackMode("selected")}>Selected layer</button>
        <button type="button" aria-label="All layer tracks" aria-pressed={trackMode==="all"}
          onClick={()=>setTrackMode("all")}>All layers ({layers.length})</button>
      </div>
      <div className="pm-timeline-zoom" role="group" aria-label="Timeline zoom controls">
        <button type="button" aria-label="Pan timeline left" disabled={start===0} onClick={()=>pan(-.5)}>←</button>
        <button type="button" aria-label="Zoom timeline out" disabled={zoom===1} onClick={()=>zoomTo(zoom/2)}>−</button>
        <output aria-label="Timeline zoom level">{zoom}×</output>
        <button type="button" aria-label="Zoom timeline in" disabled={zoom===8} onClick={()=>zoomTo(zoom*2)}>+</button>
        <button type="button" aria-label="Fit entire timeline" onClick={()=>{setZoom(1);setWindowStart(0);}}>Fit</button>
        <button type="button" aria-label="Pan timeline right" disabled={window.end>=duration} onClick={()=>pan(.5)}>→</button>
      </div>
      <label className="pm-timeline-snap">Snap
        <select aria-label="Keyframe snapping" value={snap} onChange={e=>setSnap(Number(e.target.value) as TimelineSnap)}>
          <option value={0}>Off</option><option value={0.1}>0.1s</option>
          <option value={0.25}>0.25s</option><option value={0.5}>0.5s</option><option value={1}>1s</option>
        </select>
      </label>
      <output className="pm-timeline-visible" aria-label="Visible timeline range">{window.start.toFixed(2)}–{window.end.toFixed(2)}s</output>
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
          setFrameEase(selected,ease);
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
    <div className="pm-animation-batch" role="group" aria-label="Multi-keyframe selection">
      <span>{selectedRefs.length} selected</span>
      <button type="button" aria-label="Select all keyframes in current track" disabled={!frames.length}
        onClick={()=>setSelection({layerId:layer.id,keys:frames.map(f=>frameKey(f.property,f.time)),anchor:frameKey(active,frames[0].time)})}>Select track</button>
      <button type="button" aria-label="Clear keyframe selection" disabled={!selectedRefs.length} onClick={clearSelection}>Clear</button>
      <label>Shift (s)<input type="number" aria-label="Keyframe group shift" step="0.01"
        value={batchOffset} onChange={e=>setBatchOffset(e.target.value)}/></label>
      <button type="button" aria-label="Move selected keyframes" disabled={!selectedRefs.length}
        onClick={()=>applyDelta(selectedRefs,Number(batchOffset))}>Move selected</button>
      <button type="button" aria-label="Delete selected keyframes" disabled={!selectedRefs.length}
        onClick={()=>{onEdit(l=>deleteKeyframes(l,selectedRefs));clearSelection();}}>Delete selected</button>
    </div>
    <div className="pm-animation-layout">
      <section className="pm-animation-track-column" aria-label="Timeline tracks">
        <div className="pm-animation-section-title"><span>PROPERTY TRACKS</span><small>{available.length} channels · {layer.keyframes?.length??0} keys</small></div>
    {trackMode==="all"?
      <TimelineLayerOverview layers={layers} selectedLayerId={layer.id} window={window}
        onSelectLayer={onSelectLayer} onSeek={onSeek}/>:
    <div className="pm-multitrack" aria-label="Animation property tracks" ref={trackList}>
      {available.map(p=>{
        const trackFrames=getFrames(p);
        return <div className={"pm-multitrack-row"+(p===active?" is-active":"")} key={p}>
          <button type="button" className="pm-multitrack-label" aria-pressed={p===active}
            onClick={()=>setProperty(p)} title={names[p]}>{names[p]}</button>
          <div className="pm-animation-track" aria-label={"Keyframe track for "+names[p]}
            onClick={e=>{
              if((e.target as HTMLElement).closest("button"))return;
              const bounds=e.currentTarget.getBoundingClientRect();
              if(bounds.width>0){setProperty(p);onSeek(clamp((e.clientX-bounds.left)/bounds.width*duration,0,duration));}
            }}>
            {playheadVisible&&<div className="pm-animation-track-fill" style={{width:playhead+"%"}}/>}
            {playheadVisible&&<div className="pm-animation-playhead" style={{left:playhead+"%"}}/>}
            {trackFrames.filter(frame=>timelineFraction(frame.time,window)>=0&&timelineFraction(frame.time,window)<=1).map((frame,index)=><button key={frame.time+":"+index} type="button"
              style={{left:(timelineFraction(frame.time,window)*100)+"%"}} className={"pm-keyframe-marker"+(selectedKeys.includes(frameKey(p,frame.time))?" selected":"")}
              aria-label={"Seek to "+names[p]+" keyframe at "+frame.time.toFixed(2)+" seconds"}
              aria-pressed={selectedKeys.includes(frameKey(p,frame.time))}
              title={frame.time+"s · "+frame.value+" · "+frame.ease}
              onPointerDown={e=>{
                if(e.button!==0)return;
                const rect=e.currentTarget.parentElement?.getBoundingClientRect();
                if(!rect||rect.width<=0)return;
                suppressClick.current=false;
                drag.current={pointerId:e.pointerId,property:p,from:frame.time,startX:e.clientX,left:rect.left,width:rect.width,
                  refs:selectedKeys.includes(frameKey(p,frame.time))&&selectedRefs.length>1
                    ?selectedRefs:[{property:p,time:frame.time}]};
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerUp={e=>{
                const current=drag.current;
                if(!current||current.pointerId!==e.pointerId)return;
                drag.current=null;
                if(Math.abs(e.clientX-current.startX)<4)return;
                suppressClick.current=true;
                const to=clamp((e.clientX-current.left)/current.width*duration,0,duration);
                if(current.refs.length>1)applyDelta(current.refs,Math.round((to-current.from)*100)/100);
                else move(current.property,current.from,to);
              }}
              onPointerCancel={()=>{drag.current=null;}}
              onClick={e=>{
                if(suppressClick.current){suppressClick.current=false;e.preventDefault();return;}
                selectFrame(p,frame.time,e.shiftKey,e.ctrlKey||e.metaKey);
                if(!e.ctrlKey&&!e.metaKey)onSeek(frame.time);
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
    <div className="pm-animation-ruler"><span>{window.start.toFixed(2)}s</span><span>{((window.start+window.end)/2).toFixed(2)}s</span><span>{window.end.toFixed(2)}s</span></div>
      </section>
      <section className="pm-animation-graph-column" aria-label="Graph inspector">
    {selected?.ease==="bezier"&&<BezierCurveEditor frame={selected}
      onChange={bezier=>onEdit(l=>upsertKeyframe(l,{...selected,ease:"bezier",bezier}))}/>}
    <div className="pm-animation-graph-label"><span>GRAPH EDITOR</span><small>Value over time · {names[active]}</small></div>
    <svg className="pm-animation-graph" role="img" aria-label={"Interpolation graph for "+names[active]}
      viewBox="0 0 640 128" preserveAspectRatio="none">
      <path d="M0 8H640 M0 63H640 M0 118H640" stroke="#6f8dae44" strokeWidth="1" fill="none"/>
      <polyline points={points} fill="none" stroke="#6de7cf" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {frames.map(frame=><circle key={frame.time} cx={frame.time/duration*640}
        cy={8+(1-(frame.value-bounds.min)/(bounds.max-bounds.min))*110} r="5.5" fill="#bce9ff" stroke="#376e97" strokeWidth="2"/>)}
      <path d={"M"+(playhead/100*640)+" 0V128"} stroke="#d2e5ff9c" strokeWidth="1" strokeDasharray="5 4"/>
    </svg>
      </section>
    </div>
    <p className="pm-animation-help">Zoom and pan the ruler · drag across property rows for box selection · Ctrl/Cmd-click toggles · Shift-click extends · Snap aligns edits to the grid or nearby keyframes. All layers is an overview; edits remain on the selected layer.</p>
  </div>;
}

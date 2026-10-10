"use client";

import {useRef,useState,type PointerEvent} from "react";
import {DEFAULT_BEZIER,validBezier,type BezierHandles,type LayerKeyframe} from "@/core/animation/keyframes";

type Axis=keyof BezierHandles;
type Drag={pointerId:number;handle:1|2;handles:BezierHandles};
const clamp=(n:number)=>Math.min(1,Math.max(0,Math.round(n*100)/100));

/** A normalized unit-square cubic editor. Changes are committed only on pointer release. */
export function BezierCurveEditor({frame,onChange}:{frame:LayerKeyframe;onChange:(next:BezierHandles)=>void}){
  const stored=frame.bezier??DEFAULT_BEZIER;
  const [preview,setPreview]=useState<{id:string;value:BezierHandles}|null>(null);
  const drag=useRef<Drag|null>(null);
  const id=frame.property+":"+frame.time;
  const handles=preview?.id===id?preview.value:stored;
  const x=(n:number)=>18+n*164;
  const y=(n:number)=>142-n*124;
  const commit=(value:BezierHandles)=>{
    if(validBezier(value))onChange(value);
    setPreview(null);
  };
  const fromPointer=(e:PointerEvent<SVGCircleElement>,handle:1|2):BezierHandles=>{
    const rect=e.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if(!rect||!rect.width||!rect.height)return handles;
    const nx=clamp((e.clientX-rect.left)/rect.width*200/164-18/164);
    const ny=clamp((142-(e.clientY-rect.top)/rect.height*160)/124);
    const current=drag.current?.handles??handles;
    return handle===1?{...current,x1:nx,y1:ny}:{...current,x2:nx,y2:ny};
  };
  const edit=(axis:Axis,raw:number)=>{
    if(Number.isFinite(raw)&&raw>=0&&raw<=1)commit({...stored,[axis]:clamp(raw)});
  };
  const circle=(handle:1|2)=>{
    const cx=x(handle===1?handles.x1:handles.x2);
    const cy=y(handle===1?handles.y1:handles.y2);
    return <circle key={handle} cx={cx} cy={cy} r="8" className={"pm-bezier-handle pm-bezier-handle-"+handle}
      role="button" tabIndex={0} aria-label={"Bezier control handle "+handle}
      onPointerDown={e=>{
        if(e.button!==0)return;
        drag.current={pointerId:e.pointerId,handle,handles};
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e=>{
        if(drag.current?.pointerId!==e.pointerId)return;
        const value=fromPointer(e,handle);
        drag.current.handles=value;
        setPreview({id,value});
      }}
      onPointerUp={e=>{
        if(drag.current?.pointerId!==e.pointerId)return;
        const value=fromPointer(e,handle);
        drag.current=null;
        commit(value);
      }}
      onPointerCancel={()=>{drag.current=null;setPreview(null);}}
      onKeyDown={e=>{
        if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))return;
        e.preventDefault();
        const step=e.shiftKey?0.1:0.01;
        const ax=handle===1?"x1":"x2",ay=handle===1?"y1":"y2";
        const dx=e.key==="ArrowLeft"?-step:e.key==="ArrowRight"?step:0;
        const dy=e.key==="ArrowDown"?-step:e.key==="ArrowUp"?step:0;
        commit({...stored,[ax]:clamp(stored[ax]+dx),[ay]:clamp(stored[ay]+dy)});
      }}/>;
  };
  return <div className="pm-bezier-editor" role="group" aria-label="Cubic Bezier curve editor">
    <div className="pm-animation-section-title"><span>CUBIC BEZIER</span><small>Outgoing segment · drag or enter handles</small></div>
    <svg className="pm-bezier-plane" viewBox="0 0 200 160" preserveAspectRatio="none" role="img"
      aria-label="Cubic Bezier easing curve">
      <path d="M18 18V142H182" className="pm-bezier-axes"/>
      <path d="M18 142L182 18" className="pm-bezier-diagonal"/>
      <path d={`M18 142L${x(handles.x1)} ${y(handles.y1)} M182 18L${x(handles.x2)} ${y(handles.y2)}`} className="pm-bezier-guide"/>
      <path d={`M18 142C${x(handles.x1)} ${y(handles.y1)} ${x(handles.x2)} ${y(handles.y2)} 182 18`} className="pm-bezier-line"/>
      <circle cx="18" cy="142" r="4" className="pm-bezier-endpoint"/>
      <circle cx="182" cy="18" r="4" className="pm-bezier-endpoint"/>
      {circle(1)}{circle(2)}
    </svg>
    <div className="pm-bezier-fields">
      {(["x1","y1","x2","y2"] as const).map(axis=><label key={axis}>{axis.toUpperCase()}
        <input key={id+":"+axis+":"+stored[axis]} type="number" aria-label={"Bezier "+axis}
          min={0} max={1} step={0.01} defaultValue={stored[axis]}
          onBlur={e=>edit(axis,e.target.valueAsNumber)}
          onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}/>
      </label>)}
    </div>
    <button className="pm-bezier-reset" type="button" onClick={()=>commit(DEFAULT_BEZIER)}
      aria-label="Reset Bezier handles">Reset curve</button>
  </div>;
}

"use client";
import {useEffect,useRef,useState,useSyncExternalStore,type PointerEvent as PointerReactEvent,type KeyboardEvent as KeyboardReactEvent} from "react";
import {Calculator,Grip,Maximize2,Minimize2,PanelLeft,PanelRight,X} from "lucide-react";
import {FormulaCalculator} from "./formula-calculator";
import type {Formula} from "@/core/math/formula";

type Pos={x:number;y:number};
type Layout={position:Pos|null;size:{width:number;height:number}|null;dock:"left"|"right"|null};
type Drag={id:number;x:number;y:number;left:number;top:number};
type Resize={id:number;x:number;y:number;width:number;height:number};
type Props={open:boolean;onClose:()=>void;formula:Formula;onPlot?:(expression:string)=>boolean};
const KEY="paramyra.calculator.window.v092";
const empty=():Layout=>({position:null,size:null,dock:null});
function loadLayout():Layout{
  if(typeof window==="undefined")return empty();
  try{
    const value:unknown=JSON.parse(localStorage.getItem(KEY)??"null");
    if(!value||typeof value!=="object"||Array.isArray(value))return empty();
    const v=value as Record<string,unknown>;
    const pos=v.position as Record<string,unknown>|null;
    const size=v.size as Record<string,unknown>|null;
    const width=size&&typeof size.width==="number"&&Number.isFinite(size.width)
      ?Math.max(340,Math.min(size.width,window.innerWidth-20)):null;
    const height=size&&typeof size.height==="number"&&Number.isFinite(size.height)
      ?Math.max(320,Math.min(size.height,window.innerHeight-24)):null;
    const position=pos&&typeof pos.x==="number"&&typeof pos.y==="number"&&Number.isFinite(pos.x)&&Number.isFinite(pos.y)
      ?{x:Math.max(8,Math.min(pos.x,Math.max(8,window.innerWidth-(width??424)-8))),
        y:Math.max(8,Math.min(pos.y,Math.max(8,window.innerHeight-(height??560)-8)))}:null;
    return{position,size:width!==null&&height!==null?{width,height}:null,
      dock:v.dock==="left"||v.dock==="right"?v.dock:null};
  }catch{return empty();}
}
const mobileSubscribe=(listener:()=>void)=>{
  const q=window.matchMedia("(max-width:760px)");q.addEventListener("change",listener);
  return()=>q.removeEventListener("change",listener);
};
const mobileValue=()=>window.matchMedia("(max-width:760px)").matches;
const serverValue=()=>false;

export function CalculatorWindow({open,onClose,formula,onPlot}:Props){
  const mobile=useSyncExternalStore(mobileSubscribe,mobileValue,serverValue);
  const root=useRef<HTMLDivElement>(null),drag=useRef<Drag|null>(null),resize=useRef<Resize|null>(null);
  const closeRef=useRef(onClose);
  const [layout,setLayout]=useState<Layout>(loadLayout);
  const [maximized,setMaximized]=useState(false);
  useEffect(()=>{closeRef.current=onClose;},[onClose]);
  const save=(next:Layout)=>{try{localStorage.setItem(KEY,JSON.stringify(next));}catch{/* optional storage */}};
  const clamp=(x:number,y:number):Pos=>{
    const bounds=root.current?.getBoundingClientRect();
    return{x:Math.max(8,Math.min(x,Math.max(8,window.innerWidth-(bounds?.width??424)-8))),
      y:Math.max(8,Math.min(y,Math.max(8,window.innerHeight-(bounds?.height??560)-8)))};
  };
  useEffect(()=>{
    if(!open)return;
    const html=document.documentElement,previous=html.style.overflow;
    if(mobile)html.style.overflow="hidden";
    const frame=requestAnimationFrame(()=>{
      const target=mobile?root.current?.querySelector<HTMLButtonElement>('[aria-label="Close calculator window"]'):
        root.current?.querySelector<HTMLInputElement>('[aria-label="Calculator expression"]');
      target?.focus({preventScroll:true});
    });
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();closeRef.current();return;}
      if(event.key!=="Tab"||!mobile)return;
      const controls=Array.from(root.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]')??[])
        .filter(el=>el.getClientRects().length>0);
      if(!controls.length)return;
      if(event.shiftKey&&(document.activeElement===controls[0]||!root.current?.contains(document.activeElement))){
        event.preventDefault();controls[controls.length-1].focus();
      }else if(!event.shiftKey&&(document.activeElement===controls[controls.length-1]||!root.current?.contains(document.activeElement))){
        event.preventDefault();controls[0].focus();
      }
    };
    window.addEventListener("keydown",onKey,true);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener("keydown",onKey,true);if(mobile)html.style.overflow=previous;};
  },[open,mobile]);
  useEffect(()=>{
    const onResize=()=>setLayout(previous=>{
      if(!previous.position)return previous;
      const bounds=root.current?.getBoundingClientRect();
      const width=bounds?.width??424,height=bounds?.height??560;
      return {...previous,position:{
        x:Math.max(8,Math.min(previous.position.x,Math.max(8,window.innerWidth-width-8))),
        y:Math.max(8,Math.min(previous.position.y,Math.max(8,window.innerHeight-height-8))),
      }};
    });
    window.addEventListener("resize",onResize);return()=>window.removeEventListener("resize",onResize);
  },[]);
  const beginDrag=(event:PointerReactEvent<HTMLDivElement>)=>{
    if(mobile||maximized||event.button!==0)return;
    const rect=root.current?.getBoundingClientRect();if(!rect)return;
    drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag=(event:PointerReactEvent<HTMLDivElement>)=>{
    const start=drag.current;if(!start||start.id!==event.pointerId)return;
    const pos=clamp(start.left+event.clientX-start.x,start.top+event.clientY-start.y);
    setLayout(prev=>({...prev,dock:null,position:pos}));
  };
  const endDrag=(event:PointerReactEvent<HTMLDivElement>)=>{
    if(drag.current?.id!==event.pointerId)return;
    drag.current=null;
    const bounds=root.current?.getBoundingClientRect();
    if(bounds){const next={...layout,dock:null,position:clamp(bounds.left,bounds.top)};setLayout(next);save(next);}
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyboardMove=(event:KeyboardReactEvent<HTMLDivElement>)=>{
    if(mobile||maximized||!event.altKey||!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key))return;
    const bounds=root.current?.getBoundingClientRect();if(!bounds)return;
    event.preventDefault();
    const next={...layout,dock:null,position:clamp((layout.position?.x??bounds.left)+(event.key==="ArrowLeft"?-24:event.key==="ArrowRight"?24:0),
      (layout.position?.y??bounds.top)+(event.key==="ArrowUp"?-24:event.key==="ArrowDown"?24:0))};
    setLayout(next);save(next);
  };
  const toggleDock=(side:"left"|"right")=>{
    const next={...layout,dock:layout.dock===side?null:side};
    setLayout(next);setMaximized(false);save(next);
  };
  const beginResize=(event:PointerReactEvent<HTMLDivElement>)=>{
    if(mobile||maximized||layout.dock||event.button!==0)return;
    const bounds=root.current?.getBoundingClientRect();if(!bounds)return;
    resize.current={id:event.pointerId,x:event.clientX,y:event.clientY,width:bounds.width,height:bounds.height};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveResize=(event:PointerReactEvent<HTMLDivElement>)=>{
    const start=resize.current;if(!start||start.id!==event.pointerId)return;
    const bounds=root.current?.getBoundingClientRect();
    const width=Math.max(340,Math.min(start.width+event.clientX-start.x,window.innerWidth-(bounds?.left??8)-8));
    const height=Math.max(320,Math.min(start.height+event.clientY-start.y,window.innerHeight-(bounds?.top??8)-8));
    setLayout(prev=>({...prev,size:{width,height}}));
  };
  const endResize=(event:PointerReactEvent<HTMLDivElement>)=>{
    if(resize.current?.id!==event.pointerId)return;
    resize.current=null;
    const bounds=root.current?.getBoundingClientRect();
    if(bounds){const next={...layout,size:{width:bounds.width,height:bounds.height}};setLayout(next);save(next);}
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyboardResize=(event:KeyboardReactEvent<HTMLDivElement>)=>{
    if(mobile||maximized||layout.dock||!event.altKey||!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key))return;
    const bounds=root.current?.getBoundingClientRect();if(!bounds)return;
    event.preventDefault();
    const width=Math.max(340,Math.min(bounds.width+(event.key==="ArrowLeft"?-24:event.key==="ArrowRight"?24:0),window.innerWidth-bounds.left-8));
    const height=Math.max(320,Math.min(bounds.height+(event.key==="ArrowUp"?-24:event.key==="ArrowDown"?24:0),window.innerHeight-bounds.top-8));
    const next={...layout,size:{width,height}};setLayout(next);save(next);
  };
  return <div className="pm-calc-window-layer" hidden={!open}>
    <button className="pm-calc-window-backdrop" type="button" aria-label="Dismiss calculator window" tabIndex={mobile?0:-1} onClick={onClose}/>
    <div id="pm-scientific-calculator-window" ref={root}
      className={"pm-calculator-window"+(maximized?" is-maximized":"")+(layout.dock?" is-docked-"+layout.dock:"")}
      style={!mobile&&!maximized?{
        ...(!layout.dock&&layout.position?{left:layout.position.x,top:layout.position.y}:{}),
        ...(layout.size?{width:layout.size.width,height:layout.size.height}:{})
      }:undefined}
      role="dialog" aria-modal={mobile} aria-label="Scientific calculator window">
      <div className="pm-calc-window-titlebar">
        <div className="pm-calc-window-grip" tabIndex={mobile?-1:0} aria-label="Move calculator window; Alt and arrow keys"
          onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={keyboardMove}>
          <span className="pm-calc-window-icon"><Calculator size={16}/></span>
          <span className="pm-calc-window-heading"><strong>Calculator Pro</strong><small>SCIENTIFIC · LOCAL</small></span>
          {!mobile&&<Grip size={14} className="pm-calc-drag-indicator" aria-hidden="true"/>}
        </div>
        <div className="pm-calc-window-actions">
          <button className="pm-calc-window-control pm-calc-dock" type="button" aria-label="Dock calculator left"
            aria-pressed={layout.dock==="left"} onClick={()=>toggleDock("left")}><PanelLeft size={15}/></button>
          <button className="pm-calc-window-control pm-calc-dock" type="button" aria-label="Dock calculator right"
            aria-pressed={layout.dock==="right"} onClick={()=>toggleDock("right")}><PanelRight size={15}/></button>
          <button type="button" className="pm-calc-window-control pm-calc-maximize"
            aria-label={maximized?"Restore calculator window":"Maximize calculator window"}
            onClick={()=>setMaximized(value=>!value)}>{maximized?<Minimize2 size={15}/>:<Maximize2 size={15}/>}</button>
          <button type="button" className="pm-calc-window-control pm-calc-close" aria-label="Close calculator window" onClick={onClose}><X size={18}/></button>
        </div>
      </div>
      <div className="pm-calc-window-content"><FormulaCalculator formula={formula} onPlot={onPlot}/></div>
      <div className="pm-calculator-resize" role="separator" tabIndex={mobile?-1:0} aria-label="Resize calculator window"
        onPointerDown={beginResize} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize}
        onKeyDown={keyboardResize}/>
      <div className="pm-calc-window-footer"><span className="pm-calc-window-live"/> BOUNDED MATH ENGINE <span>RAD · DEG · AST</span></div>
    </div>
  </div>;
}

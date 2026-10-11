"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Beaker, Check, CircleDot, Pause, Play, RotateCcw, Shuffle, SlidersHorizontal, Sparkles } from "lucide-react";
import { SceneCanvas } from "./scene-canvas";
import { SceneGlyph } from "./scene-glyph";
import { presetFor, presets } from "@/core/scenes/presets";
import { type SceneDocument, type SceneKind, type SceneParams, sceneSchema } from "@/core/scenes/schema";
import { createStudioHandoff, readPlaygroundScene, savePlaygroundScene } from "@/core/playground/session";

const subscribe=()=>()=>{};
const client=()=>true;
const server=()=>false;
type Param=keyof SceneParams;
const controls:ReadonlyArray<{key:Param;name:string;min:number;max:number;step:number;description:string}>= [
  {key:"frequencyX",name:"Frequency X",min:1,max:12,step:1,description:"Horizontal oscillations"},
  {key:"frequencyY",name:"Frequency Y",min:1,max:12,step:1,description:"Vertical oscillations"},
  {key:"phase",name:"Phase",min:0,max:6.2832,step:.01,description:"Wave offset (radians)"},
  {key:"amplitude",name:"Amplitude",min:.1,max:1,step:.01,description:"Scale of the curve"},
  {key:"strokeWidth",name:"Stroke width",min:.5,max:4,step:.1,description:"Curve thickness"},
];
const hints:Record<SceneKind,{heading:string;body:string;equation:string;tip:string}>={
  lissajous:{heading:"Explore harmonic motion",body:"Combine two oscillations to discover symmetry and changing patterns.",equation:"x = A sin(at + φ)   ·   y = A sin(bt)",tip:"Try Frequency X = 3 and Frequency Y = 4, then increase Phase."},
  "polar-rose":{heading:"Discover geometric petals",body:"A simple polar equation generates intricate symmetric forms.",equation:"r = A cos(kθ + φ)",tip:"Try changing Frequency X from 5 to 6 and watch the petal count."},
  wave:{heading:"Study interference",body:"Change the frequencies to explore wave superposition.",equation:"y = f(x, t)",tip:"Try matching both frequencies, then separate them."},
};
function quantize(value:number,min:number,max:number,step:number):number{
  if(!Number.isFinite(value))return min;
  const bounded=Math.max(min,Math.min(max,value));
  return Number(Math.min(max,Math.max(min,min+Math.round((bounded-min)/step)*step)).toFixed(4));
}
export function PlaygroundClient(){
  const hydrated=useSyncExternalStore(subscribe,client,server);
  if(!hydrated)return <div className="pm-pg-loading" role="status">Loading Playground…</div>;
  return <PlaygroundWorkspace/>;
}
function PlaygroundWorkspace(){
  const router=useRouter();
  const [scene,setScene]=useState<SceneDocument>(()=>readPlaygroundScene()??presetFor("lissajous"));
  const [playing,setPlaying]=useState(true);
  const [time,setTime]=useState(0);
  const [seekVersion,setSeekVersion]=useState(0);
  const [speed,setSpeed]=useState(1);
  const [notice,setNotice]=useState("");
  const [opening,setOpening]=useState(false);
  useEffect(()=>{savePlaygroundScene(scene);},[scene]);
  const changeKind=(kind:SceneKind)=>{
    setScene(presetFor(kind));setTime(0);setSeekVersion(n=>n+1);
    setNotice("");setPlaying(true);
  };
  const setParam=(key:Param,value:number)=>{
    const config=controls.find(c=>c.key===key)!;
    const next=quantize(value,config.min,config.max,config.step);
    setScene(s=>({...s,params:{...s.params,[key]:next}}));
  };
  const randomize=()=>{
    const params={...scene.params};
    for(const field of controls){
      if(field.key==="strokeWidth")continue;
      params[field.key]=quantize(field.min+Math.random()*(field.max-field.min),field.min,field.max,field.step);
    }
    setScene(old=>({...old,params}));setNotice("New variation generated. Nothing was changed in Studio.");
  };
  const openInStudio=()=>{
    const validated=sceneSchema.safeParse(scene);
    if(!validated.success)return setNotice("Cannot transfer an invalid experiment.");
    const token=createStudioHandoff(validated.data);
    if(!token)return setNotice("Unable to prepare a Studio draft. Session storage may be disabled.");
    setOpening(true);
    router.push("/studio?playgroundTransfer="+encodeURIComponent(token));
  };
  const hint=hints[scene.kind];
  const visible=controls.filter(c=>scene.kind!=="polar-rose"||c.key!=="frequencyY");
  return <div className="pm-pg" aria-label="Mathematics Playground">
    <header className="pm-pg-topbar">
      <div className="pm-pg-identity">
        <Link href="/explore" className="pm-pg-back" aria-label="Back to Explore"><ArrowLeft size={17}/></Link>
        <div className="pm-pg-mark"><Beaker size={19}/></div>
        <div><span className="pm-pg-eyebrow">PARAMYRA / PLAYGROUND</span><h1>Mathematics Playground</h1><p>Try ideas freely. Your Studio project stays untouched.</p></div>
      </div>
      <div className="pm-pg-top-actions">
        <span className="pm-pg-session"><CircleDot size={12}/> TEMPORARY EXPERIMENT</span>
        <button type="button" className="pm-pg-open" disabled={opening} onClick={openInStudio}>Open in Studio <ArrowRight size={16}/></button>
      </div>
    </header>

    <div className="pm-pg-workarea">
      <aside className="pm-pg-panel pm-pg-library" aria-label="Experiment presets">
        <div className="pm-pg-panel-title"><Sparkles size={17}/><div><span className="pm-pg-eyebrow">01 / EXPLORE</span><h2>Choose a mathematical form</h2></div></div>
        <div className="pm-pg-presets">
          {presets.map(p=><button key={p.kind} type="button" className={"pm-pg-preset"+(scene.kind===p.kind?" is-active":"")} aria-pressed={scene.kind===p.kind}
            onClick={()=>changeKind(p.kind)}>
            <span className="pm-pg-glyph"><SceneGlyph kind={p.kind}/></span>
            <span className="pm-pg-preset-copy"><strong>{p.title}</strong><small>{hints[p.kind].heading}</small></span>
            {scene.kind===p.kind&&<Check size={15}/>}
          </button>)}
        </div>
        <div className="pm-pg-side-note"><strong>No commitment required.</strong><p>Presets and parameter changes stay inside this tab until you explicitly open a Studio draft.</p></div>
      </aside>

      <main className="pm-pg-center" aria-label="Interactive mathematics experiment">
        <div className="pm-pg-canvas-head">
          <div><span className="pm-pg-eyebrow">LIVE EXPERIMENT / CANVAS 2D</span><h2>{scene.title}</h2></div>
          <span className="pm-pg-status"><span/> {playing?"LIVE":"PAUSED"}</span>
        </div>
        <div className="pm-pg-canvas">
          <SceneCanvas key={scene.kind} scene={scene} playing={playing} duration={12} speed={speed} time={time} seekVersion={seekVersion} onTimeChange={setTime}/>
          <span className="pm-pg-canvas-label">PARAMYRA · MATH LAB</span>
        </div>
        <div className="pm-pg-transport">
          <div className="pm-pg-equation"><span>ACTIVE EQUATION</span><code>{hint.equation}</code></div>
          <div className="pm-pg-play-buttons">
            <button type="button" onClick={()=>setPlaying(v=>!v)} aria-label={playing?"Pause animation":"Play animation"}>
              {playing?<Pause size={15}/>:<Play size={15}/>} {playing?"Pause":"Play"}
            </button>
            <button type="button" onClick={()=>{setTime(0);setSeekVersion(n=>n+1);}} aria-label="Restart animation"><RotateCcw size={15}/> Restart</button>
          </div>
        </div>
        <div className="pm-pg-playhead">
          <label htmlFor="pm-pg-time">TIME</label>
          <input id="pm-pg-time" aria-label="Experiment time" type="range" min={0} max={12} step=".05" value={Math.min(12,time)}
            onChange={e=>{setTime(e.target.valueAsNumber);setSeekVersion(n=>n+1);}}/>
          <output>{time.toFixed(1)}s / 12s</output>
          <select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>
            <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option>
          </select>
        </div>
        {notice&&<div className="pm-pg-notice" role="status">{notice}</div>}
      </main>

      <aside className="pm-pg-panel pm-pg-inspector" aria-label="Experiment controls">
        <div className="pm-pg-panel-title"><SlidersHorizontal size={17}/><div><span className="pm-pg-eyebrow">02 / EXPERIMENT</span><h2>Adjust the variables</h2></div></div>
        <div className="pm-pg-scroll">
          <div className="pm-pg-guidance"><strong>{hint.heading}</strong><p>{hint.body}</p></div>
          <div className="pm-pg-controls">
            {visible.map(c=><div className="pm-pg-field" key={c.key}>
              <div className="pm-pg-field-row"><label htmlFor={"pm-pg-"+c.key}>{c.name}</label>
                <input type="number" aria-label={"Set "+c.name+" numerically"} min={c.min} max={c.max} step={c.step} value={scene.params[c.key]}
                  onChange={e=>{if(e.target.value!=="")setParam(c.key,e.target.valueAsNumber);}}/></div>
              <span className="pm-pg-field-desc">{c.description}</span>
              <input id={"pm-pg-"+c.key} aria-label={c.name} type="range" min={c.min} max={c.max} step={c.step} value={scene.params[c.key]} onChange={e=>setParam(c.key,e.target.valueAsNumber)}/>
              <div className="pm-pg-scale"><span>{c.min}</span><span>{c.max}</span></div>
            </div>)}
          </div>
          <div className="pm-pg-tip"><strong>TRY THIS</strong><p>{hint.tip}</p></div>
          <div className="pm-pg-variation">
            <button type="button" onClick={randomize}><Shuffle size={15}/> Surprise me</button>
            <button type="button" onClick={()=>changeKind(scene.kind)}><RotateCcw size={15}/> Reset</button>
          </div>
        </div>
      </aside>
    </div>
    <div className="pm-pg-footer"><span><CircleDot size={11}/> LOCAL / PER-TAB SESSION</span><span>PLAYGROUND IS ISOLATED FROM STUDIO PROJECTS</span></div>
  </div>;
}

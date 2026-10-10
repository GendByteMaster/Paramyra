"use client";

import type {MathLayer} from "@/core/document/schema";
import {timelineFraction,type TimelineWindow} from "@/core/animation/timeline-view";
import type {AnimatableProperty} from "@/core/animation/keyframes";

const names:Record<AnimatableProperty,string>={
  "opacity":"Opacity","offset.x":"Position X","offset.y":"Position Y",
  "params.strokeWidth":"Stroke width","formula.a":"Formula a","formula.b":"Formula b","formula.c":"Formula c",
};

export function TimelineLayerOverview({layers,selectedLayerId,window,onSelectLayer,onSeek}:{
  layers:readonly MathLayer[];selectedLayerId:string;window:TimelineWindow;
  onSelectLayer:(id:string)=>void;onSeek:(time:number)=>void;
}){
  return <div className="pm-overview" role="region" aria-label="All layer animation tracks">
    <p>All document layers · select a row to edit its properties. Markers navigate to their keyframe.</p>
    {layers.map(layer=>{
      const tracks=[...new Set((layer.keyframes??[]).map(f=>f.property))];
      return <div className={"pm-overview-layer"+(layer.id===selectedLayerId?" is-current":"")} key={layer.id}>
        <button type="button" className="pm-overview-layer-title" aria-label={"Edit layer "+layer.title}
          aria-pressed={layer.id===selectedLayerId} onClick={()=>onSelectLayer(layer.id)}>
          <span className="pm-overview-layer-color" style={{backgroundColor:layer.color}}/>
          <span>{layer.title}</span><small>{layer.keyframes?.length??0} keys</small>
        </button>
        {tracks.length===0?<div className="pm-overview-empty">No animation tracks</div>:tracks.map(property=>
          <div className="pm-overview-row" key={property}>
            <span title={names[property]}>{names[property]}</span>
            <div className="pm-overview-track" aria-label={layer.title+" "+names[property]+" overview"}>
              {(layer.keyframes??[]).filter(f=>f.property===property).map(f=>{
                const position=timelineFraction(f.time,window);
                return position>=0&&position<=1?<button key={f.time} type="button"
                  aria-label={"Navigate "+layer.title+" "+names[property]+" keyframe "+f.time.toFixed(2)+" seconds"}
                  className="pm-overview-key" style={{left:position*100+"%"}}
                  title={f.time.toFixed(2)+"s"}
                  onClick={()=>{onSelectLayer(layer.id);onSeek(f.time);}}/>:null;
              })}
            </div>
          </div>)}
      </div>;
    })}
  </div>;
}

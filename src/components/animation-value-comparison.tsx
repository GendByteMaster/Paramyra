"use client";

import type {MathLayer} from "@/core/document/schema";
import {getLayerProperty,sampleProperty,supportsProperty,
  type AnimatableProperty} from "@/core/animation/keyframes";

const compare:readonly {property:AnimatableProperty;label:string}[]=[
  {property:"opacity",label:"Opacity"},
  {property:"params.strokeWidth",label:"Stroke width"},
  {property:"offset.x",label:"Offset X"},
  {property:"offset.y",label:"Offset Y"},
  {property:"formula.a",label:"Formula a"},
  {property:"formula.b",label:"Formula b"},
  {property:"formula.c",label:"Formula c"},
];
const format=(value:number)=>Number(value.toFixed(3)).toString();

/**
 * Inspector projects both values from the authoritative layer. Never copy the
 * evaluated animation result into MathDocument or write preview values on seek.
 */
export function AnimationValueComparison({layer,time,onOpenAnimation}:{
  layer:MathLayer;time:number;onOpenAnimation:()=>void;
}){
  const keyed=new Set((layer.keyframes??[]).map(frame=>frame.property));
  const candidates=compare.filter(item=>supportsProperty(layer,item.property));
  // Inactive tracks need no extra Inspector rows. Keep two common baseline
  // values visible so base vs playhead terminology is discoverable.
  const displayed=candidates.filter(item=>keyed.has(item.property)||
    item.property==="opacity"||item.property==="params.strokeWidth");
  return <section className="pm-value-comparison" aria-label="Animation value comparison">
    <div className="pm-value-comparison-heading">
      <div><strong>Base vs. Playhead</strong><small>{time.toFixed(2)}s · {keyed.size} animated {keyed.size===1?"property":"properties"}</small></div>
      <button type="button" aria-label="Edit animation keyframes" onClick={onOpenAnimation}>Edit animation</button>
    </div>
    <div className="pm-value-comparison-labels" aria-hidden="true">
      <span>PROPERTY</span><span>BASE</span><span>AT PLAYHEAD</span>
    </div>
    {displayed.map(({property,label})=>{
      const base=getLayerProperty(layer,property),live=sampleProperty(layer,property,time);
      const animated=keyed.has(property);
      return <div className="pm-value-comparison-row" key={property} data-animated={animated}>
        <span title={label}>{label}{animated&&<em>Keyed</em>}</span>
        <output aria-label={"Base "+label}>{format(base)}</output>
        <output aria-label={"At playhead "+label} data-differs={Math.abs(live-base)>0.0001}>{format(live)}</output>
      </div>;
    })}
    <p>Inspector controls edit the base layer. Keyframes determine the displayed value at the current playhead. Seeking never rewrites base values.</p>
  </section>;
}

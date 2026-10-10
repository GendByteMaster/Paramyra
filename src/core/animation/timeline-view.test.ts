import {describe,expect,it} from "vitest";
import {keyframesInBox,panTimeline,snapTimelineTime,timeAtPointer,timelineFraction,timelineWindow} from "./timeline-view";
import {moveKeyframes,upsertKeyframe,type LayerKeyframe} from "./keyframes";
import {newFormulaLayer} from "../document/schema";

describe("v1.0 M2.3 Professional Timeline pure coordinate math",()=>{
  it("zooms around the anchor and pans without leaving document bounds",()=>{
    const fitted={start:0,end:12};
    const zoomed=timelineWindow(12,2,6,fitted);
    expect(zoomed).toEqual({start:3,end:9});
    expect(timelineWindow(12,8,11,fitted)).toEqual({start:10.5,end:12});
    expect(panTimeline(12,zoomed,2)).toEqual({start:6,end:12});
    expect(panTimeline(12,zoomed,-2)).toEqual({start:0,end:6});
    expect(timeAtPointer(175,100,300,zoomed)).toBe(4.5);
    expect(timeAtPointer(999,100,300,zoomed)).toBe(9);
    expect(timelineFraction(6,zoomed)).toBe(.5);
    expect(timelineWindow(12,1,3,zoomed)).toEqual({start:0,end:12});
  });

  it("snaps only when enabled, with neighbour priority in pixel tolerance",()=>{
    const view={start:3,end:9};
    expect(snapTimelineTime(4.74,12,0,[4.72],view,600)).toBe(4.74);
    expect(snapTimelineTime(4.74,12,.5,[4.72],view,600)).toBe(4.72);
    expect(snapTimelineTime(4.74,12,.5,[4.4],view,600)).toBe(4.5);
    expect(snapTimelineTime(11.99,12,1,[],view,600)).toBe(12);
    expect(snapTimelineTime(-10,12,.25,[],view,600)).toBe(0);
    expect(snapTimelineTime(14,12,.25,[],view,600)).toBe(12);
    expect(snapTimelineTime(NaN,12,.25,[],view,600)).toBe(0);
  });

  it("selects a rectangle across properties regardless of drag direction",()=>{
    const frames:LayerKeyframe[]=[
      {property:"opacity",time:2,value:.2,ease:"linear"},
      {property:"opacity",time:6,value:.6,ease:"linear"},
      {property:"offset.x",time:5,value:.5,ease:"linear"},
      {property:"formula.a",time:5,value:1,ease:"hold"},
    ];
    const rows=[{property:"opacity" as const,top:100,bottom:135},
      {property:"offset.x" as const,top:140,bottom:175}];
    const selected=[{property:"opacity",time:6},{property:"offset.x",time:5}];
    expect(keyframesInBox(frames,4,7,130,160,rows)).toEqual(selected);
    expect(keyframesInBox(frames,7,4,160,130,rows)).toEqual(selected);
    expect(keyframesInBox(frames,4,7,190,220,rows)).toEqual([]);
  });

  it("preserves transactional group editing after snapping and rejects collisions",()=>{
    let layer=newFormulaLayer("formula");
    layer=upsertKeyframe(layer,{property:"opacity",time:1,value:.2,ease:"linear"});
    layer=upsertKeyframe(layer,{property:"opacity",time:3,value:.8,ease:"linear"});
    const refs=[{property:"opacity" as const,time:1}];
    const to=snapTimelineTime(1.28,12,.25,[],{start:0,end:12},480);
    const updated=moveKeyframes(layer,refs,to-1,12);
    expect(updated.keyframes?.map(f=>f.time)).toEqual([1.25,3]);
    expect(layer.keyframes?.map(f=>f.time)).toEqual([1,3]);
    expect(moveKeyframes(layer,refs,2,12)).toBe(layer);
  });
});

import type { MathDocument } from "../document/schema";
import type { CanvasView } from "./canvas2d";
import { drawDocument } from "./canvas2d";
import { layerWorldPoint, pixelScale, worldToScreen } from "./geometry";
import { resolveLiveScene, type CompiledGraph } from "../graph/live";

export type ExportBackground="dark"|"transparent";
export type ExportSize=Readonly<{width:number;height:number}>;
export function validateExportSize(size:ExportSize):boolean{
  return Number.isInteger(size.width)&&Number.isInteger(size.height)
    &&size.width>=320&&size.height>=240&&size.width<=2400&&size.height<=1600
    &&size.width*size.height<=3_840_000;
}
const clean=(value:string)=>value.replace(/[<>&"']/g,(char)=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"}[char]??""));
const n=(value:number)=>Number.isFinite(value)?Number(value.toFixed(3)).toString():"0";
const filename=(doc:MathDocument,ext:string)=>"paramyra-"+doc.id.replace(/[^a-zA-Z0-9_-]/g,"-").slice(0,60)+"."+ext;

/** Self-contained SVG with no untrusted HTML/script, external images or runtime CSS. */
export function createSceneSvg(doc:MathDocument,time:number,view:CanvasView,size:ExportSize,background:ExportBackground="dark",liveGraph:CompiledGraph|null=null):string{
  if(!validateExportSize(size)||!Number.isFinite(time)||time<0||time>doc.duration)throw Error("Invalid export settings");
  const render=resolveLiveScene(doc,time,liveGraph).document;
  const lines:string[]=[
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+size.width+" "+size.height+'" width="'+size.width+'" height="'+size.height+'">',
    "<title>"+clean(doc.title)+"</title>",
  ];
  if(background==="dark")lines.push('<rect width="100%" height="100%" fill="#090e17"/>');
  const visible=render.layers.filter(l=>l.visible&&l.opacity>0);
  const samples=Math.max(320,Math.min(850,Math.floor(8400/Math.max(1,visible.length)),Math.ceil(pixelScale(size,view.zoom)*2.2)));
  for(const layer of visible){
    let commands="",previous:{x:number;y:number}|null=null;
    for(let index=0;index<=samples;index++){
      const world=layerWorldPoint(layer,index/samples,time,size);
      if(!Number.isFinite(world.x+world.y)||Math.abs(world.x)>100||Math.abs(world.y)>100){previous=null;continue;}
      const current=worldToScreen(world,size,view);
      const move=!previous||Math.hypot(current.x-previous.x,current.y-previous.y)>Math.max(size.width,size.height)*1.5;
      commands+=(move?"M":"L")+n(current.x)+" "+n(current.y)+" ";
      previous=current;
    }
    if(!commands)continue;
    const color=/^#[0-9a-fA-F]{6}$/.test(layer.color)?layer.color:"#ffffff";
    lines.push('<path d="'+commands.trim()+'" fill="none" stroke="'+color+'" stroke-opacity="'+n(layer.opacity)+'" stroke-width="'+n(layer.params.strokeWidth)+'" stroke-linejoin="round" stroke-linecap="round"/>');
  }
  lines.push("</svg>");return lines.join("\n");
}
function triggerDownload(blob:Blob,name:string):void{
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;anchor.download=name;anchor.style.display="none";document.body.appendChild(anchor);
  anchor.click();anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function saveSvg(doc:MathDocument,time:number,view:CanvasView,size:ExportSize,background:ExportBackground,liveGraph:CompiledGraph|null=null):void{
  const svg=createSceneSvg(doc,time,view,size,background,liveGraph);
  triggerDownload(new Blob([svg],{type:"image/svg+xml;charset=utf-8"}),filename(doc,"svg"));
}
export async function savePng(doc:MathDocument,time:number,view:CanvasView,size:ExportSize,background:ExportBackground,liveGraph:CompiledGraph|null=null):Promise<void>{
  if(!validateExportSize(size)||!Number.isFinite(time)||time<0||time>doc.duration)throw Error("Invalid export settings");
  const canvas=document.createElement("canvas");
  canvas.width=size.width;canvas.height=size.height;
  const ctx=canvas.getContext("2d");if(!ctx)throw Error("Canvas unavailable");
  // The same renderer is authoritative for live scene and PNG output.
  drawDocument(ctx,size.width,size.height,doc,time,view,background==="transparent",liveGraph);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("PNG encoding failed")),"image/png"));
  triggerDownload(blob,filename(doc,"png"));
}

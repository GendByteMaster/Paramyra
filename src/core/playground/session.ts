import { documentFromScene, parseDocument, type MathDocument } from "@/core/document/schema";
import { sceneSchema, type SceneDocument } from "@/core/scenes/schema";

const HANDOFF_KEY="paramyra.playground.transfer.v1";
const DRAFT_PREFIX="paramyra.playground.studio-draft.v1.";
export const STUDIO_DOCUMENT_KEY="paramyra.document.v3";
export const PLAYGROUND_SESSION_KEY="paramyra.playground.experiment.v2";

type Handoff={token:string;document:MathDocument};
const isToken=(s:string):boolean=>/^[0-9a-f-]{36}$/i.test(s);

/** An explicit import starts a new Studio draft, never a write to the saved project. */
export function createStudioHandoff(scene:SceneDocument):string|null{
  if(typeof window==="undefined")return null;
  const parsed=sceneSchema.safeParse(scene);
  if(!parsed.success)return null;
  try{
    const token=crypto.randomUUID();
    const base=documentFromScene(parsed.data);
    const document:MathDocument={...base,id:crypto.randomUUID(),title:(parsed.data.title+" Experiment").slice(0,120)};
    window.sessionStorage.setItem(HANDOFF_KEY,JSON.stringify({token,document} satisfies Handoff));
    return token;
  }catch{return null;}
}

/** Validates the URL token against this tab's handoff, ignoring untrusted URL-only claims. */
export function readStudioHandoff():{token:string;document:MathDocument}|null{
  if(typeof window==="undefined")return null;
  const token=new URLSearchParams(window.location.search).get("playgroundTransfer");
  if(!token||!isToken(token))return null;
  try{
    const raw=window.sessionStorage.getItem(HANDOFF_KEY);
    if(!raw||raw.length>150_000)return null;
    const transfer:unknown=JSON.parse(raw);
    if(!transfer||typeof transfer!=="object")return null;
    const record=transfer as Record<string,unknown>;
    if(record.token!==token)return null;
    const original=parseDocument(record.document);
    if(!original)return null;
    const updated=window.sessionStorage.getItem(DRAFT_PREFIX+token);
    if(updated&&updated.length<=150_000){
      const draft=parseDocument(JSON.parse(updated));
      if(draft&&draft.id===original.id)return {token,document:draft};
    }
    return {token,document:original};
  }catch{return null;}
}

export function saveStudioHandoffDraft(token:string,document:MathDocument):boolean{
  if(typeof window==="undefined"||!isToken(token))return false;
  try{
    const handoff=readStudioHandoff();
    if(!handoff||handoff.token!==token||handoff.document.id!==document.id)return false;
    const parsed=parseDocument(document);
    if(!parsed)return false;
    window.sessionStorage.setItem(DRAFT_PREFIX+token,JSON.stringify(parsed));
    return true;
  }catch{return false;}
}

/** Call only AFTER persisting the finalized scene in Studio storage. */
export function clearStudioHandoff(token:string):void{
  if(typeof window==="undefined"||!isToken(token))return;
  try{
    const raw=window.sessionStorage.getItem(HANDOFF_KEY);
    if(raw){
      const h=JSON.parse(raw) as {token?:string};
      if(h.token===token)window.sessionStorage.removeItem(HANDOFF_KEY);
    }
    window.sessionStorage.removeItem(DRAFT_PREFIX+token);
  }catch{/* Best effort; token will be stripped from URL. */}
}

export function readPlaygroundScene():SceneDocument|null{
  if(typeof window==="undefined")return null;
  try{
    const raw=window.sessionStorage.getItem(PLAYGROUND_SESSION_KEY);
    if(!raw||raw.length>4096)return null;
    const validated=sceneSchema.safeParse(JSON.parse(raw));
    return validated.success?validated.data:null;
  }catch{return null;}
}
export function savePlaygroundScene(scene:SceneDocument):boolean{
  if(typeof window==="undefined")return false;
  const parsed=sceneSchema.safeParse(scene);
  if(!parsed.success)return false;
  try{window.sessionStorage.setItem(PLAYGROUND_SESSION_KEY,JSON.stringify(parsed.data));return true;}
  catch{return false;}
}

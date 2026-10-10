import { z } from "zod";
import { sceneSchema, sceneParamsSchema, type SceneDocument as LegacyScene, type SceneKind } from "../scenes/schema";
import { validateFormula, type Formula, defaultFormula } from "../math/formula";
import { KEYFRAME_LIMIT, propertyBounds } from "../animation/keyframes";

const keyframeSchema=z.object({
  property:z.enum(["offset.x","offset.y","opacity","params.strokeWidth","formula.a","formula.b","formula.c"]),
  time:z.number().finite().min(0).max(60),
  value:z.number().finite().min(-2).max(2),
  ease:z.enum(["linear","ease-in","ease-out","ease-in-out","hold"]),
}).strict().superRefine((frame,ctx)=>{
  const range=propertyBounds(frame.property);
  if(frame.value<range.min||frame.value>range.max){
    ctx.addIssue({code:"custom",message:"Keyframe value outside property bounds",path:["value"]});
  }
});
const layerCore = {
  keyframes:z.array(keyframeSchema).max(KEYFRAME_LIMIT).optional(),
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  params: sceneParamsSchema,
  visible: z.boolean(),
  opacity: z.number().finite().min(0).max(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  offset: z.object({ x: z.number().finite().min(-2).max(2), y: z.number().finite().min(-2).max(2) }).strict(),
};
const legacyLayerSchema = z.object({ ...layerCore, kind: z.enum(["lissajous", "polar-rose", "wave"]) }).strict();
export const formulaSchema = z.object({
  mode: z.enum(["explicit", "parametric", "polar"]),
  exprX: z.string().max(160),
  exprY: z.string().min(1).max(160),
  min: z.number().finite().min(-20).max(20),
  max: z.number().finite().min(-20).max(20),
  a: z.number().finite().min(-10).max(10),
  b: z.number().finite().min(-10).max(10),
  c: z.number().finite().min(-10).max(10),
}).strict().superRefine((formula, ctx) => {
  const error = validateFormula(formula);
  if (error) ctx.addIssue({ code: "custom", message: error, path: ["exprY"] });
});
const formulaLayerSchema = z.object({ ...layerCore, kind: z.literal("formula"), formula: formulaSchema }).strict();
export const layerSchema = z.union([legacyLayerSchema, formulaLayerSchema]);

const v2DocumentSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  duration: z.number().finite().min(2).max(60),
  layers: z.array(legacyLayerSchema).min(1).max(12),
}).strict().superRefine((doc, ctx) => {
  const ids = new Set<string>();
  doc.layers.forEach((layer, index) => {
    if (ids.has(layer.id)) ctx.addIssue({ code: "custom", message: "Layer IDs must be unique", path: ["layers", index, "id"] });
    ids.add(layer.id);
  });
});

export const documentSchema = z.object({
  schemaVersion: z.literal(3),
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  duration: z.number().finite().min(2).max(60),
  layers: z.array(layerSchema).min(1).max(12),
}).strict().superRefine((doc, ctx) => {
  const ids = new Set<string>();
  doc.layers.forEach((layer, index) => {
    if (ids.has(layer.id)) ctx.addIssue({ code: "custom", message: "Layer IDs must be unique", path: ["layers", index, "id"] });
    ids.add(layer.id);
    const distinct=new Set<string>();
    for(const [frameIndex,frame] of (layer.keyframes??[]).entries()){
      const key=frame.property+":"+frame.time;
      if(distinct.has(key))ctx.addIssue({code:"custom",message:"Duplicate keyframe property/time",path:["layers",index,"keyframes",frameIndex]});
      distinct.add(key);
      if(layer.kind!=="formula"&&frame.property.startsWith("formula."))
        ctx.addIssue({code:"custom",message:"Formula tracks are only valid on formula layers",path:["layers",index,"keyframes",frameIndex,"property"]});
      if(frame.time>doc.duration)ctx.addIssue({code:"custom",message:"Keyframe must fit document duration",path:["layers",index,"keyframes",frameIndex,"time"]});
    }
  });
});

export type MathDocument = z.infer<typeof documentSchema>;
export type MathLayer = z.infer<typeof layerSchema>;
export type FormulaLayer = Extract<MathLayer, {kind:"formula"}>;
const colors: Record<SceneKind, string> = {
  lissajous: "#a9b8ff", "polar-rose": "#80e3db", wave: "#90c8ff",
};

export function layerFromScene(scene: LegacyScene, id = "layer-1"): MathLayer {
  return {
    id, title: scene.title, kind: scene.kind,
    params: { ...scene.params }, color: colors[scene.kind],
    opacity: 1, visible: true, offset: { x: 0, y: 0 },
  };
}
export function newFormulaLayer(id: string, mode: Formula["mode"] = "explicit"): FormulaLayer {
  return { id, title: "Custom Formula", kind: "formula", formula: defaultFormula(mode),
    params: { frequencyX: 3, frequencyY: 2, phase: 0, amplitude: 1, strokeWidth: 1.8 },
    color: "#e0adff", opacity: 1, visible: true, offset: { x: 0, y: 0 } };
}
export function documentFromScene(scene: LegacyScene): MathDocument {
  return { schemaVersion: 3, id: scene.id, title: scene.title,
    duration: 12, layers: [layerFromScene(scene)] };
}
/** v1/v2 are accepted strictly, migrated in memory to v3; never execute imported strings. */
export function parseDocument(input: unknown): MathDocument | null {
  const v3 = documentSchema.safeParse(input);
  if (v3.success) return v3.data;
  const v2 = v2DocumentSchema.safeParse(input);
  if (v2.success) return { ...v2.data, schemaVersion: 3 };
  const v1 = sceneSchema.safeParse(input);
  if (v1.success) return documentFromScene(v1.data);
  return null;
}
export function layerById(doc: MathDocument, id: string): MathLayer {
  return doc.layers.find(layer => layer.id === id) ?? doc.layers[0];
}
export function makeLayerId(): string {
  return crypto.randomUUID();
}

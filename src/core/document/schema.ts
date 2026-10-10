import { z } from "zod";
import { sceneSchema, sceneParamsSchema, type SceneDocument as LegacyScene, type SceneKind } from "../scenes/schema";
import { validateFormula, type Formula, defaultFormula } from "../math/formula";

const layerCore = {
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

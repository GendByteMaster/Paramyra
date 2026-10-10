import { z } from "zod";
import { sceneSchema, sceneParamsSchema, type SceneDocument as LegacyScene, type SceneKind } from "../scenes/schema";

export const layerSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  kind: z.enum(["lissajous", "polar-rose", "wave"]),
  params: sceneParamsSchema,
  visible: z.boolean(),
  opacity: z.number().finite().min(0).max(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  offset: z.object({ x: z.number().finite().min(-2).max(2), y: z.number().finite().min(-2).max(2) }).strict(),
}).strict();

export const documentSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  duration: z.number().finite().min(2).max(60),
  layers: z.array(layerSchema).min(1).max(12),
}).strict().superRefine((doc, ctx) => {
  const ids = new Set<string>();
  doc.layers.forEach((layer, index) => {
    if (ids.has(layer.id)) {
      ctx.addIssue({ code: "custom", message: "Layer IDs must be unique", path: ["layers", index, "id"] });
    }
    ids.add(layer.id);
  });
});

export type MathDocument = z.infer<typeof documentSchema>;
export type MathLayer = z.infer<typeof layerSchema>;

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

export function documentFromScene(scene: LegacyScene): MathDocument {
  return {
    schemaVersion: 2, id: scene.id, title: scene.title,
    duration: 12, layers: [layerFromScene(scene)],
  };
}

/** Treat all imported, localStorage and migrated documents as untrusted JSON. */
export function parseDocument(input: unknown): MathDocument | null {
  const v2 = documentSchema.safeParse(input);
  if (v2.success) return v2.data;
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

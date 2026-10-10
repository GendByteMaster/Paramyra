import { z } from "zod";

export const sceneParamsSchema = z.object({
  frequencyX: z.number().finite().min(1).max(12),
  frequencyY: z.number().finite().min(1).max(12),
  phase: z.number().finite().min(0).max(6.2832),
  amplitude: z.number().finite().min(0.1).max(1),
  strokeWidth: z.number().finite().min(0.5).max(4),
}).strict();

export const sceneSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  kind: z.enum(["lissajous", "polar-rose", "wave"]),
  params: sceneParamsSchema,
}).strict();

export type SceneParams = z.infer<typeof sceneParamsSchema>;
export type SceneDocument = z.infer<typeof sceneSchema>;
export type SceneKind = SceneDocument["kind"];

/**
 * Per-tab handoff between Studio's Timeline and the Node Graph preview.
 * Not part of MathDocument, not synchronized across tabs and never persisted to a project.
 * Writes are bounded and only follow the already-throttled playhead state updates.
 */
const KEY = "paramyra.studio.playhead.v1";

export function readSessionPlayhead(duration: number): number {
  if (typeof window === "undefined" || !Number.isFinite(duration) || duration <= 0) return 0;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw === null) return 0;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 && value <= duration ? value : 0;
  } catch {
    return 0;
  }
}

export function writeSessionPlayhead(time: number, duration: number): void {
  if (typeof window === "undefined" || !Number.isFinite(duration) || duration <= 0 ||
    !Number.isFinite(time) || time < 0 || time > duration) return;
  try {
    window.sessionStorage.setItem(KEY, String(time));
  } catch {
    // A disabled storage API must not prevent rendering or seeking.
  }
}

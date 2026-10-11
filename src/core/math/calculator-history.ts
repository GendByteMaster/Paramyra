/** Stored independently of MathDocument: calculator scratch history is not executable input. */
export const CALCULATOR_HISTORY_KEY = "paramyra.calculator.history.v1";
export const MAX_CALCULATOR_HISTORY = 40;
export type CalculatorHistoryItem = Readonly<{
  expression: string; display: string; value: number; unit: "rad"|"deg"; at: number;
}>;
export function parseCalculatorHistory(raw: string | null): CalculatorHistoryItem[] {
  if (!raw || raw.length > 24_000) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.slice(0, MAX_CALCULATOR_HISTORY).filter((row): row is CalculatorHistoryItem => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return false;
      const v = row as Record<string, unknown>;
      return typeof v.expression === "string" && v.expression.length > 0 && v.expression.length <= 160
        && typeof v.display === "string" && v.display.length <= 32
        && typeof v.value === "number" && Number.isFinite(v.value) && Math.abs(v.value) <= 1e6
        && (v.unit === "rad" || v.unit === "deg")
        && typeof v.at === "number" && Number.isSafeInteger(v.at) && v.at >= 0;
    });
  } catch { return []; }
}
export function addCalculatorHistory(items: readonly CalculatorHistoryItem[], item: CalculatorHistoryItem): CalculatorHistoryItem[] {
  return [item, ...items.filter(previous => previous.expression !== item.expression || previous.unit !== item.unit)]
    .slice(0, MAX_CALCULATOR_HISTORY);
}

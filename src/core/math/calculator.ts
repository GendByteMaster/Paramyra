import { compileExpression, evaluateExpression, MathExpressionError, type MathEnv } from "./expression";

export type CalculatorVariables = Readonly<Pick<MathEnv, "a" | "b" | "c" | "x" | "t">>;
export type CalculatorResult =
  | Readonly<{ ok: true; value: number; display: string }>
  | Readonly<{ ok: false; error: string }>;

const VARIABLES = ["a", "b", "c", "x", "u", "theta", "t"] as const;

/** Uses the same bounded, non-executable parser as rendered curves. */
export function calculateExpression(source: string, values: CalculatorVariables): CalculatorResult {
  try {
    compileExpression(source, VARIABLES);
    if (![values.a, values.b, values.c, values.x, values.t].every(Number.isFinite)) {
      return { ok: false, error: "Variables must be finite numbers." };
    }
    const environment: MathEnv = { ...values, u: values.x, theta: values.x };
    const value = evaluateExpression(source, VARIABLES, environment);
    if (!Number.isFinite(value)) return { ok: false, error: "Undefined or out-of-range result." };
    return { ok: true, value, display: formatCalculatorNumber(value) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof MathExpressionError ? error.message : "Invalid mathematical expression.",
    };
  }
}

/** 12 significant digits: avoid floating point artefacts without losing scientific notation. */
export function formatCalculatorNumber(value: number): string {
  if (!Number.isFinite(value)) return "Undefined";
  const rounded = Number(value.toPrecision(12));
  return Object.is(rounded, -0) || rounded === 0 ? "0" : rounded.toString();
}

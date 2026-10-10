import { compileExpression, MathExpressionError } from "./expression";

export type FormulaMode = "explicit" | "parametric" | "polar";
export type Formula = {
  mode: FormulaMode;
  exprX: string;
  exprY: string;
  min: number;
  max: number;
  a: number;
  b: number;
  c: number;
};
export const FORMULA_LIMIT = 160;
export function defaultFormula(mode: FormulaMode = "explicit"): Formula {
  const common = { a: 1, b: 3, c: 2 };
  if (mode === "parametric") return { ...common, mode, exprX: "a*cos(b*u+t)", exprY: "a*sin(c*u)", min: 0, max: Math.PI * 2 };
  if (mode === "polar") return { ...common, mode, exprX: "", exprY: "a*cos(b*theta+t)", min: 0, max: Math.PI * 2 };
  return { ...common, mode, exprX: "", exprY: "a*sin(b*x+t)", min: -3, max: 3 };
}
export function validateFormula(formula: Formula): string | null {
  if (!["explicit", "parametric", "polar"].includes(formula.mode)) return "Unsupported expression mode.";
  if (![formula.min, formula.max, formula.a, formula.b, formula.c].every(Number.isFinite)) return "All values must be finite.";
  if (formula.min < -20 || formula.max > 20 || formula.min >= formula.max || formula.max - formula.min < 0.01) {
    return "Domain must be increasing, within -20..20 and at least 0.01 wide.";
  }
  if ([formula.a, formula.b, formula.c].some(v => Math.abs(v) > 10)) return "Parameters a, b and c must be within -10..10.";
  if (formula.mode !== "parametric" && formula.exprX !== "") return "Only parametric curves use X(u).";
  try {
    const vars = formula.mode === "explicit" ? ["x", "t", "a", "b", "c"]
      : formula.mode === "parametric" ? ["u", "t", "a", "b", "c"]
      : ["theta", "t", "a", "b", "c"];
    if (formula.mode === "parametric") compileExpression(formula.exprX, vars);
    compileExpression(formula.exprY, vars);
  } catch (err) {
    return err instanceof MathExpressionError ? err.message : "Invalid formula.";
  }
  return null;
}

import { describe, expect, it } from "vitest";
import { compileExpression, evaluateExpression, MathExpressionError, type MathEnv } from "./expression";
import { defaultFormula, validateFormula } from "./formula";

const vars = ["x", "t", "a", "b", "c"];
const env: MathEnv = { x: 2, u: 0, theta: 0, t: 0, a: 1, b: 3, c: 2 };
const evalExpr = (s: string) => evaluateExpression(s, vars, env);

describe("bounded mathematical AST", () => {
  it("uses real precedence, right-associative powers, constants and unary signs", () => {
    expect(evalExpr("2+3*4")).toBe(14);
    expect(evalExpr("2^3^2")).toBe(512);
    expect(evalExpr("-2^2")).toBe(-4);
    expect(evalExpr("2^-3")).toBe(0.125);
    expect(evalExpr("(2+3)*4")).toBe(20);
    expect(evalExpr("sin(pi/2)+cos(0)+ln(e)")).toBeCloseTo(3);
    expect(evalExpr("sin(b*x)+t")).toBeCloseTo(Math.sin(6));
  });
  it("rejects executable syntax, prototype lookups and unapproved variables/functions", () => {
    for (const value of ["Math.sin(x)", "window.alert(1)", "x[0]", "constructor(1)", "__proto__",
      "sin.constructor", "process.exit()", "2x", "x;alert(1)", "sin(x,y)", "x?1:0", "theta"]) {
      expect(() => compileExpression(value, vars)).toThrow(MathExpressionError);
      expect(evalExpr(value)).toBeNaN();
    }
  });
  it("rejects huge inputs, malicious nesting and invalid tokens without eval", () => {
    for (const value of ["x".repeat(161), "(".repeat(40)+"x"+")".repeat(40),
      "x+".repeat(90)+"x", "1e999", "", "x + @"]) {
      expect(() => compileExpression(value, vars)).toThrow(MathExpressionError);
    }
  });
  it("returns gaps for division by zero and invalid math domains", () => {
    expect(evalExpr("1/(x-2)")).toBeNaN();
    expect(evalExpr("sqrt(-1)")).toBeNaN();
    expect(evalExpr("ln(-2)")).toBeNaN();
    expect(evalExpr("1e6*1e6")).toBeNaN();
  });
  it("checks formula modes and variable scopes", () => {
    const explicit=defaultFormula("explicit");
    const parametric=defaultFormula("parametric");
    const polar=defaultFormula("polar");
    expect(validateFormula(explicit)).toBeNull();
    expect(validateFormula(parametric)).toBeNull();
    expect(validateFormula(polar)).toBeNull();
    expect(validateFormula({...explicit,exprY:"theta+1"})).toMatch(/Unknown variable/);
    expect(validateFormula({...polar,exprY:"x+1"})).toMatch(/Unknown variable/);
    expect(validateFormula({...parametric,exprX:"1/0"})).toBeNull(); // syntax valid; bad point samples become gaps
    expect(validateFormula({...explicit,min:4,max:4})).not.toBeNull();
    expect(validateFormula({...explicit,a:Infinity})).not.toBeNull();
    expect(validateFormula({...polar,exprX:"malicious"})).not.toBeNull();
  });
});

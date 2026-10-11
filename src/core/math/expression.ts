/**
 * Bounded, expression-only mathematical parser. No code execution or dynamic imports.
 * Grammar: numeric literals, variables, parentheses and arithmetic operators.
 */
export type MathEnv = Readonly<{ x: number; u: number; theta: number; t: number; a: number; b: number; c: number; ans?: number }>;
type Ast =
  | { type: "number"; value: number }
  | { type: "variable"; name: keyof MathEnv }
  | { type: "unary"; sign: "-" | "+"; node: Ast }
  | { type: "postfix"; op: "!" | "%"; node: Ast }
  | { type: "binary"; op: "+" | "-" | "*" | "/" | "^"; left: Ast; right: Ast }
  | { type: "call"; name: keyof typeof FUNCTIONS; node: Ast };
type Token = { type: "number" | "id" | "symbol" | "end"; value: string; pos: number };
const FUNCTIONS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  abs: Math.abs, sqrt: Math.sqrt, exp: Math.exp,
  ln: Math.log, log: Math.log10, floor: Math.floor, ceil: Math.ceil,
} as const;
const VARIABLES = new Set(["x", "u", "theta", "t", "a", "b", "c", "ans"]);
const PRECEDENCE: Readonly<Record<string, number>> = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3 };
const MAX_SOURCE = 160;
const MAX_TOKENS = 100;
const MAX_NODES = 96;
const MAX_DEPTH = 24;
const MAX_VALUE = 1_000_000;

export class MathExpressionError extends Error {
  constructor(message: string, readonly position: number) {
    super(message + " at column " + (position + 1));
    this.name = "MathExpressionError";
  }
}
function tokenize(source: string): Token[] {
  if (!source.trim() || source.length > MAX_SOURCE) throw new MathExpressionError("Expression must be 1–160 characters", 0);
  const out: Token[] = [];
  let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i])) { i++; continue; }
    const start = i;
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(source.slice(i));
    if (number) {
      out.push({ type: "number", value: number[0], pos: start });
      i += number[0].length;
    } else {
      const id = /^[A-Za-z_][A-Za-z_0-9]*/.exec(source.slice(i));
      if (id) {
        out.push({ type: "id", value: id[0], pos: start });
        i += id[0].length;
      } else if ("+-*/^(),!%".includes(source[i])) {
        out.push({ type: "symbol", value: source[i], pos: start });
        i++;
      } else {
        throw new MathExpressionError("Unsupported character", i);
      }
    }
    if (out.length > MAX_TOKENS) throw new MathExpressionError("Too many tokens", start);
  }
  out.push({ type: "end", value: "", pos: source.length });
  return out;
}

class Parser {
  private index = 0;
  private nodes = 0;
  constructor(private readonly tokens: Token[], private readonly allowed: ReadonlySet<string>) {}
  private current(): Token { return this.tokens[this.index]; }
  private take(): Token { return this.tokens[this.index++]; }
  private check(symbol: string): boolean { return this.current().value === symbol; }
  private expect(symbol: string): void {
    if (!this.check(symbol)) throw new MathExpressionError("Expected '" + symbol + "'", this.current().pos);
    this.take();
  }
  private node<T extends Ast>(ast: T): T {
    if (++this.nodes > MAX_NODES) throw new MathExpressionError("Expression is too complex", this.current().pos);
    return ast;
  }
  parse(): Ast {
    const ast = this.expression(0, 0);
    if (this.current().type !== "end") throw new MathExpressionError("Unexpected token", this.current().pos);
    return ast;
  }
  private expression(minPrecedence: number, depth: number): Ast {
    if (depth > MAX_DEPTH) throw new MathExpressionError("Expression is too deeply nested", this.current().pos);
    let left = this.prefix(depth);
    while (this.current().type === "symbol") {
      const token = this.current();
      if ((token.value === "!" || token.value === "%") && minPrecedence <= 4) {
        this.take();
        left = this.node({type:"postfix",op:token.value as "!" | "%",node:left});
        continue;
      }
      const precedence = PRECEDENCE[token.value];
      if (!precedence || precedence < minPrecedence) break;
      this.take();
      const right = this.expression(precedence + (token.value === "^" ? 0 : 1), depth + 1);
      left = this.node({ type: "binary", op: token.value as "+" | "-" | "*" | "/" | "^", left, right });
    }
    return left;
  }
  private prefix(depth: number): Ast {
    const token = this.take();
    if (token.type === "number") {
      const value = Number(token.value);
      if (!Number.isFinite(value) || Math.abs(value) > MAX_VALUE) throw new MathExpressionError("Numeric literal is out of range", token.pos);
      return this.node({ type: "number", value });
    }
    if (token.value === "+" || token.value === "-") {
      const node = this.expression(3, depth + 1); // -x^2 = -(x^2)
      return this.node({ type: "unary", sign: token.value, node });
    }
    if (token.value === "(") {
      const expr = this.expression(0, depth + 1);
      this.expect(")");
      return expr;
    }
    if (token.type === "id") {
      if (token.value === "pi" || token.value === "e") {
        if (this.check("(")) throw new MathExpressionError("Constant cannot be called", token.pos);
        return this.node({ type: "number", value: token.value === "pi" ? Math.PI : Math.E });
      }
      if (this.check("(")) {
        if (!Object.hasOwn(FUNCTIONS, token.value)) throw new MathExpressionError("Unknown function '" + token.value + "'", token.pos);
        this.take();
        const value = this.expression(0, depth + 1);
        this.expect(")");
        return this.node({ type: "call", name: token.value as keyof typeof FUNCTIONS, node: value });
      }
      if (!VARIABLES.has(token.value) || !this.allowed.has(token.value)) {
        throw new MathExpressionError("Unknown variable '" + token.value + "'", token.pos);
      }
      return this.node({ type: "variable", name: token.value as keyof MathEnv });
    }
    throw new MathExpressionError("Expected a number, variable or '('", token.pos);
  }
}

/** Compilation is bounded and cached. A bad expression is never executed. */
const cache = new Map<string, Ast>();
export function compileExpression(source: string, variables: readonly string[]): Ast {
  const key = variables.join(",") + ":" + source;
  const existing = cache.get(key);
  if (existing) return existing;
  const ast = new Parser(tokenize(source), new Set(variables)).parse();
  if (cache.size >= 96) cache.clear();
  cache.set(key, ast);
  return ast;
}

export type MathEvaluationOptions = Readonly<{angleUnit?: "rad" | "deg"}>;
function evaluate(ast: Ast, env: MathEnv, angleUnit: "rad" | "deg"): number {
  switch (ast.type) {
    case "number": return ast.value;
    case "variable": return env[ast.name] ?? NaN;
    case "unary": return ast.sign === "-" ? -evaluate(ast.node, env, angleUnit) : evaluate(ast.node, env, angleUnit);
    case "postfix": {
      const value = evaluate(ast.node, env, angleUnit);
      if (ast.op === "%") return value / 100;
      // 10! already exceeds the existing 1e6 numeric budget.
      if (!Number.isInteger(value) || value < 0 || value > 9) return NaN;
      let result = 1;
      for (let n = 2; n <= value; n++) result *= n;
      return result;
    }
    case "call": {
      const raw = evaluate(ast.node, env, angleUnit);
      const trig = ast.name === "sin" || ast.name === "cos" || ast.name === "tan";
      const inverse = ast.name === "asin" || ast.name === "acos" || ast.name === "atan";
      const input = angleUnit === "deg" && trig ? raw * Math.PI / 180 : raw;
      const result = FUNCTIONS[ast.name](input);
      return angleUnit === "deg" && inverse ? result * 180 / Math.PI : result;
    }
    case "binary": {
      const lhs = evaluate(ast.left, env, angleUnit), rhs = evaluate(ast.right, env, angleUnit);
      switch (ast.op) {
        case "+": return lhs + rhs;
        case "-": return lhs - rhs;
        case "*": return lhs * rhs;
        case "/": return rhs === 0 ? NaN : lhs / rhs;
        case "^": return Math.pow(lhs, rhs);
      }
    }
  }
}

export function evaluateExpression(source: string, variables: readonly string[], env: MathEnv, options: MathEvaluationOptions = {}): number {
  try {
    const output = evaluate(compileExpression(source, variables), env, options.angleUnit === "deg" ? "deg" : "rad");
    return Number.isFinite(output) && Math.abs(output) <= MAX_VALUE ? output : NaN;
  } catch { return NaN; } // domain errors and invalid intermediate values become gaps
}

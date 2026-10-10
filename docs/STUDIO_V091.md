# Paramyra Studio v0.9.1 — Stability and Scientific Calculator

Target branch: `dev/master`; source: `dev/studio-stability-calculator-v091`. This is not merged into main.

## Formula Editor: Graph / Calculator
The existing formula editor keeps its Graph tool and MathDocument v3 contract. Calculator is an independent, session-local UI mode. It never edits the current graph when calculating numeric results.

- Live scientific math: addition, subtraction, multiplication, division, exponentiation, roots, trigonometry, `pi` and `e`.
- Reuse the existing bounded AST, never `eval` or `new Function`.
- Calculation variables `a, b, c` are shared with the curve's slider values; `x` input also supplies `u` and `theta`; separate `t` input. Angles are radians.
- Input max 160 characters; invalid syntax, nonfinite/domain errors and out-of-bounds output produce a clear error rather than a number.
- Digit and function keypad inserts at the caret with Backspace and Clear; Use Result and Copy Result, and Use Graph Equation provide explicit actions.
- Numeric output rounds to 12 significant digits. There is no hidden backend, API or persistent calculator history.
- The calculator is available when a Custom Formula layer is selected, via the Graph/Calculator tabs within Inspector. Other layer kinds retain their original Inspector.
- No changes to scene serialization or imported JSON migrations.

## Stability
Some earlier E2E tests checked Scene Library visibility immediately after navigation, while the React workspace can still be displaying its loading placeholder. Tests now assert `.pm-workspace` is mounted before testing library interactions. This is not a substitute for UX checking of actual input latency.

## Acceptance gates
1. ESLint, TypeScript, Vitest, production Next.js build.
2. Playwright desktop/mobile: graph–calculator toggle, mathematical result, expressions, keypad, error handling, responsive layout and graph isolation.
3. Vercel Preview built from exact PR SHA; verify no unexpected errors, manual touch behavior and color contrast.
4. Review captured screenshots and existing Canvas performance stress before promotion to main.

## Exclusions
No symbolic algebra, natural-language calculation, financial/physical-unit conversions, arbitrary JavaScript, persistent calculator history or server-side operation.

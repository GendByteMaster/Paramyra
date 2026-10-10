# Paramyra Studio v0.9.2 — Calculator Pro

**Base:** dev/master (`0997721`)  
**Feature:** dev/studio-calculator-pro-v092  
**Release:** Draft pull request to dev/master. Do not deploy to main until CI and final approval.

## Five capabilities

1. **Local history** — Every press of Equals, Enter, or Use result records a bounded calculation. Reopen and recall previous expressions; clear all locally. Storage key `paramyra.calculator.history.v1`, at most 40 entries, max 24 KiB parsed, strict shape validation. History is separate from the MathDocument and can be discarded without affecting scenes.
2. **Scientific keypad** — Existing digits/operators remain; adds ANS, %, x², factorial, Enter/equals, plus expandable tan/ln/log/exp/scientific exponent keys. Keyboard input works directly in the expression field. Selection and caret support remain. Touch keypad never automatically focuses the native soft keyboard.
3. **Window usability** — Desktop drag, maximize and close are preserved. Adds resize handle (also via Alt+arrow keyboard), dock left/right and saved size/position/dock (localStorage, bounded on restore and viewport resize). Mobile stays a scrollable, modal bottom sheet; saved desktop window geometry is never applied to mobile.
4. **Advanced math** — Shared bounded AST evaluates factorial (integers 0–9, because the numeric 1e6 budget is preserved), percent as postfix division by 100, previously stored ANS and DEG/RAD trigonometry. Numeric scientific notation is already accepted by the number lexer (`1e-3`). Input limit 160 characters, max 96 AST nodes, 24 depth, 100 tokens and max output magnitude 1e6 remain. The graph engine defaults to radians.
5. **Plot graph** — The selected calculator expression can generate a new explicit formula layer and be undone, without overwriting an existing layer. ANS is substituted as a bounded literal; invalid expressions or expressions using u/theta are disabled. Trigonometric expressions in DEG mode cannot Plot until RAD is selected so the plotted curve matches the calculator's interpretation. Respect the MathDocument 12-layer maximum, validate the same authoritative formula/schema, and preserve Undo/Redo history.

## Architecture / safety
- No dynamic execution (`eval`, `Function`) or backend math calls.
- New postfix nodes are interpreted by the existing AST evaluator. Only allowlisted functions/variables are callable.
- No MathDocument schema migration. Graph persistence remains separate from calculator local history/layout preferences.
- All stored history/layout values are untrusted and must be validated and bounded on reading. Storage failures are non-fatal.
- Calculator's x parameter is reused for u and theta in evaluation, whereas Plot only accepts explicit y(x,t).
- Accessibility: semantic labels, keyboard resize/dock/close, readable scroll areas, actual focus handling in mobile modal.

## Verification plan
- npm ci; npm run lint; npm run typecheck; npm test; npm run build; npm run test:e2e.
- Cover math (factorial/percent/ANS/DEG/RAD), malicious inputs, bounded local history and Plot/Undo.
- Cover desktop resize/dock persistence, mobile modal and no viewport overflow on 390×844.
- CI must pass on the exact final PR head; Vercel Preview must also build on that commit.
- Real hardware touch and sustained 12-layer performance remain separate follow-up acceptance tasks.

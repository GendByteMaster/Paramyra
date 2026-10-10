# Paramyra Studio v0.9.1 — Stability and Floating Calculator Window

Target branch: `dev/master`; source: `dev/studio-stability-calculator-v091`. This is not merged into main.

## Formula Editor: Graph / Calculator
The Formula Editor remains a graph authoring tool. Calculator is a separate, session-local **floating window** launched from the Studio toolbar or a Custom Formula layer's Inspector. It never edits the graph when calculating numeric results.

- Live scientific math: addition, subtraction, multiplication, division, exponentiation, roots, trigonometry, `pi` and `e`.
- Reuse the existing bounded AST, never `eval` or `new Function`.
- Calculation variables `a, b, c` are shared with the curve's slider values; `x` input also supplies `u` and `theta`; separate `t` input. Angles are radians.
- Input max 160 characters; invalid syntax, nonfinite/domain errors and out-of-bounds output produce a clear error rather than a number.
- Digit and function keypad inserts at the caret with Backspace and Clear; Use Result and Copy Result, and Use Graph Equation provide explicit actions.
- Numeric output rounds to 12 significant digits. There is no hidden backend, API or persistent calculator history.
- The calculator is accessible at any time through the **Calculator** action in the workspace toolbar, even when the Inspector is hidden. In Formula Editor, **Open Calculator** provides the same window.
- On desktop, the window is non-modal: graph/Cavas remain interactive, and users can drag it by the title bar, move it using Alt+Arrow keys, maximize/restore, or close it via X or Escape. Drag coordinates are viewport-clamped and corrected when resized.
- On mobile (up to 760px), it is a modal bottom sheet: a dimmed dismissible backdrop, trapped Tab navigation, content scrolling and a large close target. No native browser popup/new window is required.
- Inputs remain mounted when the window is closed: reopening preserves the unfinished scratch calculation. Focus returns to the launching control on close.
- No changes to scene serialization or imported JSON migrations.

## Stability
Some earlier E2E tests checked Scene Library visibility immediately after navigation, while the React workspace can still be displaying its loading placeholder. Tests now assert `.pm-workspace` is mounted before testing library interactions. This is not a substitute for UX checking of actual input latency.

## Acceptance gates
1. ESLint, TypeScript, Vitest, production Next.js build.
2. Playwright desktop/mobile: window launch from toolbar/Formula Editor, dragging, maximize/restore, Escape, modal backdrop, preserved scratch input, calculations, responsive layout and graph isolation.
3. Vercel Preview built from exact PR SHA; inspect desktop/mobile window screenshots and manually verify touch, focus and contrast.
4. Review captured screenshots and existing Canvas performance stress before promotion to main.

## Exclusions
No symbolic algebra, natural-language calculation, financial/physical-unit conversions, arbitrary JavaScript, persistent calculator history or server-side operation.

## Calculator Window visual QA (2026-10-10)

Review evidence: the CI `paramyra-visual-review` artifact on the exact branch commit provides three viewport sizes (1920×1080, 1365×768, 390×844) in Chromium profiles. The window is legible at desktop and mobile sizes, but visual review exposed extra focus framing around the Expression label, scroll pressure at 768px height, and a mobile auto-focus risk.

- A single focused input ring replaces the label-plus-input double outline.
- Scientific function/variable help is collapsible; the short desktop viewport uses tighter vertical spacing while preserving accessible keypad targets.
- Mobile uses initial focus on Close, not the text input, so opening the dialog does not automatically summon the software keyboard.
- Mobile locks background document scrolling while the modal is visible; it restores the original overflow value on close or viewport mode change.
- Window keyboard/focus setup runs only on actual open/mobile changes, not every animation frame or parent render; the close callback is updated through a ref.
- New browser assertions cover mobile focus/scroll lock and stable desktop focus during animation. Real hardware/mobile keyboard acceptance remains pending.

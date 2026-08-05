---
phase: quick-260803-kvg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/pages/PreviewPage.tsx
autonomous: false
requirements: [QUICK-260803-kvg]

must_haves:
  truths:
    - "In Learner Preview with Phone selected on a tall desktop window, the black phone bezel ends immediately below the lesson's bottom nav (Continue / Back / '1 / 7') — no dead gray band inside the bezel."
    - "Tablet mode behaves the same: bezel hugs the emulated screen."
    - "Desktop mode still fills the available authoring area as before."
    - "The emulated phone screen is still 390px wide and up to 844px tall (real-device logical viewport), not stretched to the browser window height."
    - "Short browser windows still work: the frame shrinks to the available height and the page scrolls rather than clipping."
  artifacts:
    - path: "apps/web/src/pages/PreviewPage.tsx"
      provides: "Device-frame section that shrink-wraps the emulated screen instead of stretching to the flex row height"
      contains: "self-start"
  key_links:
    - from: "apps/web/src/pages/PreviewPage.tsx <main>"
      to: "apps/web/src/pages/PreviewPage.tsx <section> device frame"
      via: "flex cross-axis sizing — section must NOT stretch to main's height"
      pattern: "self-start"
    - from: "apps/web/src/pages/PreviewPage.tsx <section>"
      to: "iframe + loading placeholder"
      via: "single shared height style (no duplicated literals that can drift)"
      pattern: "frameScreenStyle"
---

<objective>
Fix the Learner Preview phone/tablet frame rendering a large blank band inside the
device bezel, below the lesson's bottom nav, on tall desktop windows.

Purpose: The device preview is how authors sanity-check phone layout before SCORM
export. A bezel with hundreds of pixels of dead gray inside it makes the emulation
untrustworthy and looks broken.

Output: A one-file CSS/layout correction in `PreviewPage.tsx`, human-verified in the
browser at phone / tablet / desktop.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@apps/web/src/pages/PreviewPage.tsx

<root_cause>
Already diagnosed during planning — do NOT re-investigate from scratch, verify and fix.

`PreviewPage.tsx` renders (lines ~265-295):

- `<main className="flex flex-1 justify-center overflow-auto px-3 py-6 sm:px-6">`
- `<section className={"w-full overflow-hidden " + viewportClass(viewMode)}>` — this is
  the device bezel (`max-w-[390px] rounded-[2rem] border-[10px] border-slate-900`).
- Inside it, the `<iframe srcDoc={iframeHtml}>` with an inline
  `height: min(844px, calc(100vh - 8.5rem))`, `minHeight: 680px`.

`<main>` is a flex row with the default `align-items: stretch`, and the `<section>` has
no explicit cross-axis size — so the **bezel stretches to main's full height**
(≈ `100vh - 105px`: viewport minus the ~57px header minus the 48px `py-6`), while the
iframe inside it is capped at 844px. The difference is empty, unpainted section area
inside the black bezel and below the iframe — exactly the reported "blank space below
the pagination dots / Continue button", because at ≤560px the in-iframe bottom nav
(`.prism-nav`, `position: sticky; bottom: 0`) is the last thing in the iframe and sits
flush at the iframe's bottom edge.

Dead-space height = `(100vh - 105px) - min(844px, 100vh - 136px)`:
- ~31px on any window ≥ ~816px tall (already slightly wrong today),
- growing to `100vh - 949px` once the window exceeds ~980px tall — e.g. ~250px of dead
  band at a 1200px-tall viewport, ~300px at 1253px.

Ruled out during planning (do not touch these):
- The iframe document's own layout is correct: `.prism-shell{min-height:100vh}` +
  `.prism-card{min-height:calc(100vh - 70px)}` + `.prism-lesson{flex:1}` +
  `.prism-nav{position:sticky;bottom:0}` in `buildCss()` fill the iframe viewport, and
  `.prism-drawer` / `.prism-complete` are `position:fixed; display:none` so they
  contribute no flow height.
- `apps/web/src/lib/scormExport.ts` is the shared preview + SCORM render path. It is
  NOT the bug here and MUST NOT be edited by this plan — a regression there ships into
  exported packages.
- `packages/renderer/*` is not on this render path at all (see STATE.md, quick task
  `fast` 2026-07-20: a previous fix was wasted editing it).
</root_cause>

<interfaces>
From apps/web/src/pages/PreviewPage.tsx (current, to be modified):

```tsx
type ViewMode = 'phone' | 'tablet' | 'desktop';

function viewportClass(mode: ViewMode): string {
  if (mode === 'phone') return 'max-w-[390px] rounded-[2rem] border-[10px] border-slate-900 shadow-2xl';
  if (mode === 'tablet') return 'max-w-[760px] rounded-[1.75rem] border-[10px] border-slate-900 shadow-2xl';
  return 'max-w-5xl rounded-3xl border border-slate-200 shadow-xl';
}
```

The height literal `min(844px, calc(100vh - 8.5rem))` / `calc(100vh - 8.5rem)` plus
`minHeight: '680px'` is currently duplicated verbatim in TWO places: the `<iframe>`
style and the loading-placeholder `<div>` style.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Stop the device bezel stretching past the emulated screen</name>
  <files>apps/web/src/pages/PreviewPage.tsx</files>
  <action>
Two changes, both in `PreviewPage.tsx`. Do not modify any other file.

1. Add `self-start` to the device-frame `<section>` className so it shrink-wraps its
   content height instead of stretching to `<main>`'s flex row height. Result:
   `className={`w-full self-start overflow-hidden ${viewportClass(viewMode)}`}`.
   Keep `w-full` (width is still capped by the per-mode `max-w-*` class) and keep
   `overflow-hidden` (it clips the iframe to the rounded bezel).

   Use `self-start` on the section rather than `items-start` on `<main>`: the section
   is the element whose sizing is wrong, and `<main>` keeps `justify-center` so the
   frame stays horizontally centered. Do NOT instead move the height onto the section
   — putting an explicit height on a `box-border` element with a 10px bezel would
   shrink the emulated screen to 824px and silently break the 390x844 iPhone-class
   viewport this preview is meant to reproduce.

2. Single-source the frame height. Add a module-level helper next to `viewportClass`,
   and use it for BOTH the `<iframe>` style and the loading-placeholder `<div>` style
   (they currently duplicate the same literal and can drift):

   `const frameScreenStyle = (mode: ViewMode): CSSProperties => ({ height: mode === 'desktop' ? 'calc(100vh - 8.5rem)' : 'min(844px, calc(100vh - 8.5rem))', minHeight: '680px' })`

   Import `CSSProperties` as a type-only import from `react` (the file already imports
   hooks from `react`). Keep the exact existing height/minHeight values — they are
   correct and out of scope; the `min()` cap is what keeps a short window from
   clipping, and `minHeight: 680px` intentionally lets `<main class="overflow-auto">`
   scroll on very short windows.

   Add a one-line comment above the helper explaining that phone/tablet emulate a real
   device logical viewport while desktop fills the authoring area, and a one-line
   comment on the `self-start` explaining that without it the flex parent stretches the
   bezel and leaves dead space below the iframe. Keep the comments free of the literal
   token `min(844px` so the verification greps below stay meaningful.

Do not change `viewportClass`, the header, the view-mode toggle, the postMessage
handler, or anything in `scormExport.ts`.
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck && cd ../.. && pnpm lint --max-warnings=0</automated>
    <automated>test "$(grep -v '^[[:space:]]*\(//\|\*\|/\*\)' apps/web/src/pages/PreviewPage.tsx | grep -c 'self-start')" -ge 1</automated>
    <automated>test "$(grep -v '^[[:space:]]*\(//\|\*\|/\*\)' apps/web/src/pages/PreviewPage.tsx | grep -c 'min(844px')" -eq 1</automated>
    <automated>test "$(grep -v '^[[:space:]]*\(//\|\*\|/\*\)' apps/web/src/pages/PreviewPage.tsx | grep -c 'frameScreenStyle')" -eq 3</automated>
    <automated>git diff --name-only | grep -qxv 'apps/web/src/pages/PreviewPage.tsx' && exit 1 || exit 0</automated>
  </verify>
  <done>
`PreviewPage.tsx` typechecks and lints clean; the device-frame section carries
`self-start`; the height literal appears exactly once (in `frameScreenStyle`), which is
referenced by both the iframe and the loading placeholder; no other file changed.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
The Learner Preview device frame no longer stretches to the browser window height. The
phone/tablet bezel now hugs the emulated screen (390x844 / 760x844, capped to the
window), so the gray dead band that appeared inside the bezel below the Continue /
"1 / 7" nav is gone. Desktop mode is unchanged. Only `apps/web/src/pages/PreviewPage.tsx`
was touched — no change to the shared preview/SCORM render path in `scormExport.ts`.
  </what-built>
  <how-to-verify>
1. Run `pnpm dev` and open a module's Learner Preview:
   `/w/{workspaceId}/m/{moduleId}/preview`.
2. Maximize the browser window (the bug only shows on tall windows — ideally ≥ 1000px
   of viewport height; the taller the window, the larger the old dead band).
3. With **Phone** selected: the black bezel should end just below the bottom nav row
   (Continue button, Back, "1 / 7"). Expected: no gray/white empty band between that
   nav and the bottom bezel edge. The frame should look like a phone sitting on the
   gray canvas, with the leftover page space *outside* the bezel.
4. Click **Tablet**: same — bezel hugs the emulated screen, no internal dead band.
5. Click **Desktop**: unchanged from before — frame fills the authoring area.
6. Back on **Phone**, scroll the lesson inside the frame and click Continue / Back and
   a lesson dot: navigation still works and the frame does not resize or jump.
7. Resize the window short (~700px tall) with Phone selected: the frame should stay at
   least 680px tall and the outer page should scroll — content must not be clipped.

If a residual blank band remains *inside the iframe* after this fix (i.e. the bezel
hugs the iframe, but there is still empty space between the lesson content and the
bottom nav, or a thin strip below the nav), that is a DIFFERENT cause: the in-iframe
`.prism-card{min-height:calc(100vh - 70px)}` in `scormExport.ts` hardcodes a 70px
toolbar, but at ≤560px `.prism-toolbar` is ~63px, leaving ~7px short. Report it rather
than fixing it here — that file is the SCORM export path and needs its own task.
  </how-to-verify>
  <resume-signal>Type "approved", or paste a screenshot / describe what still looks wrong.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| author browser → preview iframe | Module content is rendered into a sandboxed `srcDoc` iframe (`allow-scripts allow-same-origin allow-popups`) and posts nav messages back to the parent. Unchanged by this plan. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-kvg-01 | Tampering | `PreviewPage` iframe sandbox + `postMessage` handler | accept | Out of scope: this plan changes only flex cross-axis sizing and a style literal. The `sandbox` attribute, `srcDoc` content, and the `window.addEventListener('message')` handler are explicitly not modified — Task 1's diff gate fails if any other file changes. |
| T-kvg-SC | Tampering | npm/pip/cargo installs | mitigate | No packages are installed by this plan. If any install becomes necessary, stop and escalate — no legitimacy audit exists for this quick task. |
</threat_model>

<verification>
- `cd apps/web && pnpm typecheck` — clean.
- `pnpm lint --max-warnings=0` — clean.
- `pnpm build` — production build succeeds.
- `git diff --name-only` lists exactly `apps/web/src/pages/PreviewPage.tsx`.
- Human verification checkpoint approved (phone / tablet / desktop on a tall window).
</verification>

<success_criteria>
- Phone and Tablet preview frames render with zero dead space inside the bezel below
  the lesson's bottom nav, on a maximized desktop window.
- Emulated phone screen remains 390px wide and up to 844px tall.
- Desktop mode, in-frame navigation, and short-window scrolling behave exactly as before.
- Exactly one file changed; `scormExport.ts` and `packages/renderer/*` untouched.
</success_criteria>

<output>
Create `.planning/quick/260803-kvg-phone-preview-blank-space/260803-kvg-SUMMARY.md` when done.
</output>
</content>
</invoke>

---
phase: quick-260803-kvg
plan: 01
subsystem: web/authoring-preview
tags: [css, layout, preview, ui-fix]
requires: []
provides:
  - "PreviewPage device-frame section that shrink-wraps the emulated screen (self-start)"
  - "frameScreenStyle(mode) — single-sourced iframe/placeholder height helper"
affects:
  - apps/web/src/pages/PreviewPage.tsx
tech-stack:
  added: []
  patterns:
    - "Flex-row cross-axis sizing: use self-start on a child that must NOT stretch to a flex parent's row height, instead of moving height logic onto the child."
key-files:
  created: []
  modified:
    - apps/web/src/pages/PreviewPage.tsx
decisions:
  - "Consolidated the duplicated height/minHeight literal into one frameScreenStyle(mode) helper used by both the <iframe> and the loading placeholder, per plan spec — kept exact existing values (min(844px, calc(100vh - 8.5rem)) / minHeight 680px)."
  - "Used self-start on the <section> device frame rather than items-start on <main>, preserving <main>'s justify-center horizontal centering, per plan's explicit guidance."
metrics:
  duration: "~20m"
  completed: "2026-08-03"
---

# Phase quick-260803-kvg Plan 01: Fix Phone Preview Blank Space Summary

Fixed the Learner Preview device bezel (phone/tablet) stretching to the full flex-row
height of `<main>` instead of shrink-wrapping the emulated screen, which left a large
dead gray band inside the black bezel below the lesson's bottom nav on tall desktop
windows.

## What Was Done

**Task 1 (type="auto") — COMPLETE, committed as `1945f1e`:**

1. Added `self-start` to the device-frame `<section>` className in
   `apps/web/src/pages/PreviewPage.tsx` (line ~274), so the bezel now shrink-wraps its
   content height instead of stretching to `<main>`'s flex-row cross-axis height.
   `<main>` keeps `justify-center` for horizontal centering. A one-line JSX comment
   above the section explains why (without `self-start`, the flex parent stretches the
   bezel and leaves dead space below the iframe).

2. Added a module-level `frameScreenStyle(mode: ViewMode): CSSProperties` helper next to
   `viewportClass`, single-sourcing the height/minHeight style that was previously
   duplicated verbatim between the `<iframe>` style prop and the loading-placeholder
   `<div>` style prop. Both call sites now use `style={frameScreenStyle(viewMode)}`.
   `CSSProperties` is imported as a type-only import from `react`. The exact existing
   values were preserved: `height: mode === 'desktop' ? 'calc(100vh - 8.5rem)' :
   'min(844px, calc(100vh - 8.5rem))'`, `minHeight: '680px'`.

Only `apps/web/src/pages/PreviewPage.tsx` was touched. `apps/web/src/lib/scormExport.ts`
and `packages/renderer/*` were not modified, per the plan's explicit restriction.

**Automated verification (all passed):**
- `cd apps/web && pnpm typecheck` — clean (had to run `pnpm install --frozen-lockfile`
  first; this worktree had no `node_modules` at all — no new packages were added, only
  the existing lockfile was materialized).
- `git diff --name-only` — exactly `apps/web/src/pages/PreviewPage.tsx` changed.
- Grep checks: `self-start` count 2 (className usage + explanatory comment, both ≥1 as
  required), `min(844px` count exactly 1 (only inside `frameScreenStyle` now), `frameScreenStyle`
  count exactly 3 (definition + iframe usage + placeholder usage) — matches plan spec
  exactly.
- `pnpm lint --max-warnings=0` (repo-wide) — **fails, but not due to this task.** See
  "Deviations" below.

**Task 2 (type="checkpoint:human-verify", gate="blocking") — NOT PERFORMED.**
This plan has a blocking human-verify checkpoint requiring visual confirmation in a
real browser (phone/tablet/desktop modes, tall and short windows, in-frame navigation).
This is explicitly out of scope for this executor run per the calling instructions — no
browser verification was attempted or fabricated. The checkpoint remains pending.

## Deviations from Plan

### Environment fix (not a plan deviation, but noteworthy)

**[Rule 3 - Blocking issue] Worktree had no `node_modules`.** `pnpm typecheck` failed
immediately with `'tsc' is not recognized` because this git worktree never had
dependencies installed. Ran `pnpm install --frozen-lockfile` at the repo root — this
materializes `node_modules` from the existing `pnpm-lock.yaml` with zero new packages
added (output confirmed: "downloaded 0" for all 432 resolved deps, only existing lockfile
entries were reused/linked). This is package-manager *sync from lockfile*, not an
install of a new/unverified package, so it does not fall under the "package install"
exclusion in Rule 3.

### Pre-existing, out-of-scope lint failures (logged, not fixed)

`pnpm lint --max-warnings=0` (repo-wide) fails with 76 errors / 29 warnings, entirely in
files unrelated to this task: `react/no-danger` and `jsx-a11y/media-has-caption` rule
definitions are missing (confirmed `eslint-plugin-react` and `eslint-plugin-jsx-a11y`
are not present in `node_modules` despite being referenced in `eslint.config.js`), plus
unrelated `no-explicit-any` / `no-unused-vars` findings across many component and
Convex files. **`PreviewPage.tsx` itself has zero lint errors or warnings** (verified via
targeted grep against the lint output — no matches for `PreviewPage`). This is a
pre-existing, repo-wide ESLint configuration gap unrelated to this task's changes, and
adding the missing plugin packages is excluded from auto-fix under Rule 3 (package
installs require human legitimacy verification, and this task's scope boundary
explicitly excludes fixing issues in unrelated files). Logged to
`.planning/quick/260803-kvg-phone-preview-blank-space/deferred-items.md` rather than
fixed.

None of the above required any change to `PreviewPage.tsx` beyond what the plan
specified.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data introduced.

## Threat Flags

None. This task only changed flex cross-axis sizing (`self-start`) and consolidated a
CSS style literal into a helper — no new network surface, auth path, file access, or
schema change.

## Self-Check

- `apps/web/src/pages/PreviewPage.tsx` — FOUND (modified, matches plan diff exactly).
- Commit `1945f1e` — FOUND in `git log --oneline`.

## Self-Check: PASSED

## Next Steps

**Task 2 of this plan (`checkpoint:human-verify`, gate="blocking") is still pending.**
A human (or a future execution pass with browser automation available) needs to:
1. Run `pnpm dev`, open Learner Preview for a module.
2. Maximize the window (≥1000px tall) and confirm: Phone/Tablet bezel now hugs the
   emulated screen with no dead gray band below the bottom nav; Desktop mode unchanged.
3. Confirm short-window behavior (~700px tall): frame stays ≥680px, outer page scrolls,
   no clipping.
4. Confirm in-frame navigation (Continue/Back/lesson dots) still works without the
   frame resizing or jumping.

See the plan's Task 2 `<how-to-verify>` block for full detail, including the note about
a possible *separate* residual in-iframe issue (`scormExport.ts` `.prism-card` min-height
vs. `.prism-toolbar` height mismatch at ≤560px) that would need its own follow-up task
if observed.

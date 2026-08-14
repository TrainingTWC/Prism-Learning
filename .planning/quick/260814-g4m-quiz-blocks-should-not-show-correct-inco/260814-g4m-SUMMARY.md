---
phase: quick-260814-g4m
plan: 01
subsystem: authoring
tags: [scorm, quiz, mcq, true-false, scorm-export, tdd, vitest]

requires: []
provides:
  - "Single no-reveal quiz runtime for MCQ/True-False blocks shared by Learner Preview and SCORM export"
  - "Module-wide quiz score (correct ÷ total quiz blocks) driving the completion modal and cmi.core.score.raw/lesson_status"
  - "Authoring UI with dead assessment-mode/feedback controls removed"
affects: [scorm-export, quiz-authoring, learner-preview]

tech-stack:
  added: []
  patterns:
    - "buildPreviewHtml gained an optional 5th ExportOptions param (defaulted) so preview and SCORM export share pass/fail semantics without breaking the existing 4-arg call site"
    - "Module-wide denominator (countQuizBlocks) instead of per-question submitted-count denominator, to prevent skipped questions from inflating score"

key-files:
  created:
    - apps/web/src/lib/scormExport.test.ts
  modified:
    - apps/web/src/lib/scormExport.ts
    - apps/web/src/pages/ModuleEditorPage.tsx
    - apps/web/src/components/MCQBlockEditor.tsx
    - apps/web/src/components/TrueFalseBlockEditor.tsx

key-decisions:
  - "Preview's static completion card keeps its original celebratory copy (no pass/fail title-swap) — only the score row was added, since Test 3 (no 'Not quite' string anywhere) would otherwise conflict with the fail-title copy used in the SCORM export's completion card"
  - "Stored block JSON fields (feedback, showFeedback, trueFeedback, falseFeedback, assessment) are preserved in types/defaults but no longer read anywhere, so existing authored content round-trips and the change is revertible"

patterns-established:
  - "When a plan's tests constrain exact output strings, verify new markup additions don't reintroduce a banned substring under a different code path (e.g. pass/fail title copy) before wiring it in"

requirements-completed: [QUICK-260814-g4m]

duration: 50min
completed: 2026-08-14
---

# Quick Task 260814-g4m: No-reveal quiz blocks + module-wide score Summary

**Collapsed MCQ/True-False quiz rendering to a single silent lock-in runtime in `scormExport.ts` (shared by Learner Preview and SCORM export), added a module-wide score (correct ÷ total quiz blocks, unanswered = incorrect) that drives the completion modal and `cmi.core.score.raw`/`lesson_status`, and removed the now-dead assessment-mode/feedback authoring controls.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-14T06:33:03Z
- **Tasks:** 3 (2 TDD, 1 refactor)
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- MCQ and True/False blocks now lock in the learner's answer with zero reveal — no correct/incorrect colour, no tick/cross, no per-option or true/false feedback, no "Try again" retry — in both the Learner Preview iframe and the exported SCORM package (single shared render path in `scormExport.ts`).
- Module-wide final score (`correct ÷ every quiz block in the module`, unanswered counted as incorrect) is computed once and shown as "You scored X% — C of N correct" in the completion modal, and is what SCORM's `cmi.core.score.raw`/`cmi.core.lesson_status` report — replacing the old per-question, submitted-only denominator that let skipping questions inflate the score to 100%.
- Removed the "Assessment mode" export-dialog checkbox, per-question assessment overrides, "Show feedback" toggle, and per-option/true-false feedback editors from the authoring UI, since none of them affect behaviour anymore.

## Task Commits

Each task was committed atomically (TDD tasks have separate test → feat commits):

1. **Task 1: Make the no-reveal quiz runtime the only runtime**
   - `e6ee835` test(quick-260814-g4m): add failing tests for no-reveal quiz runtime
   - `e5a932a` feat(quick-260814-g4m): make no-reveal quiz runtime the only runtime
2. **Task 2: Module-wide final score drives the completion modal and SCORM status**
   - `2eec9dd` test(quick-260814-g4m): add failing tests for module-wide quiz score
   - `f4b32e1` feat(quick-260814-g4m): module-wide quiz score drives completion + SCORM status
3. **Task 3: Remove the authoring controls that no longer do anything**
   - `03683aa` refactor(quick-260814-g4m): remove authoring controls with no remaining effect

_TDD gate sequence verified: each task's `test(...)` commit precedes its `feat(...)` commit in git log, satisfying RED → GREEN._

## Files Created/Modified
- `apps/web/src/lib/scormExport.test.ts` — new vitest suite (10 tests): no-reveal DOM assertions (Tests 1-5) and module-wide score assertions (Tests 6-10), covering both `buildPreviewHtml` and the zipped SCORM package output.
- `apps/web/src/lib/scormExport.ts` — collapsed `renderBlock`'s mcq/trueFalse cases and `buildInteractionJs`'s MCQ/TF handlers to the single silent behaviour; deleted `resolveAssess()` and `sanitizeForFeedbackAttr()`; removed now-dead CSS (`.prism-opt.correct/.wrong`, `.prism-result*`, `.prism-retry`, `.prism-opt-feedback*`, `.selected-ok/.selected-bad`, `prism-shake`/`prism-correct-pop` keyframes+classes); added `countQuizBlocks()`, `data-quiz-total` on both lesson-page and preview `<body>` tags, a `[data-prism-score]` row in both completion cards plus `.prism-complete-score` CSS, module-wide score computation in `showComplete()` and the preview's Finish handler, and removed `assessmentMode` from `ExportOptions`.
- `apps/web/src/pages/ModuleEditorPage.tsx` — removed the "Assessment mode" checkbox from the export dialog; updated pass-score helper copy.
- `apps/web/src/components/MCQBlockEditor.tsx` — removed "Show feedback" toggle, per-question assessment `<select>` + amber banner, per-option feedback disclosure + editor, and the now-unused `expandedFeedback` state / `setOptionFeedback` / `ChevronUp`/`ChevronDown` imports.
- `apps/web/src/components/TrueFalseBlockEditor.tsx` — removed the assessment `<select>` + banner and the True/False feedback fields; updated the preview-pill copy.

## Decisions Made
- Preview's completion card keeps its original static "You crushed it!" copy rather than adopting the SCORM export's pass/fail title-swap (`data-pass-title`/`data-fail-title`), because the plan's own Test 3 asserts the preview output never contains the substring "Not quite" anywhere — adding the fail-title attribute (`"Not quite there yet"`) to the preview markup would have broken that test. Only the `[data-prism-score]` row was added to preview, matching the plan's literal instruction ("writing into `[data-prism-score]`") rather than my initial over-extension that also swapped icon/title/body text.
- `ExportOptions.assessmentMode` removal was deferred to Task 3 (not folded into Task 1) to keep each task's diff scoped to exactly what its own `<action>` block specifies, per the plan's task boundaries.

## Deviations from Plan

None — plan executed as written. One self-correction during Task 2 implementation: initially mirrored the pass/fail title/body swap into `buildPreviewHtml`'s completion card (matching `buildLessonPage`'s pattern), which broke Test 3 (`not.toContain('Not quite')`); reverted to only adding the score row in preview, per the plan's literal preview-parity instruction. This was caught and fixed before committing (not a shipped defect).

## Issues Encountered
- Worktree had no `node_modules` (fresh checkout) — ran `pnpm install` at the workspace root before any test/typecheck/lint/build commands would work. Not a plan deviation, just environment setup.
- Root `pnpm lint` surfaces 105 pre-existing problems across the repo (mostly `@typescript-eslint/no-explicit-any` in unrelated files and `react/no-danger`/`jsx-a11y/media-has-caption` rule-definition errors from a broken eslint plugin config in `packages/renderer`). Verified via `git show`/line-shift comparison that none of these are new — the only match inside a file I touched (`scormExport.ts` line ~570, an escaped-quote selector in the untouched `sorting` block case) is pre-existing and out of this task's scope per the deviation rules' scope boundary.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Automated gates all green: `pnpm --filter @prism/web test` (15/15 including the 5 pre-existing fontSize tests), `pnpm typecheck`, `pnpm build`.
- **Human verification still required** per the plan's `<verification>` section before considering this shipped: manually exercise the no-reveal flow in Learner Preview (select/submit MCQ and True/False, confirm no reveal/retry, confirm free navigation with an unanswered question), then export to SCORM Cloud and confirm the gradebook score/status matches the on-screen percentage. This was not performed as part of this automated execution.

## Self-Check: PASSED

All created/modified files confirmed present on disk; all 5 task commit hashes (e6ee835, e5a932a, 2eec9dd, f4b32e1, 03683aa) confirmed in `git log`.

---
*Phase: quick-260814-g4m*
*Completed: 2026-08-14*

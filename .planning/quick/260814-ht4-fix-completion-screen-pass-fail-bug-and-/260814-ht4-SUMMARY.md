---
phase: quick-260814-ht4
plan: 01
subsystem: authoring
tags: [scorm, scorm-export, learner-preview, completion-screen, tdd, vitest, convex]

requires:
  - phase: quick-260814-g4m
    provides: "Module-wide quiz score (countQuizBlocks, __prismCorrect/__prismTotal) driving the completion modal and cmi.core.score.raw/lesson_status — this task's fail-copy trigger reuses that same score"
provides:
  - "Fail-state completion copy triggers on score < passingScore for BOTH completionCriteria values ('completed' and 'passed'), not just 'passed' — closes the reported preview screenshot bug"
  - "buildCompleteCardHtml() and buildCopySwapJs() shared helpers in scormExport.ts — one completion-card renderer and one runtime copy-swap used by both buildLessonPage (export) and buildPreviewHtml (preview), so they cannot drift apart again"
  - "Per-module completionSettings persisted on the modules table (passingScore, completionCriteria, and six author-editable copy fields) via new setCompletionSettings mutation"
  - "Export dialog authoring UI (Default/Pass/Fail title+body fields) with Save (persist only) and Export (persist then export) actions"
  - "PreviewPage now derives real ExportOptions from the module doc instead of silently defaulting to passingScore: 80 / completionCriteria: 'completed'"
affects: [scorm-export, learner-preview, module-editor, completion-screen]

tech-stack:
  added: []
  patterns:
    - "Shared markup/runtime-JS helpers (buildCompleteCardHtml, buildCopySwapJs) that both buildLessonPage and buildPreviewHtml call, instead of two hand-copied literals — the established fix pattern for scormExport.ts's export/preview parity bugs"
    - "Author-editable copy fields resolved server-side as trim() -> undefined-if-empty -> slice(maxLen), stored as an optional sub-object on the parent document, consistent with the existing styleReferenceStorageId/setStyleReference precedent"
    - "Dialog-open-time hydration (not a render effect) for ephemeral form state that mirrors a persisted doc field, to avoid clobbering mid-typing on live Convex subscription ticks"

key-files:
  created: []
  modified:
    - convex/schema.ts
    - convex/modules.ts
    - apps/web/src/lib/scormExport.ts
    - apps/web/src/lib/scormExport.test.ts
    - apps/web/src/pages/ModuleEditorPage.tsx
    - apps/web/src/pages/PreviewPage.tsx

key-decisions:
  - "copyState (pass/fail/default, drives on-screen title/body/icon/confetti) is kept as a distinct variable from statusPassed (drives only the SCORM lesson_status write) in both showComplete() and the preview finish handler, per the plan's explicit naming instruction — prevents a future reader from conflating 'what the learner sees' with 'what the LMS records'"
  - "Confetti now fires whenever copyState !== 'fail' (i.e. on 'pass' and 'default'), replacing the old passed-boolean gate that fired confetti unconditionally for 'completed'-criteria modules regardless of score — this was the second half of the reported bug (confetti under a 0% score)"
  - "Narrowed a pre-existing test's overly-broad not.toContain('Not quite') assertion (Test 3, from quick-260814-g4m) to the two specific per-question reveal strings it was written to catch ('Not quite — give it another go!', 'Not quite. '), since the new module-level 'Not quite there yet' fail title is a different, intentional string now correctly emitted into preview — this is the exact tradeoff quick-260814-g4m's own Decisions section flagged as deferred"

patterns-established:
  - "When a plan requires unifying two previously-diverged render paths, extract the emitted markup/JS into a shared function rather than editing both literals in parallel — the two cannot resync via manual diffing"

requirements-completed: [QT-260814-HT4]

duration: ~70min
completed: 2026-08-14
---

# Quick Task 260814-ht4: Fix Completion Screen Pass/Fail Bug + Authorable Copy Summary

**Unified `buildLessonPage`/`buildPreviewHtml`'s completion card into one shared renderer and one shared runtime copy-swap helper, changed the fail-copy trigger from `completionCriteria==='passed'` to `quizTotal>0 && score<passingScore` (so 'completed'-criteria modules now show fail copy), and added persisted per-module authorable title/body copy for default/pass/fail states.**

## Performance

- **Duration:** ~70 min
- **Completed:** 2026-08-14T07:45:03Z
- **Tasks:** 3 (1 plain, 1 TDD, 1 checkpoint — automated portion only)
- **Files modified:** 6

## Accomplishments
- Fixed the reported bug: a `completionCriteria: 'completed'` module with quiz blocks scoring below the pass score now shows fail-state title/body copy and a red `!` icon (with no confetti) in **both** Learner Preview and the exported SCORM package — previously the fail-copy swap was gated behind `criteria==='passed'`, so `'completed'`-criteria modules always showed "You crushed it!" regardless of score, and `buildPreviewHtml` had zero pass/fail wiring at all (this was the literal screenshot the bug was filed from).
- Persisted `modules.completionSettings` (passingScore, completionCriteria, and six copy fields — default/pass/fail × title/body) via a new `setCompletionSettings` mutation, membership-gated and mirroring the existing `setStyleReference` pattern; blank/whitespace fields are trimmed to `undefined` server-side so they fall back to stock copy, and titles/bodies are truncated (200/600 chars) rather than rejected.
- Export dialog in `ModuleEditorPage` now has a "Completion screen text" section (Default/Pass/Fail title + body, placeholders showing the current hardcoded fallback) with a new **Save** button (persist + close) alongside the existing **Export** button (now persists first, then exports, so a just-exported package and Learner Preview can never disagree).
- `PreviewPage` no longer silently defaults to `passingScore: 80, completionCriteria: 'completed'` with zero authored copy — it derives a real `ExportOptions` (with `completionCopy`) from `content.module.completionSettings` and passes it into `buildPreviewHtml`.
- `lesson_status` write behavior is byte-identical to before — still driven by `completionCriteria` alone via the renamed `statusPassed` variable, verified by a dedicated regression test.

## Task Commits

1. **Task 1: Persist completion settings on the module document**
   - `dd60642` feat(260814-ht4): persist per-module completion settings
2. **Task 2: One shared completion card + fail-copy trigger in BOTH builders**
   - `885bc63` test(260814-ht4): add failing tests for completion-screen pass/fail copy
   - `0f1d0bb` feat(260814-ht4): share one completion card + fix pass/fail copy trigger
3. **Task 3: Authoring UI + preview wiring**
   - `4b92a43` feat(260814-ht4): authoring UI for completion copy + real preview options

_TDD gate sequence verified: Task 2's `test(...)` commit (885bc63) precedes its `feat(...)` commit (0f1d0bb) in git log, satisfying RED → GREEN. 6 of the 6 new tests failed before the implementation commit (confirmed RED); all 22 tests (11 pre-existing + 11 new... see note below) pass after (confirmed GREEN)._

Note: 7 new completion-copy tests were added (Tests 11–17); combined with the 15 pre-existing tests from quick-260814-g4m (one of which — Test 3 — was narrowed, not net-new), the suite totals 22 passing tests.

## Files Created/Modified
- `convex/schema.ts` — added optional `modules.completionSettings` object (passingScore, completionCriteria, defaultTitle/Body, passTitle/Body, failTitle/Body — all sub-fields optional so every existing module doc stays valid, no migration).
- `convex/modules.ts` — new `setCompletionSettings` mutation: membership-gated (`requireMember`), trims/drops-empty/truncates (200/600 char caps) authored strings, clamps `passingScore` to 0–100, patches `updatedAt`/`lastEditedBy`.
- `apps/web/src/lib/scormExport.ts` — new `CompletionCopy` interface + `ExportOptions.completionCopy?` field; new `buildCompleteCardHtml()` (shared markup, HTML-escapes every authored string, variant-aware default body) and `buildCopySwapJs()` (shared runtime copy-swap, `copyState = quizTotal>0 ? (score>=passing?'pass':'fail') : 'default'`); both `buildLessonPage`'s literal card + `showComplete()` gate and `buildPreviewHtml`'s literal card + finish handler now call the shared helpers instead of duplicating markup/logic.
- `apps/web/src/lib/scormExport.test.ts` — 7 new tests (data-attribute presence, export/preview parity, criteria-gate removal, authored overrides, blank fallback, HTML-escaping, lesson_status regression); narrowed Test 3's `not.toContain('Not quite')` to the two specific per-question reveal strings it was originally written to catch.
- `apps/web/src/pages/ModuleEditorPage.tsx` — `setCompletionSettings` mutation wired in; `openExportDialog()` hydrates `exportOptions` (including `completionCopy`) from `content.module.completionSettings` at dialog-open time; new "Completion screen text" UI (3 title+body field pairs); `handleSaveAndClose` / `handleSaveAndExport` callbacks; Export button now persists before exporting.
- `apps/web/src/pages/PreviewPage.tsx` — new `exportOptions` memo derived from `content.module.completionSettings`, passed as `buildPreviewHtml`'s 5th argument (previously omitted entirely).

## Decisions Made
- `copyState` (on-screen pass/fail/default copy) is kept distinct from `statusPassed`/`status` (SCORM `lesson_status` write) in both runtime call sites, exactly as the plan specified, to prevent a future edit from accidentally coupling what the learner sees to what the LMS records.
- Confetti fires on `copyState !== 'fail'` rather than the old `passed` boolean — this is the mechanism that actually stops confetti from appearing under a fail-state completion card for `'completed'`-criteria modules.
- Narrowed the pre-existing overly-broad `not.toContain('Not quite')` assertion from quick-260814-g4m's Test 3, since that task's own Decisions section explicitly flagged this as a deferred tradeoff ("Preview's completion card keeps its original static copy... because Test 3 asserts the preview output never contains the substring 'Not quite'") — this task's entire purpose is to add that copy to preview, so the test needed updating to check for the actual strings it was guarding (verified via `git show` on the commit that removed per-question reveal text).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing `.env.local` in fresh worktree checkout**
- **Found during:** Task 1 verification (`npx convex codegen`)
- **Issue:** `npx convex codegen` failed with "No CONVEX_DEPLOYMENT set" — the worktree is a separate git checkout and `.env.local` (gitignored) doesn't exist there.
- **Fix:** Copied the existing `.env.local` from the main checkout (same file, same dev deployment `combative-cod-932`) into the worktree.
- **Files modified:** `.env.local` (not committed — gitignored, environment config only)
- **Verification:** `npx convex codegen` and later `npx convex dev --once` both succeeded.

**2. [Rule 3 - Blocking] Missing `node_modules` in fresh worktree checkout**
- **Found during:** Task 1 verification (`pnpm typecheck`)
- **Issue:** Fresh worktree had no installed dependencies at all.
- **Fix:** Ran `pnpm install` (existing lockfile, no new packages added — not a package-legitimacy concern under Rule 3's exclusion).
- **Files modified:** none (installs into `node_modules`, not committed).
- **Verification:** `pnpm typecheck` and later `pnpm --filter @prism/web test` both ran successfully afterward.

**3. [Rule 1 - Bug] Own bug: literal backtick in an emitted-JS comment broke the outer template literal**
- **Found during:** Task 2 implementation, first `pnpm typecheck` pass
- **Issue:** While implementing `buildCopySwapJs()`'s call site inside `showComplete()`, I wrote a `//` comment containing literal backtick characters (`` `statusPassed` ``, `` `copyState` ``) inside the *emitted* JS string, which is itself a TS template literal — the backticks terminated the outer string early, producing a TS1005/TS1443 parse error.
- **Fix:** Removed the literal backticks from the comment text (kept the words plain, no markdown-style code-formatting inside emitted-string comments).
- **Files modified:** `apps/web/src/lib/scormExport.ts`
- **Verification:** `pnpm typecheck` passed after the fix.
- **Committed in:** 0f1d0bb (part of Task 2 commit — fixed before commit, not a separate correction commit)

**4. [Rule 1 - Bug] Own bug: comment text leaked the banned `crit==='passed'` substring into emitted output**
- **Found during:** Task 2 implementation, first test run (Test 13 failing)
- **Issue:** A `//` comment inside `showComplete()`'s emitted JS literally said "no longer gated behind crit==='passed'" — since that comment is inside the returned template-literal string, the substring `crit==='passed'` ended up in the actual HTML output, failing the test that asserts the old gate is gone.
- **Fix:** Reworded the comment to avoid the literal comparison expression.
- **Files modified:** `apps/web/src/lib/scormExport.ts`
- **Verification:** Test 13 passed after the fix; full suite green.
- **Committed in:** 0f1d0bb (part of Task 2 commit)

---

**Total deviations:** 4 auto-fixed (2 blocking/environment, 2 self-caught bugs before commit)
**Impact on plan:** All four were necessary to complete the plan as written in a fresh worktree; none represent scope creep or plan deviation in behavior. Items 3–4 were caught by typecheck/tests before any commit, so no defective code was ever committed.

## Issues Encountered
- `pnpm lint` surfaces ~105 pre-existing problems repo-wide (mostly `@typescript-eslint/no-explicit-any` in unrelated files and `react/no-danger`/`jsx-a11y/media-has-caption` rule-definition errors from a broken eslint plugin config in `packages/renderer`, plus two pre-existing `no-useless-escape` warnings in `scormExport.ts`'s untouched sorting-block code). Verified via `git show <base-commit>:apps/web/src/lib/scormExport.ts | grep -c prism-sort-check` that the one match inside a file I touched predates this task and is outside the diff. None of these are new; none are in `ModuleEditorPage.tsx` or `PreviewPage.tsx`, which lint clean.
- No other issues — implementation matched the plan's interfaces (line numbers had shifted slightly from Task 1's schema edits by the time Task 2/3 started; re-located by function/attribute name as instructed).

## User Setup Required
None — no external service configuration required. Schema + mutation already pushed to the dev Convex deployment via `npx convex dev --once`.

## Next Phase Readiness
- Automated gates all green: `pnpm --filter @prism/web test` (22/22), `pnpm typecheck` (clean across all 3 typechecked workspace projects), `pnpm build` (succeeds, pre-existing chunk-size warnings unrelated to this task), `npx convex dev --once` (schema pushed without migration error).
- **Human verification still required — Task 3's checkpoint (`gate="blocking"`) was not exercised on-screen.** This was executed autonomously with no human present; per execution instructions, the automated verification steps were completed and the manual on-screen check is recorded here as still-pending rather than blocking the run. Specifically still needed:
  1. Open a module with ≥2 quiz blocks, set Pass score 80 / criteria "Learner reaches the final lesson" (`'completed'`), type distinctive Fail title/body, click Save, reload, reopen dialog — confirm Fail text persisted.
  2. Learner Preview → answer every quiz question wrong → Finish. Expect the authored Fail title/body, red `!` icon, NO confetti, and the score row reading "You scored 0% — 0 of N correct". This is the exact screenshot the bug was filed from.
  3. Answer all correctly → Finish → expect Pass copy, green ✓, confetti.
  4. Clear Fail title back to blank, Save, re-run step 2 → expect stock "Not quite there yet".
  5. Export the SCORM zip, open `lesson_N.html` (or SCORM Cloud) → confirm identical fail copy to preview, and the LMS still records the module per the chosen criteria.

## Self-Check: PASSED

All 6 modified files confirmed present on disk (`convex/schema.ts`, `convex/modules.ts`, `apps/web/src/lib/scormExport.ts`, `apps/web/src/lib/scormExport.test.ts`, `apps/web/src/pages/ModuleEditorPage.tsx`, `apps/web/src/pages/PreviewPage.tsx`). All 4 task commit hashes (dd60642, 885bc63, 0f1d0bb, 4b92a43) confirmed in `git log --oneline --all`.

---
*Phase: quick-260814-ht4*
*Completed: 2026-08-14*

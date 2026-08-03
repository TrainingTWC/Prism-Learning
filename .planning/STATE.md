# Prism Authoring — Project State

> Living memory across sessions. Updated after every phase transition and at session boundaries.

---

## Project Reference

**Name:** Prism Authoring (learnflow)
**Repository:** `C:\Users\Amritanshu\projects\learnflow`
**Milestone:** v1.1 — Authoring & SCORM Bug Fix Sprint

**Core Value:**
> A team author can sit down, build a themed, multi-block lesson collaboratively in realtime, and export a working SCORM 1.2 zip that runs in their LMS — without writing code, fighting layout, or installing anything.

**Locked Stack:** Vite + React SPA · Cloudflare Pages (host) · Convex (auth/DB/realtime/functions) · Cloudflare R2 (assets, export zips) · Cloudflare Workers (presign + SCORM zip) · Tiptap (rich text) · magic-link auth · SCORM 1.2 export.

---

## Current Position

**Phase:** — (none active — requirements defined)
**Plan:** —
**Status:** Defining requirements for v1.1 bug fix sprint
**Progress:** ░░░░░░░░░░ 0% (0/1 phases complete)

**Next action:** `/gsd-plan-phase 9` (Critical Bug Fixes).

---

## Performance Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Phases complete | 8 | 0 |
| v1 REQs delivered | 73 | 0 |
| SCORM Cloud validation | passing | — |
| Export time (typical module) | < 30s | — |

---

## Accumulated Context

### Key Decisions (from research, binding for v1)

- **Renderer purity boundary** — `@prism/renderer` is pure React, zero I/O, dependency-injected `resolveAsset` + `theme`. Enforced by ESLint `no-restricted-imports`. (Architecture's load-bearing wall.)
- **Realtime sync** — per-block, per-field last-writer-wins via Convex reactive queries + optimistic concurrency + "undo your overwrite?" toast. NOT Y.js for v1. Revisit at Phase 3.
- **Asset pipeline** — Convex authorizes → Worker presigns → browser PUTs direct to R2. Bytes never traverse Convex. Two-phase (`pending` → `ready`) with hourly reaper for orphans.
- **SCORM export** — Worker-side streaming zip via `fflate`, NOT client JSZip. Workers Standard plan required.
- **One Convex document per block** — Convex's 1MB doc cap forces this from day one.
- **Theme baked at export time** — append-only theme versions; exports reference a frozen version for reproducibility.
- **SCORM Cloud validation as CI gate** — automated, not manual.

### Open Decisions (to resolve at the phase that needs them)

1. **Per-field LWW vs. Y.js for rich text** — Position A (LWW) is the default; revisit Phase 3 after 3-tab dogfooding.
2. **Target LMS(s) beyond SCORM Cloud** — must be named before Phase 8.
3. **Worker plan tier** — Workers Standard/Unbound for SCORM export — confirm before Phase 8 ($).
4. **Fractional ordering migration trigger** — defer; ship `order: v.number()` in Phase 3.

### Todos / Blockers

- [ ] Phase 1 prerequisite: provision Cloudflare account + R2 + Workers project (manual, one-time).
- [ ] Phase 1 prerequisite: Resend (or equivalent) API key for magic-link email delivery.
- [ ] Before Phase 8: name target commercial LMS(s) for cross-LMS validation.
- [ ] Once `authoring.prismintelligence.in` custom domain is live: run `npx convex env set SITE_URL https://authoring.prismintelligence.in --prod` — magic links and invite links are still built from the old `learning.prismintelligence.in`.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260707-gtl | Rich-text captions (image/gallery) + per-character font size in all Tiptap surfaces, preview + SCORM render | 2026-07-07 | 5ef77c0 | [260707-gtl-rich-text-captions-with-per-character-fo](./quick/260707-gtl-rich-text-captions-with-per-character-fo/) |
| 260707-hbg | Rich text + font size for accordion/callout/quote/flashcard/process bodies and MCQ/TrueFalse quiz text, preview + SCORM render | 2026-07-07 | c07dc82 | [260707-hbg-convert-remaining-text-surfaces-to-rich-](./quick/260707-hbg-convert-remaining-text-surfaces-to-rich-/) |
| 260710-eyl | Rename app "Prism Learning" → "Prism Authoring" (UI, emails, package.json, docs) | 2026-07-10 | TBD | [260710-eyl-rename-prism-authoring](./quick/260710-eyl-rename-prism-authoring/) |
| 260720-fe0 | Fix hotspot popover overflow (pin to bottom) + MCQ selection marker (neutral pre-submit fill, gate correctness reveal behind submit) in learner-preview renderers | 2026-07-20 | 3bc5954 | [260720-fe0-fix-hotspot-popover-overflow-and-mcq-sel](./quick/260720-fe0-fix-hotspot-popover-overflow-and-mcq-sel/) |
| fast | Same hotspot popover + MCQ marker fixes applied to the ACTUAL render path (scormExport.ts buildPreviewHtml/buildLessonPage — preview iframe + SCORM export); 260720-fe0 had edited the unused packages/renderer by mistake | 2026-07-20 | 269aa80 | — |
| 260723-b2g | Fix CSS leakage from custom-html blocks: Shadow DOM isolation in both React renderer (CustomHtmlBlockRenderer.tsx) and SCORM/preview export (scormExport.ts) — pasted `<style>` in a custom-html block no longer overrides lesson title/theme fonts elsewhere on the page. Human verification of the fix still pending (blocking checkpoint). | 2026-07-23 | fb0de00, 4cc5f31 | [260723-b2g-fix-css-leakage-from-custom-html-blocks-](./quick/260723-b2g-fix-css-leakage-from-custom-html-blocks-/) |
| fast | Fix accordion per-section images/audio never rendering: AccordionBlockEditor saved imageStorageId/audioStorageId but no consumer existed. Mirrored the tabs implementation in scormExport.ts (renderBlock accordion case + .prism-acc-img CSS + buildScormPackage storageId collection), PreviewPage.extractStorageIds (added p.sections branch — the actual preview gap), and packages/renderer AccordionBlockRenderer/Module for parity. Human verification pending. | 2026-07-27 | 685327c, fa2cf71 | — |
| fast | Quiz import into the module builder, so quiz results flow to the LMS via SCORM instead of being invisible behind an external PI guest link. `analytics.listPIPrograms` action returns full PI checklist definitions (sections + questions + options, which `programs:list` already carries — the analytics path only consumed section titles/scores); `blocks.addMany` bulk-inserts pre-filled mcq/trueFalse blocks (max 200). New `lib/quizCsv.ts`: dependency-free RFC-4180 CSV reader, quiz-CSV parser with per-row error reporting, sample-template builder + download, and PI→MCQ conversion (drops N/A options, picks highest-scoring option as correct where PI supplies scores, else the affirmative answer, flagging guesses for review; TEXT questions skipped as unscoreable). New `ImportQuizDialog` (Intelligence + CSV tabs, section picker, preview, template download) wired into ModuleEditorPage's block library. Verified round-trip + edge cases via a throwaway node script. Deployed to prod Convex. Human verification pending. | 2026-07-28 | pending | — |
| fast | Data-analysis control panel for AI suggestions. Backend: new `analysisProfiles` table (named reusable configs — program selection, explicit from/to window or rolling lookback, benchmark, severity thresholds, minSubmissions, dimensions, isDefault); `computeGaps` takes `profileId` and/or inline `overrides` (precedence overrides > profile > link defaults) and now honours program filter, date window, configurable severity cutoffs (was hardcoded 25/15/8/2), min submission count and selectable dimensions; `generateRecommendations` builds an inventory of existing workspace modules + lesson titles, feeds it to the model, and persists `kind`/`extendsModuleId`/`coverageNote` so the AI dedupes and proposes extensions (hallucinated indices degrade to 'new'). UI: new `AnalysisControlPanel` mounted in IntelligenceDashboardPage with profile load/save/delete/default. Deployed to prod Convex. Human verification pending. | 2026-07-27 | pending | — |
| fast | Revert custom-html Shadow DOM isolation (undoes 260723-b2g / fb0de00 + 4cc5f31) back to light-DOM mounting in scormExport.ts and CustomHtmlBlockRenderer.tsx. Shadow roots hide nodes from the author's own `document.getElementById`/`querySelector` calls (8–13 per block in real content) and inline `on*=` handlers resolve against global scope, so every scripted widget rendered only its static markup. User chose script compatibility over style isolation after being shown the trade-off; **the CSS-leakage bug from 260723-b2g is knowingly reinstated**. Sandboxed-iframe rendering was offered as the fix that preserves both and was declined for now. | 2026-07-27 | pending | — |
| fast | Add workspace rename UI: `workspaces.rename` (owner-only) already existed in Convex but nothing called it, so names were permanent once set. DashboardPage now shows a pencil affordance on owner-role workspace cards that swaps the card into an inline rename form (Enter saves, Esc/X cancels); the mutation additionally rejects empty/whitespace names. | 2026-07-27 | pending | — |
| fast | "Recently deleted" workspace recovery + real 7-day auto-purge, on top of the soft-delete added earlier. New `workspaces.by_deletedAt` index; `listDeleted` (owner-scoped, reuses the listMine membership-scan pattern rather than a table scan); `restore` (owner-only, clears deletedAt); `purgeExpiredWorkspaces` internalMutation that cascades a real hard-delete (memberships, pendingInvites, modules→lessons→blocks→presence, analyticsLinks, analysisProfiles, trainingGaps, courseRecommendations — notifications intentionally skipped, no by_workspace index and a stale reference is harmless) for one workspace past the 7-day window, self-rescheduling via ctx.scheduler to drain any backlog same-day; new convex/crons.ts runs it every 24h as the fallback tick. Does NOT delete R2/storage blobs referenced by block content — no deletion path in this app does that today; flagged as a known gap, not silently scoped in. DashboardPage: "Recently deleted" section (owner-only, only rendered when non-empty) shows each entry's deleted-date and "N days left", with a Restore button. Deployed to prod Convex (new index confirmed via function-spec — listDeleted/restore/purgeExpiredWorkspaces all present). Human verification pending — in particular the purge cascade has NOT been exercised end-to-end against a real deleted workspace yet, only reviewed. | 2026-07-31 | pending | — |
| fast | Add workspace deletion (there was previously no way to delete a workspace at all — only rename existed). Soft-delete only, mirroring modules.deletedAt: `workspaces.remove` (owner-only, server re-verifies a typed confirmName matches the workspace's current name — not just a client-side gate) sets `deletedAt`; `listMine`/`getById` now filter it out. Underlying modules/memberships/analytics tables are deliberately NOT cascade-deleted — recoverable by direct DB access if a workspace is deleted by mistake, unlike a hard cascade which risks partial-failure orphaning across 7+ workspace-scoped tables. DashboardPage: trash icon next to rename (owner-only), opens a type-the-workspace-name-to-confirm modal, portaled to document.body (same fixed-overlay pattern as the move-to-workspace dialog and the e700013 dropdown fix — avoids the same stacking-context trap). Deployed to prod Convex (schema + mutation). Human verification pending. | 2026-07-31 | pending | — |
| fast | Fix module row "..." dropdown (Rename/Duplicate/Move to workspace/Delete) rendering behind/overlapping sibling rows in ModuleListPage. Same root cause as 5326474 (Move-to-workspace dialog): the row is a `.widget`, and `.widget:hover` applies a `transform`, which makes the hovered row a new stacking context — the menu's `position: absolute` + `z-50` was trapped inside it and got painted over by later sibling rows regardless of z-index. Replaced the CSS-relative dropdown with the same getBoundingClientRect + createPortal(document.body) pattern already used by ModuleEditorPage's BlockTypeBtn tooltip and the move-to-workspace dialog: menu position is computed from the button's rect and rendered as `position: fixed` directly under `<body>`, plus a full-screen backdrop and a scroll/resize listener that closes it rather than let it drift off the button. Verified with typecheck, lint, and a production build. Human verification pending. | 2026-07-31 | pending | — |
| fast | Rebrand app icon from user-supplied "Prism Authoring Logo.png" (opaque black canvas, no alpha). Chroma-keyed pure-black to transparent for the in-app mark (apps/web/public/prism-logo.png — used by PrismWorkspaceShell header, SignInPage, and scormExport's SCORM-package brand logo), regenerated as a square (512x512) transparent canvas since consumers render it in fixed-square CSS boxes (Tailwind size-8/size-14) that would otherwise stretch a non-square image. Added favicon-32/48.png (transparent), apple-touch-icon.png (180x180, opaque black per Apple HIG — iOS renders transparency inconsistently), android-chrome-192/512.png (transparent, manifest purpose "any"), maskable-icon-512.png (opaque, logo confined to a safe zone so circular/squircle Android masks don't clip it), and a new manifest.webmanifest (no PWA manifest existed before — this is what actually drives the Android/desktop "Add to Home Screen"/install icon, not just the favicon link) with theme_color/background_color matched to the app's actual --ember-400/--bg-primary CSS vars. index.html wired to all of the above. Generated with sharp (installed ad-hoc in scratchpad, not added to package.json). Verified via `pnpm build` — dist/ contains and correctly references every new asset. | 2026-07-30 | pending | — |
| fast | Assessment mode for quiz blocks: MCQ/True-False can now run as true assessments — answer is locked in on submit with zero reveal (no correct/wrong colour, no marker, no feedback text, no retry), scored silently, and the course reports SCORM `passed`/`incomplete` (not `failed`, so most LMSs let the learner re-enter) against the export dialog's pass score. Module-level "Assessment mode" toggle in the export dialog + per-block override dropdown (MCQBlockEditor/TrueFalseBlockEditor) resolved via `resolveAssess()`. Fixed two correctness bugs found while building this: (1) teaching-mode retry previously double-counted `__prismTotal` on every resubmission, now uses a counted/countedCorrect delta so retries adjust the score instead of inflating the denominator; (2) quiz score reset to 0 on every lesson page navigation (each lesson is a full page load) — now persisted via sessionStorage across the attempt and cleared when lesson_0 loads (the only real entry point, no SCORM resume/bookmark exists). Completion modal now shows distinct pass/fail wording (score-gated modules only) and only fires confetti on pass; the numeric score still reaches the LMS gradebook via cmi.core.score.raw even though the on-screen modal is pass/fail-only per user's choice. Verified via a headless harness (buildPreviewHtml + buildScormPackage + JSZip) checking data-assessment resolution, retry suppression, sessionStorage reset, and runtime JS syntax — not a live browser/LMS test. Human verification pending. | 2026-07-28 | pending | — |
| fast | Make accordion section titles rich-text formattable (bold/italic/colour/font-size) instead of a plain `<input>`: AccordionBlockEditor now edits the title via the shared InlineRichText (single-line mode) inside the expanded panel, with a styled read-only title preview in the collapsed header row. Title now renders as sanitized inline HTML in AccordionBlockRenderer and in scormExport's accordion case (`sanitizeInlineHtml` replacing `escapeHtml`), plus `.prism-acc-title` flex CSS to keep the ▼ arrow right-aligned. Human verification pending. | 2026-07-27 | pending | — |
| 260730-gzv | Add "Move to workspace" for modules: new `modules.move` mutation checks membership (`requireMember`, no owner gating) on both the source and destination workspace, rejects a same-workspace no-op, then patches `workspaceId`/`updatedAt`/`lastEditedBy`. ModuleListPage dropdown gets a "Move to workspace" item opening a picker (reusing `workspaces.listMine`) listing the user's other workspaces; any member — owner or editor — can move a module into any other workspace they belong to, not just workspace owners. Deployed to prod Convex + pushed to master. Follow-up fix (5326474): the picker dialog used a plain `fixed inset-0` div, which `.prism-shell-inner`'s `animate-fadeInUp` (forwards fill-mode leaves a non-`none` transform) trapped as a containing block, confining the overlay to the content area instead of the viewport — user screenshotted the broken layout. Fixed by portaling to `document.body`, matching the existing AnalyticsPage/IntelligenceDashboardPage modal pattern. Typechecks clean. Human verification pending. | 2026-07-30 | a135e6c, 517343a, 5326474 | [260730-gzv-add-move-module-to-workspace-feature-con](./quick/260730-gzv-add-move-module-to-workspace-feature-con/) |
| 260803-f15 | Fix matching ("match the following") block overflowing its card in learner preview at phone width — `.prism-mt-cols` grid columns couldn't shrink below content, term label had `flex-shrink:0`, no `overflow-wrap` anywhere. Grid now `auto-fit`s to one column under ~500px, term/slot/definition text wraps. Also added tap-to-select-then-tap-to-place as a touch alternative to HTML5 drag (which never fires on touch, leaving the block uncompletable on the phone viewport being previewed). Fixed in `scormExport.ts` (actual preview/export render path) and mirrored in `packages/renderer/MatchingBlockRenderer.tsx`. Typechecks clean on both packages. Human verification of the visual fix pending. | 2026-08-03 | ea71e30 | [260803-f15-fix-matching-block-responsive-layout-and](./quick/260803-f15-fix-matching-block-responsive-layout-and/) |

---

## Phase History

(None complete yet.)

---

## Session Continuity

**Last session ended:** 2026-05-27 — roadmap created and committed.
**Last activity:** 2026-08-03 - Completed quick task 260803-f15: fixed matching block responsive layout overflow + added tap-to-place for touch devices (pending human verification of the fix).
**Resume with:** `/gsd-plan-phase 1` (or `/gsd-ui-phase 1` for the sign-in UI design first).

**Files just created/updated:**
- `.planning/ROADMAP.md` (created)
- `.planning/STATE.md` (created)
- `.planning/REQUIREMENTS.md` (Traceability section filled)

---

*Last updated: 2026-05-27 by /gsd-roadmapper*

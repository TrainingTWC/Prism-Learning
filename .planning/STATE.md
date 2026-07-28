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
| fast | Make accordion section titles rich-text formattable (bold/italic/colour/font-size) instead of a plain `<input>`: AccordionBlockEditor now edits the title via the shared InlineRichText (single-line mode) inside the expanded panel, with a styled read-only title preview in the collapsed header row. Title now renders as sanitized inline HTML in AccordionBlockRenderer and in scormExport's accordion case (`sanitizeInlineHtml` replacing `escapeHtml`), plus `.prism-acc-title` flex CSS to keep the ▼ arrow right-aligned. Human verification pending. | 2026-07-27 | pending | — |

---

## Phase History

(None complete yet.)

---

## Session Continuity

**Last session ended:** 2026-05-27 — roadmap created and committed.
**Last activity:** 2026-07-23 - Completed quick task 260723-b2g: shadow-DOM isolation for custom-html blocks to stop pasted CSS leaking into lesson title/theme fonts (pending human verification of the fix).
**Resume with:** `/gsd-plan-phase 1` (or `/gsd-ui-phase 1` for the sign-in UI design first).

**Files just created/updated:**
- `.planning/ROADMAP.md` (created)
- `.planning/STATE.md` (created)
- `.planning/REQUIREMENTS.md` (Traceability section filled)

---

*Last updated: 2026-05-27 by /gsd-roadmapper*

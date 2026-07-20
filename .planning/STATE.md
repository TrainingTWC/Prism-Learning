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

---

## Phase History

(None complete yet.)

---

## Session Continuity

**Last session ended:** 2026-05-27 — roadmap created and committed.
**Last activity:** 2026-07-20 - Completed quick task 260720-fe0: fixed hotspot popover overflow and MCQ selection marker in learner-preview renderers.
**Resume with:** `/gsd-plan-phase 1` (or `/gsd-ui-phase 1` for the sign-in UI design first).

**Files just created/updated:**
- `.planning/ROADMAP.md` (created)
- `.planning/STATE.md` (created)
- `.planning/REQUIREMENTS.md` (Traceability section filled)

---

*Last updated: 2026-05-27 by /gsd-roadmapper*

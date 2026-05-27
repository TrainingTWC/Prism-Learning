# Project Research Summary

**Project:** Prism Learning (learnflow)
**Domain:** Rise-360-style block-based learning module authoring tool with realtime co-edit and SCORM 1.2 export
**Researched:** 2026-05-27
**Confidence:** HIGH

## Executive Summary

Prism Learning is a small-team, opinionated Rise-360 alternative: a Vite + React SPA on Cloudflare Pages, backed by Convex (auth, DB, realtime, functions), with Cloudflare R2 for asset bytes and a Cloudflare Worker for SCORM zip assembly. The recommended approach is to lock the renderer as a pure, I/O-free shared package (`@prism/renderer`) consumed by BOTH the authoring SPA and the bundled SCORM runtime — this is the single architectural decision that makes "theme everywhere" and "preview matches export" tractable. Tiptap (v3) handles rich text per block; presence + realtime are Convex reactive queries; quizzes drive SCORM 1.2 `cmi.core.*` via a `scorm-again`-based runtime adapter shipped inside every export zip.

The biggest risks cluster in three places: (1) the **realtime sync strategy** — the stack research and architecture both recommend Convex reactive queries with per-block, field-scoped LWW (no Y.js), while the pitfalls research flags this as a known trap, so this remains an Open Decision (see below); (2) **SCORM correctness across LMSs** — manifest validity, API discovery, `lesson_status`/score normalization, and self-contained assets/fonts are all easy to get subtly wrong in ways that only appear in production LMSs, so SCORM Cloud validation must be an automated gate, not a manual step; (3) **Convex limits** — the 1MB document size cap and N+1 subscription patterns force "one Convex document per block" + a single aggregate query per editor view from day one.

Mitigations are well-understood: enforce renderer purity with ESLint `no-restricted-imports`, scope LWW to the smallest field (block + sub-field), normalize quiz scores to 0–100 in a single helper, self-host subsetted fonts inside the export zip, two-phase R2 upload with a scheduled reaper, and Worker-side streaming zip via `fflate`. If any of these slip, v1 is not v1.

## Key Findings

### Recommended Stack

Detailed in [.planning/research/STACK.md](.planning/research/STACK.md). The locked layers (Vite + React 19, Convex, Cloudflare Pages/Workers/R2, magic-link, SCORM 1.2) are surrounded by a small, opinionated set of well-trodden libraries. Confidence is HIGH for every recommendation except auth library version (Convex Auth is in beta — accepted because magic-link is its most stable surface).

**Core technologies:**
- **`@tiptap/react` v3.x + `@tiptap/starter-kit`** — per-block rich-text editing (ProseMirror under the hood); locked by PROJECT.md
- **`@dnd-kit/core` 6.x stable + `@dnd-kit/sortable`** — accessible drag-reorder for blocks and lessons; do NOT use the pre-1.0 `@dnd-kit/react` v0.4 rewrite
- **`scorm-again` v3.x (`scorm-again/scorm12/min`)** — modern, typed, maintained SCORM 1.2 + 2004 runtime API shipped INTO each export zip
- **`jszip` (client) OR `fflate` (Worker)** — recommended: Worker-side `fflate` streaming for export assembly (architecture overrides STACK.md's "client-side for v1" suggestion)
- **`@lottiefiles/dotlottie-react`** — WASM-backed Lottie playback; faster + smaller than legacy `lottie-web`
- **Tailwind v4 + shadcn/ui + Radix primitives + lucide-react** — themable via CSS variables, source-copied components (no runtime bloat)
- **`@convex-dev/auth`** (magic-link provider) + **Resend** for transactional email
- **`@tanstack/react-router`** — typed routes, typed search params (acceptable fallback: `react-router` v7 declarative mode)
- **`zustand`** for ephemeral UI state only; Convex hooks ARE the server-state layer (do not duplicate)
- **`react-hook-form` + `zod` + `@hookform/resolvers`** — share zod schemas between forms and Convex `args` validators
- **Vitest + Testing Library + Playwright + `convex-test` + MSW** — full test stack

**Explicit "do not use":** `lottie-web` classic, `react-beautiful-dnd` (deprecated), `pipwerks` (legacy — but see Pitfall #1 caveat: pipwerks is still recommended for API *discovery* logic), Next.js / `@tanstack/start` (SSR — breaks static SPA constraint), MUI/Chakra/Mantine (heavy, hard to theme deeply), Convex storage for large assets, Y.js for v1 (contested — see Open Decision).

### Expected Features

Detailed in [.planning/research/FEATURES.md](.planning/research/FEATURES.md). Confidence is HIGH — Rise 360, Storyline, Captivate, iSpring feature sets are well-documented and SCORM 1.2 is a 2001-stable spec.

**Must have (table stakes — PROJECT.md Active list):**
- Magic-link auth + workspace + member invite by email
- Module / lesson / block CRUD with drag-reorder
- 7 block types: rich text, image+caption, video embed (YT/Vimeo), MCQ, T/F, accordion, Lottie
- Realtime sync + presence (sub-second, no silent overwrites)
- Workspace theme (primary, accent, heading font, body font, logo) applying to BOTH authoring preview and SCORM export
- Learner preview mode (in-app, full-screen)
- SCORM 1.2 zip export passing SCORM Cloud validation
- Quiz score → SCORM API (`cmi.core.score.*`, `lesson_status`, `session_time`)
- Mobile-responsive learner output
- Accessibility minimums: mandatory image alt text, AA contrast warning, keyboard nav, semantic HTML

**Should have (differentiators vs. Rise 360):**
- True realtime co-edit (Figma/Docs-grade, not Rise's lag-prone "co-authoring")
- Theme-everywhere with NO per-block color/font overrides (prevents brand drift — Rise's worst failure mode)
- Fast SCORM export (target <10s vs. Rise's 60–180s)
- Lottie as a first-class block (Rise has no native equivalent)
- Magic-link-only auth (Rise/Articulate require paid per-seat accounts)
- Opinionated narrow block set (7, not 40) — positioning differentiator

**Defer (v2+, explicitly anti-features in v1):**
- Audio/narration, video upload (host our own), drag-and-drop interactions, flip cards, custom animation timeline, SCORM 2004 / xAPI, branching/approval workflow, multi-tenant SaaS, mobile authoring, offline authoring, comments/mentions, version history, templates marketplace, multi-correct MCQ, AI authoring assist, learner analytics dashboard, per-block theme overrides, custom HTML embed (security risk).

### Architecture Approach

Detailed in [.planning/research/ARCHITECTURE.md](.planning/research/ARCHITECTURE.md). Confidence HIGH — derives directly from locked stack constraints.

**Major components:**
1. **Authoring SPA (`apps/web`)** — Vite+React, owns Tiptap editor instance, optimistic edits, theme variable injection, presence rendering. Does NOT own persistence or asset bytes.
2. **`@prism/renderer` package (load-bearing wall)** — pure React, no Convex, no fetch, no auth. Maps `Block[] + Theme` to DOM. Consumed by BOTH authoring preview and SCORM runtime. Purity enforced by ESLint `no-restricted-imports`.
3. **`apps/scorm-runtime` bundle** — bootstraps `<Module>` from `module.json` in the exported zip; includes `scorm-api.ts` adapter that calls `window.parent.API.LMSSetValue` etc.
4. **`@prism/scorm` package** — `imsmanifest.xml` builder, SCORM 1.2 validators.
5. **Convex** — auth, schema (workspaces, users, memberships, modules, lessons, blocks, assets, exports, presence), reactive queries, mutations with optimistic concurrency, server-orchestrated export action that calls the Worker.
6. **Cloudflare R2** — authoritative bytes (assets + export zips). Private bucket, signed PUT for uploads (5-min TTL), Worker proxy or signed GET for reads (15-min TTL).
7. **Cloudflare Worker (`workers/export`)** — three routes: (a) `/presign` mints R2 PUT URLs after Convex authorizes, (b) `/export` builds the SCORM zip (streams R2 → fflate → R2), (c) optional R2 event webhook → Convex to mark `pending` assets as `ready`.

**Critical seams (where bugs live):**
- SPA ↔ Convex (Tiptap doc ↔ Convex `blocks` row) — single highest-risk seam; see Open Decision below.
- SPA ↔ R2 — bytes must never traverse Convex.
- Renderer purity boundary — break it and the SCORM export breaks.
- Theme tokens — one source of truth (`@prism/renderer/theme.ts`) drives both runtime CSS variables and baked `theme.css` in the export.

**Data model highlights:**
- One Convex document per block (NOT one document per module) — forced by Convex's 1MB doc limit.
- Block `order: v.number()` is fine to start; plan to migrate to fractional-index strings (lexorank / `fracdex`) at the first reorder conflict.
- `assets.status: "pending" | "ready" | "failed"` enables optimistic block-renders with spinners.
- `exports.moduleSnapshot` is a frozen JSON of module-at-export-time for audit + reproducibility.

### Critical Pitfalls

Detailed in [.planning/research/PITFALLS.md](.planning/research/PITFALLS.md) (30 pitfalls). Confidence HIGH for SCORM/Tiptap/Cloudflare specifics; MEDIUM for Convex limits (verify at plan time — platform evolves).

1. **SCORM `API` discovery** (#1) — naive `window.parent.API` check fails in nested-iframe LMSs (Moodle, Cornerstone). Use the full bidirectional pilfer algorithm from SCORM 1.2 §3.3.6.1, ideally via pipwerks's reference implementation. Validate in SCORM Cloud AND a real LMS.
2. **Missing `LMSCommit` / `LMSFinish`** (#2) — call `LMSCommit` after every meaningful state change; `LMSFinish` on `pagehide` (mobile-safe), NOT `beforeunload`. Check return string `"true"`/`"false"`.
3. **Score reported as raw points** (#4) — `score.raw` must be normalized to 0–100; single `reportScore(correct, total)` helper used everywhere.
4. **Tiptap + Convex without Y.js → silent overwrites** (#6) — see Open Decision below. Mitigation: per-block subscription, never replace whole-doc state on remote update, debounce writes, field-scoped LWW, and a "conflict detected → undo?" toast.
5. **Convex 1MB document size limit** (#16) — never embed assets or full module content in one row; one document per block, validate write size, asset bytes always to R2.
6. **Orphaned R2 uploads** (#8) — two-phase upload (`pending_uploads` → `commitUpload`) + scheduled reaper (hourly) deleting pending rows >1h old.
7. **Theme tokens don't reach export** (#11) — one shared renderer + baked `theme.css` + self-hosted subsetted fonts inside the zip; never reference Google Fonts CDN from the export.
8. **Magic-link replay / TTL** (#22, #23) — 15-min TTL, single-use, rate-limited send, reactive "check your email" page that signs in the original browser when the link is consumed anywhere. Use `@convex-dev/auth`, do not roll your own.
9. **Editor lag past ~100 blocks** (#24) — virtualize with `@tanstack/react-virtual` from day one, memoize blocks, lazy-mount Tiptap for off-screen blocks.
10. **Worker bundle bloat / Node API leaks** (#19) — Web Standard APIs only; `fflate` not JSZip in Workers; CI gate on bundle size.

## Open Decisions

### Realtime Sync: Per-block field-scoped LWW (no Y.js) vs. Y.js + Tiptap Collaboration

**Status:** Open. Must be resolved BEFORE the block CRUD phase (Phase 3 in suggested ordering) because retrofitting Y.js after block schemas are finalized is painful.

**Position A — Convex reactive queries + per-block, field-scoped LWW (no Y.js)** *(recommended by STACK.md and ARCHITECTURE.md)*
- Mount one Tiptap instance per rich-text block. `onUpdate` debounced ~300ms → Convex mutation with `baseUpdatedAt` for optimistic concurrency.
- Reactive query pushes remote updates; UI replaces content only when the user is NOT focused on that block; if focused, queue until blur.
- Field-scoped mutations (e.g., `updateQuizChoice`) — different fields don't collide.
- "Conflict detected → undo your overwrite?" toast satisfies "never silently overwrite".
- No second realtime subsystem (Convex IS the transport); no hosted Y.js provider needed; no per-block Y.Doc state ballooning.
- **Tradeoff:** two authors typing in the same paragraph within the 300ms debounce window produces one winner; the losing edit is preserved in the toast for one-click restore.

**Position B — Y.js + `@tiptap/extension-collaboration` + custom Convex transport** *(recommended by PITFALLS.md #6)*
- Y.js is the right answer for character-level concurrent editing with multi-author cursors and per-user undo.
- Tiptap+Convex without Y.js is flagged as a known trap (silent overwrites, cursor jumping, undo crossing users).
- **Tradeoff:** there is no first-party Convex Y.js provider — building one means re-implementing an awareness/sync protocol on top of a system that already has reactive sync. Adds two non-trivial subsystems on the v1 critical path.

**Recommended default: Position A**, conditional on the per-block + per-field scope being followed strictly:
- The pitfalls research's warning (#6) is correct *for document-scoped LWW*. The architecture's mitigation is to **scope LWW to a single paragraph or single field**, so the "silently overwrite a whole document" failure mode never has a chance to occur.
- LWW becomes safer as the edit unit shrinks; per-block + per-field LWW with a conflict-toast is materially different from "store doc JSON in Convex, subscribe, replace on change" (which is what Pitfall #6 describes).
- This matches PROJECT.md's explicit acceptance: *"edits never silently overwrite each other (last-writer-wins is acceptable per-field if cleanly scoped)"*.
- The upgrade path is preserved: block-level boundaries mean Y.js can be retrofit *per rich-text block* later without re-architecting — only the rich-text block's data layer swaps.

**Revisit at:** the start of the realtime-collab phase (and again if pitfall #6's warning signs appear during dogfooding — cursor jumping, lost keystrokes, undo crossing users). If real co-edit usage produces the failure modes Pitfall #6 describes, switch to Y.js *for the rich-text block only*; everything else stays on per-field LWW.

## Implications for Roadmap

Suggested phase structure derives from the architecture's dependency graph (Phase 2 — renderer skeleton — before Phase 3 — block CRUD — is the load-bearing ordering choice). 10 phases total, matching the architecture's "Suggested Build Order" with refinements from features + pitfalls research.

### Phase 1: Foundations
**Rationale:** Nothing works without auth + a workspace to scope data to. Convex schema and auth library setup shake out earliest; R2 bucket + CORS provisioned correctly from the start (cheaper than retrofitting per Pitfall #10).
**Delivers:** pnpm workspace, Vite SPA boot, Convex init, `@convex-dev/auth` magic-link flow (15-min TTL, single-use, rate-limited, reactive "check your email" page), workspace + membership + users schema + CRUD, R2 bucket with private policy and narrow CORS allowlist, CI bundle-size gate for Worker.
**Addresses:** auth + workspace from FEATURES.md table stakes.
**Avoids:** Pitfalls #10 (public R2/loose CORS), #19 (Worker bundle bloat — CI gate), #22 (magic-link replay), #23 (wrong-browser deep-link UX).

### Phase 2: Renderer Package Skeleton
**Rationale:** Establish `@prism/renderer` purity boundary BEFORE authoring code grows tendrils into it. Cheap to do early, expensive to retrofit. Single most important ordering choice in the whole roadmap.
**Delivers:** `packages/renderer` with `<Module>`, `<RichTextBlock>` (read-only), shared `Block`/`Theme` types, theme tokens → CSS variables. ESLint `no-restricted-imports` rule forbidding `convex/*`, `fetch`, auth code in the package. `resolveAsset` and `theme` as dependency-injected props.
**Uses:** React 19, Tailwind v4, types only (no runtime deps that break purity).
**Implements:** renderer purity boundary (architecture's load-bearing wall).
**Avoids:** Pitfall #11 (theme doesn't reach export — single renderer is the only durable fix).

### Phase 3: Block CRUD (Text Only) + Realtime Sync Decision
**Rationale:** Prove the realtime sync strategy end-to-end on the simplest block. If Option A (per-field LWW) doesn't survive 3-tab testing, find out here — not after building 7 block types. Tiptap schemaVersion plumbing introduced now even though only v1 exists (Pitfall #20).
**Delivers:** modules/lessons/blocks schema (one Convex doc per block — Pitfall #16); fractional-ordering plan documented; Tiptap mounted for rich text with `schemaVersion: 1` + migration registry stub; per-block Convex mutations with `baseUpdatedAt` optimistic concurrency; "conflict detected" toast; aggregate query `getModuleWithLessonsAndBlocks` (single subscription per editor — Pitfall #15); paste sanitization (Pitfall #21); single-author undo.
**Avoids:** Pitfalls #6 (validates the per-field LWW design via 3-tab test), #15 (N+1 subscriptions), #16 (1MB doc limit — design enforced), #20 (Tiptap migrations), #21 (paste injection).
**Research flag:** needs `--research-phase` if the team chooses to spike both Option A and a Y.js prototype side-by-side before locking the decision.

### Phase 4: Asset Upload Pipeline
**Rationale:** Required by Image and Lottie blocks in Phase 5. Stand up the Worker for the first time here. Two-phase upload + reaper is non-negotiable (Pitfall #8).
**Delivers:** Convex `assets` table (`pending`/`ready`/`failed`), Worker `/presign` endpoint, S3-compatible signed PUT with `Content-Length-Range` + `Content-Type` constraints, client + server-side magic-byte validation (Pitfall #9), Convex action `assets.commitUpload`, scheduled function reaping `pending_uploads` > 1h old, Worker `/asset/:id` signed GET for authoring reads (15-min TTL).
**Uses:** Cloudflare R2, Workers (`aws4fetch`), Convex scheduled functions.
**Avoids:** Pitfalls #8 (orphan uploads), #9 (MIME/size validation), #10 (signed URLs not public bucket).
**Research flag:** standard pattern — likely no `--research-phase` needed.

### Phase 5: Block Type Expansion
**Rationale:** Image + Lottie depend on Phase 4's upload pipeline; Quiz MC, Quiz T/F, Video embed, Accordion are pure data and can be built in parallel.
**Delivers:** all 7 v1 block types implemented in both `@prism/renderer` (read-only) and authoring wrappers in `apps/web`. Image block enforces mandatory `alt` text (accessibility table stakes). Lottie block uses `@lottiefiles/dotlottie-react` with IntersectionObserver-gated autoplay (Pitfall #25). Video embed validates YouTube/Vimeo URL shape only, no upload.
**Addresses:** entire FEATURES.md v1 block set.
**Avoids:** Pitfalls #25 (Lottie main-thread blocking), #9 (validation enforced via Phase 4 plumbing).

### Phase 6: Theming
**Rationale:** Renderer is ready, blocks exist; now we can theme them. Earlier would mean theming a moving target. Append-only theme versions designed in here (Pitfall #30).
**Delivers:** workspace theme schema (primary, accent, heading font, body font, logo) — append-only versions with `activeThemeVersionId` pointer; theme editor UI with live preview; CSS-variable propagation via `@prism/renderer/theme.ts`; AA contrast warning on user-picked colors (accessibility table stakes); font picker (curated 10–15 Google Fonts) with license-redistribution check.
**Uses:** CSS custom properties, `@prism/renderer/theme.ts`.
**Avoids:** Pitfall #30 (no theme rollback path — solved by append-only design).

### Phase 7: Learner Preview
**Rationale:** Renders the same `@prism/renderer` tree the SCORM export will use → dogfoods the renderer before export ships. Iframe-isolated for fidelity.
**Delivers:** preview pane (iframe-isolated full-screen overlay) consuming the reactive Convex query; responsive preview toggle (desktop/tablet/mobile).
**Uses:** existing renderer; no new infrastructure.

### Phase 8: SCORM Export (THE INTEGRATION PHASE)
**Rationale:** All inputs exist (renderer, blocks, assets, theme, runtime). This is where the Core Value is validated. Worker-side streaming export, not client JSZip (Pitfalls #17, #18). SCORM Cloud validation as an automated gate, not a manual step (Pitfall #5).
**Delivers:** `apps/scorm-runtime` Vite build outputting `runtime.js` + `runtime.css`; `@prism/scorm` `imsmanifest.xml` builder with explicit completion-model choice (mastery vs. completed/incomplete — Pitfall #3); `workers/export` route using `fflate` streaming (Pitfall #18) with store-only for already-compressed assets; Convex `exports` table + action + async job pattern (Pitfall #17); `reportScore(correct, total)` normalizer (Pitfall #4); SCORM 1.2 API adapter using pipwerks-style discovery algorithm + `scorm-again` runtime (Pitfall #1); `LMSCommit` after every state change + `LMSFinish` on `pagehide` (Pitfall #2); self-hosted subsetted fonts inside the zip (Pitfall #14); `#lf-root` scoped CSS reset (Pitfall #12); strip `prefers-color-scheme` from export CSS (Pitfall #13); explicit IntersectionObserver lazy-loading (Pitfall #26); document-relative paths only + `<base href="./">` (Pitfall #27); pre-download zip audit grepping for emails/UUIDs/Convex URLs/source maps (Pitfall #28); XSD-validate generated manifest in CI + SCORM Cloud Test Track API (Pitfall #5).
**Addresses:** entire SCORM export section of FEATURES.md table stakes. This phase IS the deliverable.
**Avoids:** Pitfalls #1–5, #11–14, #17–19, #26–28.
**Research flag:** strongly recommend `--research-phase` — SCORM has many subtle correctness traps; budget for iterative manifest fixes against SCORM Cloud + at least one real LMS.

### Phase 9: Realtime Polish
**Rationale:** Quality-of-life on top of Phase 3's sync foundation. Defer until co-edit is actually being used so the polish targets real friction.
**Delivers:** presence avatars + cursors (throttled to 5–10Hz via ephemeral `presence` table — Pitfall #7); `editingBy` hint UI (NOT a lock — anti-pattern per architecture); fractional-index migration if Phase 3's `order: v.number()` collides in real usage; soft-delete trash + 7-day recovery (post-v1 feature surfacing here).
**Avoids:** Pitfall #7 (presence flooding).

### Phase 10: Hardening
**Rationale:** Production-readiness work discovered from Phase 7–9 real usage.
**Delivers:** R2 event webhook for orphan asset reconciliation; export size pre-flight rejection; module validator + read-only debug view (Pitfall #29); JSON module export/import; rate-limit hardening; error boundaries + retry queues; virtualized block list with `@tanstack/react-virtual` if not already added in Phase 5 (Pitfall #24); end-to-end Playwright test that exports a module, unzips, parses manifest, asserts structure.
**Avoids:** Pitfalls #24 (editor lag at 200 blocks), #29 (no module inspection).

### Phase Ordering Rationale

- **Phase 2 (renderer) before Phase 3 (block CRUD)** — purity boundary must be locked in before any Convex-aware code is written nearby. Architecture's load-bearing wall.
- **Phase 4 (asset pipeline) before Phase 5's image/Lottie blocks**, but Quiz MC, Quiz T/F, Video embed, Accordion in Phase 5 can be built in parallel — those have no asset dependency.
- **Phase 8 (SCORM export) blocks the core value proposition.** Don't let Phase 9 polish defer it.
- **Pitfall mitigations cluster** in Phases 1 (provisioning), 3 (realtime + Convex limits), 4 (uploads), 8 (SCORM correctness) — these are the highest-stakes phases.

### Research Flags

Phases likely needing `--research-phase` during planning:
- **Phase 3** — only if the team wants to spike Y.js side-by-side before locking the Open Decision on realtime sync.
- **Phase 8 (SCORM Export)** — strong recommendation. SCORM has the most spec-vs-LMS-reality friction; cross-LMS test plan needs concrete LMS targets agreed upfront.

Phases with standard, well-documented patterns (skip research-phase):
- **Phase 1** (Convex Auth + R2 + Cloudflare provisioning — official docs cover this thoroughly)
- **Phase 2** (pure-package architecture is straightforward once boundary rule is named)
- **Phase 4** (R2 signed PUT + two-phase upload is a documented Cloudflare pattern)
- **Phase 5** (block components are bread-and-butter React; Lottie + Tiptap patterns are well-trodden)
- **Phase 6, 7, 9, 10** (each consumes patterns established in earlier phases)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every recommendation cross-checked against latest releases (May 2026); Convex Auth beta-status acknowledged but magic-link is its most stable surface |
| Features | HIGH | Rise 360 + Storyline + Captivate + iSpring + SCORM 1.2 / WCAG 2.1 AA specs are stable; PROJECT.md Active list treated as binding |
| Architecture | HIGH | Derives directly from locked stack constraints; the Convex/Y.js tradeoff is the only structural question and it's surfaced as an Open Decision |
| Pitfalls | HIGH | SCORM, Tiptap, Cloudflare specifics drawn from authoritative specs and battle-tested community wrappers (pipwerks); MEDIUM only for Convex platform limits (evolving — verify at plan time) |

**Overall confidence:** HIGH

### Gaps to Address

- **Realtime sync open decision** — recommended default is Position A (per-field LWW); requires explicit confirmation at the start of the realtime-collab phase plus a 3-tab dogfooding test before block schemas are finalized. If failure modes from Pitfall #6 appear (cursor jumping, lost keystrokes, cross-user undo), swap to Y.js *for the rich-text block only*.
- **Convex platform limits** — 1MB document size and action timeout values cited from MEDIUM-confidence research; re-verify against current Convex docs at the start of Phase 3.
- **Specific LMS targets for SCORM cross-LMS validation** — research recommends "SCORM Cloud + Moodle + one commercial LMS"; the team must name the specific commercial LMS(s) their customers use before Phase 8.
- **Convex Auth long-term stability** — currently beta; if it stalls or breaks during the build, the fallback is Clerk + Convex (adds a paid vendor; out of PROJECT.md's "everything on Convex + Cloudflare" posture).
- **Worker plan tier** — Workers Standard/Unbound is required for SCORM export (Pitfall #18); free tier 10ms CPU is not viable. Document as hard requirement.
- **Fractional-index timing** — recommended to defer until first reorder collision; needs a clear trigger criterion ("two simultaneous reorders observed in production" or similar).

## Sources

### Primary (HIGH confidence)
- **SCORM 1.2 Runtime Environment specification (ADL)** — API discovery, data model, `lesson_status` semantics, score normalization
- **IMS Content Packaging 1.1.4 spec** — `imsmanifest.xml` schema
- **Convex official documentation** — reactive queries, optimistic concurrency, Convex Auth (magic-link beta), scheduled functions, document size limit
- **Cloudflare R2 + Workers documentation** — S3-compatible signing, CORS, CPU/memory limits per plan, Web Standards APIs
- **Tiptap v3 + ProseMirror documentation** — schema, transactions, paste handling, Collaboration extension
- **OWASP Authentication + File Upload Cheat Sheets** — magic-link TTL, single-use, magic-byte MIME validation, SVG sanitization
- **WCAG 2.1 AA** — accessibility minimums (alt text, contrast, keyboard nav)
- **pipwerks SCORM API wrapper** (BSD, ~10 years production hardening) — API discovery reference
- **`scorm-again` v3.x README** — modern typed SCORM 1.2 + 2004 runtime
- **PROJECT.md** — binding v1 scope + Out of Scope + locked stack constraints

### Secondary (MEDIUM confidence)
- **Rise 360, Storyline, Captivate, iSpring, Elucidat, EasyGenerator product documentation** — competitor feature baselines
- **Articulate community forum + r/instructionaldesign** — "what users complain about in Rise" → differentiator targets (publish speed, brand drift, co-edit lag)
- **`fflate`, `@lottiefiles/dotlottie-web`, `@dnd-kit/core` 6.x, `@tanstack/react-router` 1.168.x release notes** (May 2026)
- **Convex platform limits** — 1MB doc, action timeouts; values cited from current docs but the platform is evolving

### Tertiary (LOW confidence — verify per customer LMS)
- **LMS-specific quirks** — Moodle proxy paths, Cornerstone iframe nesting, SuccessFactors font overrides (from SCORM developer community reports; behavior varies per LMS version)
- **Google Fonts GDPR ruling (DE, Jan 2022)** — jurisdiction-specific basis for "self-host fonts in export" recommendation

---
*Research completed: 2026-05-27*
*Ready for roadmap: yes*

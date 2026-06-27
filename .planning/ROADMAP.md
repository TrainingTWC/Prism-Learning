# Prism Learning — Roadmap

> Maps every v1 requirement to exactly one phase. Phase ordering follows the architecture's dependency graph: renderer purity boundary BEFORE block CRUD, asset pipeline BEFORE image/Lottie blocks, theming BEFORE preview and export, export depends on everything above it.

**Granularity:** standard (8 phases)
**Coverage:** 73/73 v1 requirements mapped
**Milestone:** v1 — usable internal authoring tool with SCORM 1.2 export

---

## Phases

- [ ] **Phase 1: Foundations & Auth** — Convex + R2 + Workers provisioning, magic-link sign-in, workspace + membership + invites
- [ ] **Phase 2: Renderer Package Skeleton** — `@prism/renderer` pure package, theme-token plumbing, ESLint purity boundary
- [ ] **Phase 3: Module/Lesson/Block CRUD + Realtime Sync (Rich Text)** — modules, lessons, blocks, rich-text block, per-field LWW, presence
- [ ] **Phase 4: Asset Upload Pipeline** — Convex `assets` table, Worker `/presign`, two-phase upload, signed reads, reaper
- [ ] **Phase 5: Block Type Expansion** — image, video embed, MCQ, T/F, accordion, Lottie blocks (authoring + renderer), accessibility baseline
- [ ] **Phase 6: Theming** — workspace theme editor, CSS-variable propagation, font loading, contrast warning
- [ ] **Phase 7: Learner Preview** — full-screen iframe-isolated preview consuming `@prism/renderer`
- [ ] **Phase 8: SCORM 1.2 Export & Hardening** — runtime bundle, manifest builder, Worker zip assembly, SCORM Cloud validation, responsive output, polish
- [ ] **Phase 9: Critical Bug Fixes (v1.1)** — gallery carousel JS, Lottie self-contained export, SCORM API discovery, lesson title inline edit, Tabs rich text editor

---

## v1.1 Phase Details

### Phase 9: Critical Bug Fixes
**Goal**: Fix five production-blocking bugs so exported SCORM packages work correctly in real LMS environments and authoring UX is smooth.
**Depends on**: Phases 1–8 (live deployed app).
**Requirements**: SCO-FIX-01, SCO-FIX-02, SCO-FIX-03, UX-FIX-01, UX-FIX-02
**Success Criteria** (what must be TRUE):
  1. A gallery block with carousel layout in an exported SCORM zip navigates correctly (Prev/Next and dots work); all other slides are hidden; no external JS is loaded.
  2. A Lottie block in an exported SCORM zip plays without any network call; lottie-web is bundled as `assets/lottie.min.js`; animation JSON is embedded inline in the HTML.
  3. A learner who completes the last lesson of a module and clicks "Finish" triggers correct `cmi.core.lesson_status` on the real LMS API (verified in SCORM Cloud or equivalent); the no-op API shim never intercepts when a real LMS API is present.
  4. Clicking the lesson title `<h2>` in the main content area directly activates an editable input (identical behavior to the pencil icon).
  5. A Tabs block content editor shows Tiptap toolbar (bold, color, heading, lists); formatted content is saved and rendered correctly by the Tabs block renderer.
**Plans**: TBD

---

## v1 Phase Details

### Phase 1: Foundations & Auth
**Goal**: A new author can sign in via magic link, land in a workspace, and invite collaborators.
**Depends on**: Nothing (first phase).
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, RSP-02
**Success Criteria** (what must be TRUE):
  1. A user can enter their email on the sign-in page, receive a magic link, click it (within 15 minutes, single-use), and land in a workspace dashboard signed in.
  2. The signed-in session persists across page reloads and browser restarts; "Sign out" is reachable from any authenticated page and immediately terminates the session.
  3. The first signup creates a workspace; the owner can open a "Members" panel, invite a teammate by email (magic-link invite), and remove members from the list.
  4. R2 bucket is provisioned private with a narrow CORS allowlist; the Workers project deploys to a `*.workers.dev` URL with a bundle-size CI gate green.
  5. Visiting the authoring app on a mobile viewport shows a "best viewed on desktop" notice (RSP-02).
**Plans**: TBD
**UI hint**: yes
**Research**: not required (Convex Auth + R2 + Workers provisioning are well-documented).

### Phase 2: Renderer Package Skeleton
**Goal**: Establish the `@prism/renderer` purity boundary and theme-token contract before any authoring code grows tendrils into it.
**Depends on**: Phase 1 (monorepo + tooling exists).
**Requirements**: (infrastructure phase — enables THM, PRV, SCO families; no direct REQ delivery)
**Success Criteria** (what must be TRUE):
  1. `packages/renderer` exports `<Module blocks theme resolveAsset>`, `<RichTextBlock>` (read-only), and shared `Block`/`Theme`/`Module` TypeScript types — consumable by both `apps/web` and `apps/scorm-runtime`.
  2. ESLint `no-restricted-imports` rule fails the build if any file under `packages/renderer/src/**` imports `convex/*`, `fetch`, auth modules, or absolute hex colors.
  3. Theme tokens (primary, accent, headingFont, bodyFont) map to CSS custom properties via a single `tokensToCss(theme)` helper; a Storybook/demo route renders a sample block tree with two different themes and visibly re-themes by swapping the `<Module theme>` prop.
  4. A static example using mock data renders the renderer outside the SPA build (proves zero runtime dependency on Convex).
**Plans**: TBD
**Research**: not required.

### Phase 3: Module/Lesson/Block CRUD + Realtime Sync (Rich Text)
**Goal**: Authors can build a module out of lessons and rich-text blocks, with realtime co-edit and a proven per-field LWW sync strategy.
**Depends on**: Phase 1 (auth/workspaces), Phase 2 (renderer types + RichTextBlock).
**Requirements**: MOD-01, MOD-02, MOD-03, MOD-04, MOD-05, MOD-06, LES-01, LES-02, LES-03, LES-04, BLK-01, BLK-02, BLK-03, BLK-04, BLK-05, BLK-06, BLK-RT-01, BLK-RT-02, BLK-RT-03, COL-01, COL-02, COL-03, COL-04
**Success Criteria** (what must be TRUE):
  1. From the dashboard, an author can create, rename, duplicate, and soft-delete modules; the list shows title, last-updated, and last editor (MOD-05).
  2. Inside a module, an author can add/rename/reorder/delete lessons via the sidebar (drag-and-drop) and insert/reorder/duplicate/delete rich-text blocks within a lesson via a "+" picker and drag handles.
  3. A Tiptap-powered rich-text block supports H1–H3, bold, italic, links, bullet/numbered lists, callouts; paste from Word/Google Docs preserves structural formatting and strips inline styles. Edits autosave within 1s and Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z undo/redo work within the session.
  4. A 3-tab dogfooding test (two authors editing the same module in two browser tabs, a third tab observing) shows: edits propagate sub-second, presence avatars appear for both active editors, and concurrent same-field edits resolve via per-field LWW with a "your edit overrode Bob's — undo?" toast on the loser's screen.
  5. The Convex schema enforces one document per block (no embedded module-wide JSON), and the editor view uses a single aggregate subscription (`getModuleWithLessonsAndBlocks`) rather than N+1 queries.
**Plans**: TBD
**Research**: recommended (optional — spike Y.js side-by-side ONLY if 3-tab test reveals Pitfall #6 failure modes; default is per-field LWW per the Open Decision).

### Phase 4: Asset Upload Pipeline
**Goal**: Authors can upload binary assets directly to R2 via a Convex-authorized, Worker-presigned, two-phase flow that doesn't orphan bytes.
**Depends on**: Phase 1 (R2 bucket, Worker shell, auth).
**Requirements**: BLK-IMG-04
**Success Criteria** (what must be TRUE):
  1. A test upload (JPG, PNG, WebP, GIF up to 10 MB; Lottie JSON up to 2 MB) flows: Convex `assets.createPending` → Worker `/presign` → browser PUT direct to R2 → Convex `assets.markReady`; bytes never traverse Convex or the Worker.
  2. The Worker's presigned PUT URL is scoped (5-min TTL, pinned Content-Type, Content-Length-Range); both client-side and server-side magic-byte validation reject mismatched MIME types.
  3. A scheduled Convex function reaps `pending` asset rows older than 1 hour, and the matching R2 keys are deleted; orphan reconciliation is observable in a log.
  4. A Worker `/asset/:id` route returns a 15-min-TTL signed GET URL after membership re-check; an unauthenticated request 401s.
**Plans**: TBD
**Research**: not required (standard R2 + Worker pattern).

### Phase 5: Block Type Expansion
**Goal**: All seven v1 block types are usable in authoring AND rendered identically by `@prism/renderer`, with accessibility baselines enforced.
**Depends on**: Phase 3 (block CRUD), Phase 4 (asset pipeline — image + Lottie depend on it; the rest can build in parallel).
**Requirements**: BLK-IMG-01, BLK-IMG-02, BLK-IMG-03, BLK-VID-01, BLK-VID-02, BLK-VID-03, BLK-MCQ-01, BLK-MCQ-02, BLK-MCQ-03, BLK-MCQ-04, BLK-TF-01, BLK-TF-02, BLK-TF-03, BLK-ACC-01, BLK-ACC-02, BLK-ACC-03, BLK-LOT-01, BLK-LOT-02, A11Y-01, A11Y-02, A11Y-03
**Success Criteria** (what must be TRUE):
  1. An author can insert and edit each of the seven block types end-to-end: rich text (from Phase 3), image-with-caption (upload + alt text required to mark "complete"), YouTube/Vimeo video embed (with invalid-URL inline error), MCQ with 2–6 options + per-state feedback, T/F with feedback, accordion with 2–10 reveal sections, and Lottie embed with loop/autoplay toggles.
  2. Each block type renders identically in `@prism/renderer` (same DOM in authoring preview and in the renderer demo route) — proves the purity boundary holds under feature load.
  3. Image blocks without alt text show a non-blocking warning indicator; the author cannot mark the module "complete for export" until all images have alt text (A11Y-02).
  4. All quiz options, accordion headers, and block controls are keyboard-operable (tab order, Enter/Space activation); all blocks emit semantic HTML (`<h*>`, `<ul>`/`<ol>`, `<button>`) verified by a Playwright accessibility-tree snapshot test.
  5. MCQ and T/F blocks expose an `onScore(correct, total)` callback contract that downstream phases (preview, SCORM runtime) can subscribe to; the contract is unit-tested with mock callbacks.
**Plans**: TBD
**UI hint**: yes
**Research**: not required.

### Phase 6: Theming
**Goal**: A workspace owner can edit one theme that propagates to authoring preview and (later) to SCORM exports, with WCAG AA contrast warnings.
**Depends on**: Phase 2 (renderer theme tokens), Phase 5 (blocks exist to be themed).
**Requirements**: THM-01, THM-02, THM-03, THM-04, THM-05 (partial — schema + storage; the export bake-in is exercised in Phase 8), THM-06, A11Y-04
**Success Criteria** (what must be TRUE):
  1. A workspace owner opens a settings panel with a color picker (primary, accent) and a font picker (curated 10–15 self-hosted fonts for heading + body); saving updates the workspace theme.
  2. Theme changes propagate immediately to the authoring preview pane across every block type with zero re-render (CSS custom property update), and all existing modules pick up the new theme without per-module overrides (THM-04).
  3. The theme editor shows a contrast warning (AA threshold) when primary/background or accent/background falls below contrast ratio 4.5:1 — verified against a known-bad palette in a test.
  4. The theme record uses append-only versions with an `activeThemeVersionId` pointer, so future export snapshots can reproduce historical themes (sets up THM-05's "theme active at export time" semantics for Phase 8).
**Plans**: TBD
**UI hint**: yes
**Research**: not required.

### Phase 7: Learner Preview
**Goal**: An author can preview a module exactly as a learner would, using the same renderer that will power the SCORM export.
**Depends on**: Phase 2 (renderer), Phase 5 (all block types), Phase 6 (theming).
**Requirements**: PRV-01, PRV-02, PRV-03
**Success Criteria** (what must be TRUE):
  1. A "Preview" button in the authoring editor opens a full-screen iframe-isolated overlay rendering the current module via `@prism/renderer` with the active workspace theme applied.
  2. The preview supports prev/next lesson navigation, interactive quiz blocks (with feedback display), accordion expansion, and a final summary screen showing per-quiz results.
  3. Closing preview returns the author to the exact editor state they left (cursor position preserved); reactive Convex query keeps the preview in sync with concurrent edits made by other authors.
  4. Manual visual comparison: preview output matches what `@prism/renderer` produces in the Phase 2 demo route for the same `(blocks, theme)` pair — same DOM, same CSS.
**Plans**: TBD
**Research**: not required.

### Phase 8: SCORM 1.2 Export & Hardening
**Goal**: An author exports a module as a SCORM 1.2 zip that runs in any compliant LMS, is fully self-contained, reports score and completion, and the product is hardened for daily team use.
**Depends on**: Phase 2 (renderer), Phase 4 (R2 bytes for assets), Phase 5 (all blocks + quiz `onScore` contract), Phase 6 (theme versions to bake), Phase 7 (preview proves renderer fidelity).
**Requirements**: SCO-01, SCO-02, SCO-03, SCO-04, SCO-05, SCO-06, SCO-07, SCO-08, BLK-LOT-03, RSP-01
**Success Criteria** (what must be TRUE):
  1. Clicking "Export" on a module produces a downloadable `.zip` containing `imsmanifest.xml`, `runtime.js`, `runtime.css`, `module.json`, `theme.css` (baked from the active theme at export time), `assets/*`, and self-hosted subsetted fonts — XSD validation of the manifest passes in CI.
  2. Uploading the zip to SCORM Cloud (automated test-track API call in CI) runs the module: navigation works, MCQ + T/F quizzes record interactions, `cmi.core.score.raw` reports 0–100 (normalized via a single `reportScore(correct, total)` helper), and `cmi.core.lesson_status` reports `completed` (or `passed`/`failed` if a threshold was set).
  3. The zip is fully self-contained: a pre-download zip audit (CI grep) finds no references to `convex.cloud`, the dev Worker URL, source maps, emails, or `fonts.googleapis.com`; a Lottie block renders from the bundled JSON with no network call (BLK-LOT-03).
  4. The SCORM API adapter discovers `window.parent.API` across nested iframes using the SCORM 1.2 §3.3.6.1 bidirectional pilfer algorithm (pipwerks-style); `LMSCommit` fires after every meaningful state change and `LMSFinish` fires on `pagehide`, not `beforeunload`.
  5. Export of a typical module (≤50 MB of assets) completes end-to-end within 30 seconds via the Worker streaming-zip pipeline (`fflate`, store-only for already-compressed assets); pre-flight rejects oversize modules with an actionable error.
  6. The exported output renders without horizontal scrolling on viewports from 360px to 1920px wide (RSP-01), verified by Playwright snapshots at 360/768/1280/1920.
  7. Hardening complete: error boundaries + retry queues in the SPA, R2 event webhook reconciles orphan `pending` assets, a `@tanstack/react-virtual` block list keeps editing smooth past 100 blocks, and a Playwright end-to-end test exports a module, unzips it, parses the manifest, and asserts structure.
**Plans**: TBD
**Research**: recommended — SCORM has the most spec-vs-LMS-reality friction; budget for iterative manifest fixes against SCORM Cloud + at least one real target LMS.

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundations & Auth | 0/0 | Not started | - |
| 2. Renderer Package Skeleton | 0/0 | Not started | - |
| 3. Module/Lesson/Block CRUD + Realtime | 0/0 | Not started | - |
| 4. Asset Upload Pipeline | 0/0 | Not started | - |
| 5. Block Type Expansion | 0/0 | Not started | - |
| 6. Theming | 0/0 | Not started | - |
| 7. Learner Preview | 0/0 | Not started | - |
| 8. SCORM Export & Hardening | 0/0 | Not started | - |
| 9. Critical Bug Fixes (v1.1) | 0/0 | Not started | - |

---

## Open Decisions (carried from research)

- **Realtime sync strategy** — default is per-field LWW (Position A); revisit at the start of Phase 3 with a 3-tab dogfooding test. If Pitfall #6 failure modes appear (cursor jumping, lost keystrokes, cross-user undo), swap to Y.js *for the rich-text block only*.
- **Specific target LMS(s)** beyond SCORM Cloud — must be named before Phase 8 planning.
- **Convex platform limits** (1MB doc, action timeouts) — re-verify against current docs at the start of Phase 3.
- **Worker plan tier** — Workers Standard/Unbound required for Phase 8 (Pitfall #18).
- **Fractional-index ordering** — defer until first reorder collision observed (`order: v.number()` ships in Phase 3).

---

*Last updated: 2026-05-27 by /gsd-roadmapper*

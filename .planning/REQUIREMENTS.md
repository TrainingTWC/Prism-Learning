# Prism Learning — v1 Requirements

> Source of truth for what v1 must do. Each requirement has a stable REQ-ID and a clear, testable, user-centric statement.
> Sourced from `.planning/PROJECT.md` (Active scope) plus research-surfaced table stakes from `.planning/research/FEATURES.md`, `ARCHITECTURE.md`, and `PITFALLS.md`.

---

## v1 Requirements

### Authentication & Workspace

- [ ] **AUTH-01** — A user can request a magic link by entering their email on the sign-in page.
- [ ] **AUTH-02** — A user can complete sign-in by clicking the magic link in their email; links expire in 15 minutes and are single-use.
- [ ] **AUTH-03** — A signed-in user stays signed in across page reloads and browser restarts (session persistence).
- [ ] **AUTH-04** — A user can sign out from any page.
- [ ] **AUTH-05** — A user has exactly one workspace in v1; the first author to sign up creates the workspace, subsequent invitees join it.
- [ ] **AUTH-06** — A workspace owner can invite collaborators by email; invitees receive a magic link that adds them to the workspace on first sign-in.
- [ ] **AUTH-07** — A workspace owner can see the list of workspace members and remove members.

### Module Management

- [ ] **MOD-01** — An author can create a new empty module from the workspace dashboard.
- [ ] **MOD-02** — An author can rename a module.
- [ ] **MOD-03** — An author can duplicate a module (copies all lessons, blocks, and references to assets).
- [ ] **MOD-04** — An author can delete a module (soft-delete: recoverable for 30 days, then purged).
- [ ] **MOD-05** — The dashboard lists all modules in the workspace with title, last-updated timestamp, and last editor.
- [ ] **MOD-06** — An author can open a module to enter the authoring editor.

### Lesson Structure

- [ ] **LES-01** — A module contains an ordered list of lessons; an author can add a new lesson at the end of the list.
- [ ] **LES-02** — An author can rename a lesson inline in the lesson sidebar.
- [ ] **LES-03** — An author can reorder lessons by drag-and-drop in the sidebar.
- [ ] **LES-04** — An author can delete a lesson (with confirmation; cascade-deletes its blocks).

### Block CRUD

- [ ] **BLK-01** — Within a lesson, an author can insert a new block of any v1 type via a "+" button that opens a block picker.
- [ ] **BLK-02** — An author can reorder blocks within a lesson by drag-and-drop.
- [ ] **BLK-03** — An author can delete a block (with confirmation).
- [ ] **BLK-04** — An author can duplicate a block in place.
- [ ] **BLK-05** — Block edits autosave within 1 second of the last keystroke; no explicit save button.
- [ ] **BLK-06** — An author can undo and redo their own edits within the current session (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z).

### Block Type — Rich Text

- [ ] **BLK-RT-01** — Rich text block supports paragraphs, H1/H2/H3 headings, bold, italic, links, bullet lists, numbered lists.
- [ ] **BLK-RT-02** — Rich text block supports a "callout" style (visually distinct boxed paragraph).
- [ ] **BLK-RT-03** — Paste from Word / Google Docs preserves bold/italic/lists but strips unsupported formatting and inline styles.

### Block Type — Image + Caption

- [ ] **BLK-IMG-01** — An author can add an image by uploading from disk (JPG, PNG, WebP, GIF; max 10 MB) or pasting an image URL.
- [ ] **BLK-IMG-02** — An author MUST provide alt text before the block is considered "complete"; missing alt text is flagged with a warning indicator.
- [ ] **BLK-IMG-03** — An author can add an optional caption shown below the image.
- [ ] **BLK-IMG-04** — Uploaded images are stored in R2 and served via signed/public URL.

### Block Type — Video Embed

- [ ] **BLK-VID-01** — An author can paste a YouTube or Vimeo URL; the block recognizes the provider and renders an embedded player.
- [ ] **BLK-VID-02** — Invalid URLs show a friendly error inline.
- [ ] **BLK-VID-03** — An author can add an optional caption below the video.

### Block Type — Multiple-Choice Quiz

- [ ] **BLK-MCQ-01** — An author can define a question stem (rich text), 2–6 answer options, and mark exactly one option as the correct answer.
- [ ] **BLK-MCQ-02** — An author can write feedback text shown after the learner answers (one feedback per correctness state: correct/incorrect, optional).
- [ ] **BLK-MCQ-03** — A learner sees the question, selects an option, submits, and sees feedback + correct/incorrect indication.
- [ ] **BLK-MCQ-04** — The block contributes to the module's overall score (see SCORM-04).

### Block Type — True/False Quiz

- [ ] **BLK-TF-01** — An author can define a statement (rich text), mark it as True or False, and write optional feedback per outcome.
- [ ] **BLK-TF-02** — A learner sees the statement, picks True or False, submits, and sees feedback.
- [ ] **BLK-TF-03** — The block contributes to the module's overall score.

### Block Type — Accordion

- [ ] **BLK-ACC-01** — An author can add an accordion block containing 2–10 collapsible items, each with a header and a body (rich text + image allowed inside).
- [ ] **BLK-ACC-02** — A learner sees only headers initially; clicking a header expands its body.
- [ ] **BLK-ACC-03** — Multiple accordion items may be open at once (no enforced single-open behavior in v1).

### Block Type — Lottie Embed

- [ ] **BLK-LOT-01** — An author can upload a `.json` Lottie file (max 2 MB) into the block.
- [ ] **BLK-LOT-02** — The animation plays inline at natural aspect ratio; an author can choose loop on/off and autoplay on/off.
- [ ] **BLK-LOT-03** — The animation is bundled into the SCORM export (no live fetch in learner output).

### Realtime Collaboration

- [ ] **COL-01** — When two authors open the same module, both see each other's block additions, edits, and reorderings within 1 second.
- [ ] **COL-02** — Each author sees presence avatars indicating who else is currently in the module.
- [ ] **COL-03** — Concurrent edits to the same field resolve via per-field last-writer-wins; the loser sees a non-blocking toast indicating their edit was overridden.
- [ ] **COL-04** — Author identity is associated with each edit so "last editor" can be shown on the dashboard (MOD-05).

### Theming

- [ ] **THM-01** — A workspace has exactly one active theme containing: primary color, accent color, heading font, body font.
- [ ] **THM-02** — A workspace owner can edit the theme via a settings panel with a color picker for colors and a font picker (curated list of self-hosted fonts) for fonts.
- [ ] **THM-03** — Theme changes apply immediately to the authoring preview pane.
- [ ] **THM-04** — Theme changes apply to all existing modules without per-module overrides.
- [ ] **THM-05** — The exported SCORM package uses the theme that was active at export time, baked into a self-contained stylesheet.
- [ ] **THM-06** — A contrast warning shows in the theme editor if foreground/background combinations fall below WCAG AA.

### Learner Preview

- [ ] **PRV-01** — From the authoring editor, an author can click "Preview" to see the module as a learner would, in a full-screen pane.
- [ ] **PRV-02** — Preview uses the same renderer that powers SCORM export, so what authors see in preview matches what learners see in the LMS.
- [ ] **PRV-03** — Preview supports navigation between lessons (prev/next), quiz interaction, and shows a final summary screen.

### SCORM 1.2 Export

- [ ] **SCO-01** — An author can click "Export" on a module to generate and download a SCORM 1.2 `.zip` package.
- [ ] **SCO-02** — The exported package contains a valid `imsmanifest.xml` conforming to the SCORM 1.2 schema (passes XSD validation).
- [ ] **SCO-03** — The exported package is fully self-contained: all images, Lottie JSON, fonts, and runtime JS are bundled; no live network calls to Convex or external CDNs at runtime.
- [ ] **SCO-04** — The exported package reports a 0–100 score to the LMS via `cmi.core.score.raw` (calculated as percentage of quiz blocks answered correctly).
- [ ] **SCO-05** — The exported package reports completion status via `cmi.core.lesson_status` ("completed" when learner reaches the final lesson; "passed"/"failed" if a pass threshold is set).
- [ ] **SCO-06** — The exported package correctly discovers the SCORM `API` object across nested iframes (per SCORM 1.2 spec) and calls `LMSInitialize` / `LMSCommit` / `LMSFinish` at appropriate lifecycle points.
- [ ] **SCO-07** — The exported package functions correctly in SCORM Cloud (industry-standard test player) — verified as part of acceptance testing for every release.
- [ ] **SCO-08** — Export of a typical module (≤ 50 MB total assets) completes within 30 seconds end-to-end.

### Accessibility (Baseline)

- [ ] **A11Y-01** — All v1 blocks render with semantic HTML (headings as `<h*>`, lists as `<ul>/<ol>`, buttons as `<button>`).
- [ ] **A11Y-02** — Image blocks enforce alt-text presence (BLK-IMG-02).
- [ ] **A11Y-03** — All interactive elements (quiz options, accordion headers, navigation) are keyboard-operable.
- [ ] **A11Y-04** — Color contrast warnings in theme editor (THM-06).

### Mobile-Responsive Output

- [ ] **RSP-01** — The exported SCORM module renders correctly on viewports from 360px to 1920px wide without horizontal scrolling.
- [ ] **RSP-02** — Authoring UI is desktop-only and may show a "best viewed on desktop" notice on mobile (no responsive authoring).

---

## v2 (Deferred — Not in v1)

- Audio / narration block
- Video upload (host-our-own video, transcoding)
- Drag-and-drop / matching interactions
- Flip cards (accordion covers reveal-on-click need in v1)
- Scroll-driven or per-block transition animations
- Custom animation timeline editor
- SCORM 2004 / xAPI export
- Branching / draft-and-review publishing workflow
- Comments, @mentions, suggestion-mode editing
- Version history / undo across sessions
- Question banks, randomization, retry policies, weighted scoring
- Templates / starter modules
- Folders, tags, search across modules
- Multi-workspace / multi-tenant SaaS
- Mobile authoring
- Offline authoring
- Per-block theme overrides

## Out of Scope (Permanent)

- LMS hosting / SCORM player runtime — Prism produces packages; consumption is the LMS's job.
- LMS API integration beyond SCORM 1.2 — no LTI, no direct LMS APIs.
- Public marketplace / monetization features — Prism is an internal tool.
- AI content generation (in v1 — may revisit, but not v1 scope).
- Custom HTML / JavaScript embed blocks — XSS risk in LMS iframe context.
- Per-block theme overrides — kills the "theme-everywhere" differentiator.
- In-product learner analytics dashboards — the LMS owns learner data.

---

## v1.1 Requirements — Bug Fix Sprint

> These are production-blocking bugs confirmed in the live deployed app.
> Root causes are known; requirements are expressed as observable, testable outcomes.

### SCORM Export Bugs

- [ ] **SCO-FIX-01** — Gallery block in carousel mode must display only one slide at a time in the exported SCORM package, with Prev/Next buttons and dot indicators functioning correctly without requiring external scripts or `document.currentScript`.
- [ ] **SCO-FIX-02** — Lottie animation blocks must render and play in the exported SCORM package without making any external network calls (CDN-free, self-contained); lottie-web must be bundled locally and animation data must be embedded inline.
- [ ] **SCO-FIX-03** — After a learner completes the last lesson and clicks "Finish", the SCORM package must correctly report `cmi.core.lesson_status` (completed/passed/failed) and `cmi.core.score.raw` to the real LMS API; the no-op fallback shim must never shadow the LMS-provided `window.API`.

### Authoring UX Bugs

- [ ] **UX-FIX-01** — Clicking the lesson title `<h2>` in the main content area must activate inline rename mode, identical in behavior to clicking the pencil icon.
- [ ] **UX-FIX-02** — Tab content in the Tabs block editor must use a rich text editor (Tiptap) supporting bold, italic, text color, headings, and lists; existing tab content must render correctly in the Tabs block renderer.

---

## Traceability

<!-- Filled by roadmapper: maps each REQ-ID to the phase that delivers it. -->

| REQ-ID | Phase | Status |
|--------|-------|--------|
| AUTH-01 | Phase 1: Foundations & Auth | Pending |
| AUTH-02 | Phase 1: Foundations & Auth | Pending |
| AUTH-03 | Phase 1: Foundations & Auth | Pending |
| AUTH-04 | Phase 1: Foundations & Auth | Pending |
| AUTH-05 | Phase 1: Foundations & Auth | Pending |
| AUTH-06 | Phase 1: Foundations & Auth | Pending |
| AUTH-07 | Phase 1: Foundations & Auth | Pending |
| MOD-01 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| MOD-02 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| MOD-03 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| MOD-04 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| MOD-05 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| MOD-06 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| LES-01 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| LES-02 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| LES-03 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| LES-04 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| BLK-01 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| BLK-02 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| BLK-03 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| BLK-04 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| BLK-05 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| BLK-06 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| BLK-RT-01 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| BLK-RT-02 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| BLK-RT-03 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| BLK-IMG-01 | Phase 5: Block Type Expansion | Pending |
| BLK-IMG-02 | Phase 5: Block Type Expansion | Pending |
| BLK-IMG-03 | Phase 5: Block Type Expansion | Pending |
| BLK-IMG-04 | Phase 4: Asset Upload Pipeline | Pending |
| BLK-VID-01 | Phase 5: Block Type Expansion | Pending |
| BLK-VID-02 | Phase 5: Block Type Expansion | Pending |
| BLK-VID-03 | Phase 5: Block Type Expansion | Pending |
| BLK-MCQ-01 | Phase 5: Block Type Expansion | Pending |
| BLK-MCQ-02 | Phase 5: Block Type Expansion | Pending |
| BLK-MCQ-03 | Phase 5: Block Type Expansion | Pending |
| BLK-MCQ-04 | Phase 5: Block Type Expansion | Pending |
| BLK-TF-01 | Phase 5: Block Type Expansion | Pending |
| BLK-TF-02 | Phase 5: Block Type Expansion | Pending |
| BLK-TF-03 | Phase 5: Block Type Expansion | Pending |
| BLK-ACC-01 | Phase 5: Block Type Expansion | Pending |
| BLK-ACC-02 | Phase 5: Block Type Expansion | Pending |
| BLK-ACC-03 | Phase 5: Block Type Expansion | Pending |
| BLK-LOT-01 | Phase 5: Block Type Expansion | Pending |
| BLK-LOT-02 | Phase 5: Block Type Expansion | Pending |
| BLK-LOT-03 | Phase 8: SCORM Export & Hardening | Pending |
| COL-01 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| COL-02 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| COL-03 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| COL-04 | Phase 3: Module/Lesson/Block CRUD + Realtime | Pending |
| THM-01 | Phase 6: Theming | Pending |
| THM-02 | Phase 6: Theming | Pending |
| THM-03 | Phase 6: Theming | Pending |
| THM-04 | Phase 6: Theming | Pending |
| THM-05 | Phase 6: Theming | Pending |
| THM-06 | Phase 6: Theming | Pending |
| PRV-01 | Phase 7: Learner Preview | Pending |
| PRV-02 | Phase 7: Learner Preview | Pending |
| PRV-03 | Phase 7: Learner Preview | Pending |
| SCO-01 | Phase 8: SCORM Export & Hardening | Pending |
| SCO-02 | Phase 8: SCORM Export & Hardening | Pending |
| SCO-03 | Phase 8: SCORM Export & Hardening | Pending |
| SCO-04 | Phase 8: SCORM Export & Hardening | Pending |
| SCO-05 | Phase 8: SCORM Export & Hardening | Pending |
| SCO-06 | Phase 8: SCORM Export & Hardening | Pending |
| SCO-07 | Phase 8: SCORM Export & Hardening | Pending |
| SCO-08 | Phase 8: SCORM Export & Hardening | Pending |
| A11Y-01 | Phase 5: Block Type Expansion | Pending |
| A11Y-02 | Phase 5: Block Type Expansion | Pending |
| A11Y-03 | Phase 5: Block Type Expansion | Pending |
| A11Y-04 | Phase 6: Theming | Pending |
| RSP-01 | Phase 8: SCORM Export & Hardening | Pending |
| RSP-02 | Phase 1: Foundations & Auth | Pending |

**Coverage:** 73 / 73 v1 requirements mapped to exactly one phase. No orphans.

### v1.1 Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| SCO-FIX-01 | Phase 9: Critical Bug Fixes | Pending |
| SCO-FIX-02 | Phase 9: Critical Bug Fixes | Pending |
| SCO-FIX-03 | Phase 9: Critical Bug Fixes | Pending |
| UX-FIX-01 | Phase 9: Critical Bug Fixes | Pending |
| UX-FIX-02 | Phase 9: Critical Bug Fixes | Pending |

---

*Last updated: 2026-05-27 after initial requirements definition.*

# Prism Learning

## What This Is

Prism Learning is a Rise-360-style learning module authoring tool for small teams. Authors collaborate in realtime to build polished, themed, block-based learning modules — text, images, video embeds, quizzes, accordions, and Lottie animations — and export them as SCORM 1.2 packages that drop straight into any LMS.

The product is for a small team of authors (the user + a few collaborators) who currently lack a clean, opinionated tool for producing modular learning content without design effort.

## Core Value

**A team author can sit down, build a themed, multi-block lesson collaboratively in realtime, and export a working SCORM 1.2 zip that runs in their LMS — without writing code, fighting layout, or installing anything.**

If theming, realtime co-editing, and a valid SCORM export all work, the product is useful. Everything else is polish.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- v1 scope. Hypotheses until shipped. -->

**Auth & Workspace**
- [ ] Authors sign in with a magic link (passwordless email)
- [ ] A workspace contains multiple authors who can be invited by email
- [ ] An author can create, rename, duplicate, and delete modules

**Module structure**
- [ ] A module contains an ordered list of lessons
- [ ] A lesson contains an ordered list of content blocks
- [ ] Authors can reorder lessons and blocks via drag handles

**Content blocks (v1 set)**
- [ ] Rich text block (headings, paragraphs, lists, bold/italic/link, callouts)
- [ ] Image-with-caption block (upload or paste URL)
- [ ] Video embed block (YouTube / Vimeo URL only)
- [ ] Multiple-choice quiz block (single correct answer, with feedback)
- [ ] True/False quiz block (with feedback)
- [ ] Accordion / reveal block (clickable sections that expand)
- [ ] Lottie embed block (drop a Lottie JSON file, it plays in the lesson)

**Realtime collaboration**
- [ ] Two authors editing the same module see each other's changes live (sub-second)
- [ ] Presence indicators show who else is in the module
- [ ] Edits never silently overwrite each other (last-writer-wins is acceptable per-field if cleanly scoped)

**Theming**
- [ ] A workspace has a theme: primary color, accent color, heading font, body font
- [ ] Theme applies consistently to authoring preview AND exported SCORM output
- [ ] Changing the theme updates all modules without re-authoring

**Learner preview**
- [ ] An author can preview a module exactly as a learner would see it (in-app, full screen)

**SCORM export**
- [ ] An author can export any module as a downloadable SCORM 1.2 `.zip` file
- [ ] The exported package contains a valid `imsmanifest.xml` and runs in a standard SCORM 1.2 player
- [ ] Quiz blocks report score and completion back to the LMS via SCORM 1.2 API
- [ ] Exported package is fully self-contained (assets bundled, no live calls to Convex)

### Out of Scope

<!-- Explicit boundaries with reasoning to prevent re-adding. -->

- **Audio / narration block** — Adds upload pipeline, waveform UI, and per-block timing semantics. Defer to v2.
- **Video upload (host our own video)** — Storage and transcoding pipeline is multi-week work. Video embeds (YouTube/Vimeo) cover 90% of the need.
- **Drag-and-drop / matching interactions** — Authoring UX is non-trivial and SCORM scoring rules get complex. Defer.
- **Flip cards** — Accordion covers the same "reveal-on-click" need for v1.
- **Scroll-driven / per-block transitions** — Would require a custom animation system. Lottie embed satisfies the "we have animations" need.
- **Custom animation timeline editor** — Out of scope by an order of magnitude. Lottie embed is the v1 answer.
- **SCORM 2004 / xAPI export** — SCORM 1.2 covers the widest LMS install base. Revisit when a specific LMS demands it.
- **Branching / draft-and-review publishing workflow** — Realtime co-edit covers v1 team workflow. Approvals can come later.
- **Multi-tenant SaaS (public signups, billing)** — This is a tool for one small team, not a product for sale.
- **Mobile authoring** — Authoring is desktop-only in v1. Learner output must be mobile-responsive.
- **Offline authoring** — Convex requires connectivity. Acceptable for v1.
- **LMS integration beyond export** — We produce a SCORM zip. We do not host modules or integrate with LMS APIs.

## Context

**Domain**
- "Rise 360" by Articulate is the reference product — block-based, themed, web-native learning module authoring. Users love its zero-friction "drop blocks, get polished output" feel.
- SCORM 1.2 is the dominant LMS interop standard (older but most widely supported). It defines an `imsmanifest.xml` packaging format and a JavaScript API (`API.LMSInitialize`, `LMSSetValue`, `LMSCommit`, `LMSFinish`) that runs inside an LMS iframe.
- "Theming applies everywhere" is the user's specifically-named differentiator — it must work in authoring preview AND exported output.

**Team & usage**
- A few authors total, all working from the same workspace.
- Authoring happens in realtime (Google Docs / Figma style).
- Exported modules are uploaded into the team's existing LMS.

**Prior work**
- None — greenfield project initialized in `C:\Users\Amritanshu\projects\learnflow`.

## Constraints

- **Tech stack — frontend**: Vite + React SPA. Hard constraint because Cloudflare Pages hosts static assets only (no Next.js server runtime).
- **Tech stack — backend**: Convex. Handles auth (magic link), database, realtime sync, server functions, and small-file storage in one service. Replaces what would otherwise be Postgres + Auth provider + Liveblocks/Yjs.
- **Tech stack — storage**: Cloudflare R2 for large assets (images, Lottie JSON, generated SCORM zips). Convex handles structured data and small blobs only.
- **Tech stack — compute / edge**: Cloudflare Workers for any edge-side compute needed (e.g., SCORM zip assembly, signed R2 uploads).
- **Tech stack — hosting**: Cloudflare Pages for the SPA. (User initially said GitHub Pages, then expanded to "all of R2 + Workers + Pages" — Cloudflare Pages selected as the unified static host.)
- **Auth**: Magic links only. No passwords, no OAuth in v1.
- **Compliance**: SCORM 1.2 only. The exported package MUST pass a standard SCORM 1.2 validator (e.g., SCORM Cloud test player).
- **Timeline**: A few weeks to a usable v1 — the user's own team should be authoring real modules with it.
- **Quality bar**: Production-usable for internal team. Clean minimal UI, smooth UX. Bugs that block authoring or break SCORM export are unacceptable.
- **No backend custom servers**: Everything must run on Convex + Cloudflare. No EC2, no Docker hosts.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vite + React SPA over Next.js | Cloudflare Pages is static-only; no server runtime needed since Convex handles backend | — Pending |
| Convex over Postgres + Liveblocks/Yjs | Realtime sync, auth, DB, and functions in one service — collapses 3 dependencies into 1, ideal for a few-week timeline | — Pending |
| Cloudflare R2 for asset storage | Convex storage is fine for small blobs; R2 is better for module assets and generated SCORM zips (cheap egress) | — Pending |
| Cloudflare Workers for compute | SCORM zip generation and signed-upload endpoints are a natural fit for edge functions; keeps SPA fully static | — Pending |
| Magic-link auth only | Simplest UX for a small team; no password management; Convex supports it natively | — Pending |
| SCORM 1.2 only (not 2004 / xAPI) | Widest LMS compatibility; simpler API surface; defer 2004/xAPI until a specific LMS demands it | — Pending |
| Lottie embed block, not animation engine | "Animations" need satisfied by dropping a Lottie JSON; building a timeline editor is an order of magnitude more work | — Pending |
| Video embeds only (YouTube/Vimeo URL) | Avoids storage + transcoding pipeline; covers the realistic need | — Pending |
| Async-with-locking dropped in favor of realtime co-edit | User explicitly chose realtime; Convex makes it cheap, so no reason to compromise | — Pending |
| Tiptap (ProseMirror) for the rich-text editor | Industry standard for collaborative rich text; well-supported React bindings; works cleanly with Convex sync model | — Pending |

## Current Milestone: v1.1 — Authoring & SCORM Bug Fix Sprint

**Goal:** Fix five production-blocking bugs in the live app — three that break exported SCORM packages in real LMS environments, and two that impair the authoring UX.

**Target fixes:**
- Gallery/carousel block broken in exported SCORM (JS init pattern fails in LMS iframe)
- Lottie animations missing in SCORM export (CDN dependency blocked by LMS CSP; R2 URL used as path)
- SCORM completion/score not reported to LMS (minimal API shim shadows real LMS API)
- Lesson title in main content area not clickable for inline rename (static h2, only pencil button works)
- Tabs block content editor missing rich text (plain textarea instead of Tiptap editor)

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-27 after initialization*

# Feature Research

**Domain:** Block-based learning module authoring tool (Rise-360-style) with SCORM 1.2 export
**Researched:** 2026-05-27
**Confidence:** HIGH (Rise 360, Storyline, Captivate, iSpring, Elucidat, EasyGenerator, dominKnow ONE, Gomo feature sets are well-documented; SCORM 1.2 spec is stable and unchanged since 2001)

## Scope Note

This document is opinionated for **Prism Learning v1** — a small-team, themed, realtime-collaborative authoring tool whose Core Value is "build a themed multi-block lesson collaboratively and export a working SCORM 1.2 zip." Categorizations reflect that scope, not "what a full enterprise Rise competitor needs." The PROJECT.md Out of Scope list is treated as binding and reinforced here.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these makes the product feel broken to anyone who has used Rise 360 or similar. These are non-negotiable for v1.

#### Authoring UX

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Block picker / "+" insert affordance | Rise's signature interaction — click between blocks, pick from a categorized list | M | Categorize: Text, Media, Interactive, Quiz, Embed. Search box once >12 blocks. |
| Drag handles to reorder blocks | Direct manipulation is the Rise mental model | M | Handle on hover at left edge; HTML5 DnD or `dnd-kit`. Need keyboard alternative (move up/down). |
| Inline rich-text editing | Click text → edit in place, no modal | M | Tiptap (already chosen). Headings, bold, italic, link, lists, callouts per PROJECT.md. |
| Autosave with visible status indicator | Users do not trust an editor without "Saved" / "Saving…" | S | Convex mutations are effectively autosave; surface state in toolbar. |
| Undo / redo | Universal expectation; Ctrl+Z muscle memory | M-L | Per-document undo stack. With realtime co-edit this is genuinely hard — scope to local-author undo of own ops (Tiptap/Y.js pattern). |
| Block-level delete + duplicate | Right-click or hover toolbar; Rise has both | S | Hover toolbar per block. |
| Lesson list / module outline sidebar | Need to see structure and jump between lessons | S | Collapsible left rail. Drag-to-reorder lessons. |
| Learner preview mode | "Show me what learners see" before publishing | M | Full-screen overlay rendering same blocks in learner runtime. Already in PROJECT.md. |
| Responsive preview (desktop / tablet / mobile toggle) | Rise's "looks great on any device" promise | S | Three-width preview frame; the actual responsive CSS does the work. |
| Module / lesson rename inline | Click title → edit | S | Trivial; expected. |
| Keyboard shortcuts for common ops | Power users expect Ctrl+S, Ctrl+Z, Ctrl+B/I, Enter to add block | S | Document them in a `?` overlay. |

#### Content Blocks (v1 set per PROJECT.md)

| Block | Why Expected | Complexity | Notes |
|-------|--------------|------------|-------|
| Rich text | The most-used block in any Rise module | M | Headings H1–H3, paragraph, bullet/numbered list, bold/italic, link, callout/note. |
| Image + caption | Universal | M | Upload to R2 via signed URL; alt text field is **mandatory** (a11y). |
| Video embed (YouTube/Vimeo URL) | Standard since 2015 | S | Parse URL → render iframe with `?rel=0` (YT). No upload pipeline. |
| Multiple-choice quiz (single answer) | The default quiz type everyone ships | M | Question, 2–6 options, mark correct, per-answer or global feedback. |
| True/False quiz | Trivial variant of MCQ; users expect both | S | Implement as constrained MCQ internally. |
| Accordion / reveal | Rise's "Labeled Graphic"-lite — chunk content | M | List of {heading, body-blocks}. Body should allow nested rich text and image at minimum. |
| Lottie embed | User-named differentiator (covers "animation" need) | S | `lottie-web` or `@lottiefiles/react-lottie-player`; loop + autoplay controls. |

#### Quizzing Behavior

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-question correct/incorrect feedback | Standard since SCORM 1.2 era | S | Two text fields per question. |
| Score aggregation across quiz blocks in a module | Required to report a single score to LMS | M | Sum correct / total; expose as percentage. Depends on SCORM API integration. |
| Pass threshold (e.g., 80%) | Every LMS expects pass/fail | S | Module-level setting; default 80%. Drives `cmi.core.lesson_status` = passed/failed. |
| Retry / reset quiz | Learners expect a second chance | S | "Try again" button resets answers locally; does not bump LMS attempt counter in v1. |
| Required-to-continue gate (optional) | Common but not universal | M | Optional per-quiz: block lesson progress until answered. v1 = supported but off by default. |

#### Theming

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Primary + accent color | Brand basics | S | Color picker; CSS variables. |
| Heading font + body font | Brand basics | M | Curated Google Fonts list (10–15) + system fallback. Self-host for SCORM export. |
| Theme applies to authoring preview AND export | **User-named differentiator** | M | Same CSS-variable tokens drive both contexts. |
| Logo upload | Universal for branded modules | S | R2 upload; rendered in module header. |
| Live preview of theme changes | Users want to see it before saving | S | Convex reactive — comes free. |

#### Realtime Collaboration (v1 scope)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Sub-second sync of edits between authors | Core promise | M | Convex queries are reactive; the work is CRDT-ish field merging for rich text via Tiptap+y.js or per-field LWW. |
| Presence indicators (who is here) | Figma/Docs pattern; users expect avatars | S | Convex presence pattern: heartbeat mutation → ephemeral table. |
| Edits don't silently clobber | Per PROJECT.md | M | Per-field LWW for structured fields; CRDT for rich text. |

#### Module Management

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Module list / dashboard | Landing page | S | Grid or list of modules with title + thumbnail/initials. |
| Create / rename / duplicate / delete module | Per PROJECT.md | S | Standard CRUD. Duplicate must deep-clone lessons + blocks. |
| Workspace member invite by email | Per PROJECT.md | M | Magic-link invite flow. |
| Soft delete with undo (toast) | Users hit Delete by accident | S | 7-day trash, or in-session undo via toast. v1 = toast-undo only is acceptable. |

#### Publishing (SCORM 1.2)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Valid `imsmanifest.xml` | The whole point of SCORM | M | Required elements: `<manifest>`, `<organizations>`, `<resources>`, `<schemaversion>1.2</schemaversion>`. |
| SCORM 1.2 JS API integration (`LMSInitialize`, `LMSSetValue`, `LMSCommit`, `LMSFinish`) | LMS requires it | M | Standard wrapper; locate `API` by walking `window.parent` per spec. |
| Report `cmi.core.lesson_status` | Required for completion tracking | S | Map to passed/failed/completed/incomplete. |
| Report `cmi.core.score.raw`, `score.min`, `score.max` | Required for graded modules | S | From aggregated quiz results. |
| Report `cmi.core.session_time` | LMS expects time-on-task | S | Timer from `LMSInitialize` to `LMSFinish`; format `HH:MM:SS.ss`. |
| Self-contained zip (assets bundled, no calls to Convex) | Per PROJECT.md; LMSs run modules offline / firewalled | M | Worker assembles zip: pulls assets from R2, inlines JSON content, ships JS runtime. |
| Passes SCORM Cloud test player | Per PROJECT.md quality bar | M | Validation is iterative; budget for manifest fixes. |
| Download as `.zip` from author UI | Standard delivery | S | Worker generates → returns signed URL or streams. |

#### Accessibility (table stakes — not optional, even though tempting to defer)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Image alt text field (required) | WCAG 1.1.1 | S | Block validation: warn if missing. |
| Keyboard navigation through learner output | WCAG 2.1.1 | M | Tab order; focus-visible styles; Enter/Space on interactive blocks. |
| Sufficient color contrast (AA) on theme presets | WCAG 1.4.3 | S | Validate user-picked colors against background; warn on bad pairs. |
| Semantic HTML in exported package | Screen reader baseline | S | Use `<h1>`–`<h3>`, `<button>`, `<details>` for accordion. |
| Captions field on video embeds | WCAG 1.2.2 — caption availability | S | YouTube/Vimeo carry CC themselves; surface "ensure CC is enabled on source" hint. |
| Mobile-responsive learner output | Per PROJECT.md | M | Single-column flow under 768px; tap targets ≥ 44px. |

### Differentiators (Competitive Advantage)

Where Prism Learning can credibly beat Rise 360 *for this user*. Differentiation should align with the Core Value: themed + realtime + fast SCORM.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **True realtime co-editing (Figma/Docs style)** | Rise 360 has "co-authoring" but it's still surprisingly clunky (auto-save lag, occasional reload-to-see-changes). Sub-second presence + edits is a real differentiator for small teams. | M | Convex makes this cheap. Marketing line: "Edit a lesson together like you would a Google Doc." |
| **Theme-everywhere with zero per-module overrides in v1** | Rise lets you override per-block, which causes brand drift. Prism's promise: change the theme once, every module re-themes. | M | Implementation discipline: no per-block color/font overrides in v1. Pure CSS-variable propagation. |
| **Magic-link-only auth, no admin overhead** | Rise/Articulate 360 require a paid seat per author with full account management. Prism: type email, click link, you're in. | S | Convex Auth supports natively. |
| **Lottie embed as first-class block** | Rise has no native Lottie support; users hack it via "Embed" code blocks. Prism makes high-quality animation drop-in. | S | Lottie ecosystem is huge (LottieFiles); zero learning curve. |
| **Fast SCORM 1.2 export (seconds, not minutes)** | Rise's publish step is famously slow (60–180s for a medium module). A Worker-based zip pipeline can return in <10s. | M | Pre-bake static runtime; zip is mostly content JSON + asset copies from R2. |
| **Block-level live preview without leaving authoring** | Rise requires entering preview mode. Prism could render learner-accurate blocks inline. | S | Same renderer in both modes; preview just hides editing chrome. |
| **Opinionated, curated block set (7 blocks, not 30)** | Rise has 40+ block variants which paralyzes new users. Prism's narrow set is faster to learn. | — | This is a *positioning* differentiator — already built into PROJECT.md scope. |
| **One-zip-per-module, no project files** | Rise stores authoring data in proprietary `.rise` files. Prism stores in Convex; export is pure SCORM output. | — | Already implied by architecture. Worth marketing. |
| **Workspace theme tokens visible as CSS variables in exported package** | Power users can hand-tweak exported CSS if needed (escape hatch). | S | Don't hide; expose `--prism-color-primary` etc. |
| **Self-contained, dependency-free SCORM output** | Many exports phone home for fonts/analytics. Prism's runs in an air-gapped LMS. | M | Bundle fonts as woff2 in the zip; no external network. |

### Anti-Features (Deliberately NOT Built)

This section combines PROJECT.md's existing Out of Scope list with newly-identified traps from competitor analysis.

#### Already in PROJECT.md Out of Scope (reinforced here)

| Feature | Why Requested | Why Problematic for v1 | Alternative |
|---------|---------------|------------------------|-------------|
| Audio / narration block | Rise has it; common request | Upload pipeline + waveform UI + timing semantics; weeks of work | Defer to v2; v1 users can embed a video instead. |
| Video upload (host our own) | "Don't make me use YouTube" | Storage + transcoding (HLS/DASH) is multi-week | YouTube/Vimeo embed covers 90% of need. |
| Drag-and-drop / matching interactions | Rise has them; "real interactivity" | Authoring UX is complex; SCORM scoring rules thorny | MCQ + T/F cover assessment for v1. |
| Flip cards | Rise has them | Visual duplication of accordion | Accordion satisfies the reveal-on-click need. |
| Per-block scroll animations / transitions | "Make it feel modern" | Requires custom animation system | Lottie embed satisfies the animation need. |
| Custom animation timeline editor | Storyline/Captivate parity | Order of magnitude more work than rest of v1 combined | Lottie embed. |
| SCORM 2004 / xAPI export | Forward-compat | More complex API, less universal | SCORM 1.2 first; revisit when an LMS demands it. |
| Branching / draft-review-publish workflow | Enterprise pattern | Not needed for small trusting team | Realtime co-edit replaces it. |
| Multi-tenant SaaS (public signup, billing) | "Could we sell it?" | Out of charter; auth/billing/abuse load | Internal-tool only. |
| Mobile authoring | Convenience | Authoring UX on touch is its own product | Desktop-only authoring; mobile-responsive *output* only. |
| Offline authoring | Resilience | Convex requires connectivity | Acceptable trade-off for v1. |
| LMS integration beyond export | "Auto-publish to our LMS" | LMS APIs vary wildly (Moodle, Canvas, SCORM Cloud, …) | SCORM zip is the integration. |

#### Newly Identified Anti-Features (not in PROJECT.md)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Comments / mentions on blocks** | "Like Figma" | Requires notification system, unread state, mention-resolution, email — sprawling | Realtime presence + voice chat in their own tool. Add in v2 if asked. |
| **Version history / time-travel** | "We need to revert" | Storage cost + UI cost for diffing block trees; rarely used in practice | Soft-delete + duplicate-as-backup before risky edits. |
| **Templates / template marketplace** | Rise has them | Curation overhead; one team doesn't need a marketplace | Duplicate an existing module as a template. |
| **Question banks / randomization across attempts** | "Real assessment" | Requires bank UI, per-attempt state, SCORM 1.2 has weak attempt tracking | Author writes the quiz they want; randomize answer *order* per render only. |
| **Per-block color / font overrides** | "Designers want fine control" | Defeats the "theme everywhere" differentiator; causes brand drift | Theme-only; if you need a custom color, change the theme. |
| **Tags / folders / advanced search** | Library hygiene | Premature for ≤50 modules | Flat list + title search is enough for small teams. |
| **Password-protected preview links / external sharing** | "Share with a stakeholder" | Auth surface, link expiry, abuse vector | Export to SCORM Cloud test player for stakeholder review; or screen-share. |
| **Per-question detailed feedback with rich text and images** | "Better learning loops" | Block-in-block editing is hard; rich-text-in-rich-text confuses users | Plain-text feedback per question. |
| **Multiple correct answers (MCQ multi-select)** | Common quiz feature | Adds scoring semantics ("all correct? partial credit?") | Use multiple single-answer questions. v2 candidate. |
| **Survey / rating / Likert blocks** | "We want feedback from learners" | Not a SCORM-natural concept; needs a separate analytics destination | Use a real survey tool (Typeform) linked from the module. |
| **Custom CSS / HTML embed block** | Power users | Security (XSS), exported-package safety, breaks theming guarantee | Lottie embed + curated blocks. |
| **Built-in image editor (crop, filters, annotations)** | Convenience | Pixel-editing is a whole product | Users edit in their tool of choice, then upload. |
| **AI authoring assist (generate quiz from text)** | Trend | Model choice + cost + quality risk + scope explosion | Out of scope for v1; could be a v2 differentiator. |
| **Learner analytics dashboard inside Prism** | "How are people doing?" | The LMS is the source of truth for learner data; SCORM 1.2 reports back there | LMS does this. Don't duplicate it. |
| **Multiple themes per workspace / per-module theme selection** | "Different brands per module" | Doubles the theme model complexity | One theme per workspace in v1. Add a per-module theme override in v2 if needed. |

## Feature Dependencies

```
Auth (magic link)
    └──> Workspace + membership
              └──> Module CRUD
                        └──> Lesson CRUD
                                  └──> Block CRUD
                                            ├──> Rich text block ──> Tiptap editor
                                            ├──> Image block ──> R2 upload (signed URL via Worker)
                                            ├──> Video embed ──> URL parser
                                            ├──> Lottie block ──> R2 upload + lottie-web
                                            ├──> Accordion ──> recursive block render
                                            └──> Quiz blocks (MCQ, T/F)
                                                      └──> Score aggregation
                                                                └──> SCORM API wrapper
                                                                          └──> SCORM zip export

Theme (workspace-level CSS variables)
    ├──enhances──> All block rendering (authoring preview)
    └──enhances──> SCORM export runtime CSS

Realtime sync (Convex reactive queries)
    ├──enhances──> Block CRUD (multi-author edits)
    ├──enhances──> Presence indicators
    └──requires──> Per-field merge strategy (LWW for structured, CRDT for rich text)

Learner preview
    └──requires──> Same block renderer as SCORM runtime
              └──enables──> "Preview matches export" guarantee

SCORM zip export
    ├──requires──> Static block renderer bundle (built once, copied per export)
    ├──requires──> Asset packaging from R2 (Worker)
    ├──requires──> imsmanifest.xml generator
    └──requires──> SCORM 1.2 API wrapper
              └──requires──> Score aggregation (which requires quiz blocks)
```

### Dependency Notes

- **SCORM export requires the learner runtime to be a buildable, embeddable artifact** — not just React components rendered live. This argues for splitting the renderer into its own package/bundle target early.
- **Score aggregation is the bridge between quiz blocks and SCORM** — quizzes are useless without it. Don't ship quiz blocks in one phase and aggregation in a later phase; pair them.
- **Theme-everywhere requires the renderer to be shared** between authoring preview and export. If they diverge, the differentiator dies. Architectural priority.
- **Realtime sync depends on the merge strategy decision being made before block schemas are finalized** — retrofitting CRDT into structured data is painful.
- **Image / Lottie blocks depend on the R2 signed-upload path being built first.** That path is a Worker endpoint; build it once, reuse for both blocks.
- **Magic-link auth must exist before workspace invite flow** — invite emails *are* magic links to a pre-provisioned membership row.
- **Accessibility (alt text, contrast warnings) is cheaper to build into block schemas from day one** than to retrofit. Treat as a baseline constraint, not a phase.

## MVP Definition

### Launch With (v1) — matches PROJECT.md Active list

Minimum viable Prism Learning. If any of these slip, v1 is not v1.

- [ ] **Magic-link auth + workspace membership** — without auth, nothing else has a home
- [ ] **Module + lesson + block CRUD** — the spine of the editor
- [ ] **7 block types** (rich text, image+caption, video embed, MCQ, T/F, accordion, Lottie) — per PROJECT.md
- [ ] **Realtime sync + presence** — the core differentiator
- [ ] **Theme (colors + fonts + logo)** — the other core differentiator
- [ ] **Learner preview mode** — required to trust what's being authored
- [ ] **SCORM 1.2 export passing SCORM Cloud validation** — the deliverable
- [ ] **Quiz score → SCORM API reporting** — a SCORM module without scoring is useless
- [ ] **Mobile-responsive learner output** — per PROJECT.md
- [ ] **Image alt text + AA contrast warning** — accessibility minimum that costs almost nothing

### Add After Validation (v1.x — small follow-ups once v1 is in real use)

- [ ] **Soft-delete trash / 7-day recovery** — once a real module gets deleted by accident
- [ ] **Module search by title** — once the module list exceeds ~20
- [ ] **Keyboard-shortcut help overlay (`?`)** — once power users emerge
- [ ] **Block-level undo across collaborators** — once two-author conflicts hurt
- [ ] **Per-question randomization of answer order** — cheap, mild fairness improvement
- [ ] **"Required to continue" toggle on quizzes** — once an instructional designer asks
- [ ] **Module duplication as a way to template** — covers the "templates" need without a marketplace

### Future Consideration (v2+)

- [ ] **Audio / narration block** — when a real user blocks on it
- [ ] **Drag-and-drop interaction block** — when MCQ assessment proves insufficient
- [ ] **SCORM 2004 / xAPI export** — when an LMS rejects 1.2
- [ ] **Comments / mentions** — when async review becomes the bottleneck
- [ ] **Multi-correct MCQ** — when quiz richness matters
- [ ] **Multiple themes per workspace** — when a second brand appears
- [ ] **AI authoring assist (quiz-from-text, alt-text generation)** — when foundation is stable
- [ ] **Version history** — when "we shipped a bad edit" happens twice

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Magic-link auth | HIGH | LOW | P1 |
| Module / lesson / block CRUD | HIGH | MEDIUM | P1 |
| Rich text block | HIGH | MEDIUM | P1 |
| Image + caption block | HIGH | MEDIUM | P1 |
| Video embed block | HIGH | LOW | P1 |
| MCQ quiz block | HIGH | MEDIUM | P1 |
| T/F quiz block | HIGH | LOW | P1 |
| Accordion block | MEDIUM | MEDIUM | P1 |
| Lottie embed block | MEDIUM | LOW | P1 (differentiator) |
| Realtime sync + presence | HIGH | MEDIUM | P1 (differentiator) |
| Workspace theme (color/font/logo) | HIGH | MEDIUM | P1 (differentiator) |
| Learner preview | HIGH | MEDIUM | P1 |
| SCORM 1.2 export + manifest | HIGH | MEDIUM | P1 |
| SCORM API quiz score reporting | HIGH | MEDIUM | P1 |
| Mobile-responsive learner output | HIGH | MEDIUM | P1 |
| Image alt text (required field) | MEDIUM | LOW | P1 |
| Color contrast warning | MEDIUM | LOW | P1 |
| Autosave indicator | MEDIUM | LOW | P1 |
| Block duplicate / delete | MEDIUM | LOW | P1 |
| Module duplicate | MEDIUM | LOW | P1 |
| Workspace member invite | HIGH | MEDIUM | P1 |
| Undo / redo (single-author local) | MEDIUM | MEDIUM | P2 |
| Soft delete / trash | MEDIUM | LOW | P2 |
| Module search | LOW | LOW | P2 |
| Keyboard shortcut overlay | LOW | LOW | P2 |
| Required-to-continue quiz gate | LOW | LOW | P2 |
| Answer-order randomization | LOW | LOW | P2 |
| Comments / mentions | MEDIUM | HIGH | P3 |
| Version history | LOW | HIGH | P3 |
| Templates / marketplace | LOW | HIGH | P3 |
| Audio block | MEDIUM | HIGH | P3 |
| Drag-and-drop block | MEDIUM | HIGH | P3 |
| SCORM 2004 / xAPI | LOW | HIGH | P3 |
| AI authoring assist | MEDIUM | HIGH | P3 |
| Multi-tenant SaaS | n/a | HIGH | Anti-feature |
| Mobile authoring | LOW | HIGH | Anti-feature |
| Per-block theme overrides | LOW | MEDIUM | Anti-feature |
| Custom HTML/CSS embed | LOW | LOW | Anti-feature (security) |

**Priority key:**
- P1: Must ship for v1 (matches PROJECT.md Active)
- P2: Add post-v1 once real use surfaces the need
- P3: v2+ candidates

## Competitor Feature Analysis

| Feature | Rise 360 | Storyline / Captivate | iSpring / EasyGenerator | Prism Learning v1 |
|---------|----------|----------------------|------------------------|-------------------|
| Block-based authoring | ✅ canonical | ❌ slide-based | ✅ (mostly) | ✅ |
| Realtime co-edit | ⚠️ partial (lags, reload required) | ❌ | ❌ | ✅ **(true realtime)** |
| Theming | ✅ per-course | ✅ per-course | ✅ | ✅ **workspace-wide, no per-block override** |
| Block count | 40+ variants | 100+ via timeline | 20–30 | **7 (opinionated)** |
| Quiz types | MCQ, T/F, fill-in, matching, sequence, hotspot | All of those + custom | MCQ, T/F, matching, fill-in | **MCQ + T/F only** |
| Animation | Limited (scroll reveals) | Full timeline editor | Limited | **Lottie embed** |
| Audio | ✅ block + narration | ✅ timeline | ✅ | ❌ (v2) |
| Video | ✅ upload + embed | ✅ upload + embed | ✅ upload + embed | **Embed only (YT/Vimeo)** |
| SCORM 1.2 export | ✅ | ✅ | ✅ | ✅ |
| SCORM 2004 / xAPI | ✅ | ✅ | ✅ | ❌ (v2) |
| Auth | Articulate account (paid seat) | Local install / Articulate account | Vendor account | **Magic link** |
| Pricing model | $1k–1.5k/yr/user | $1.4k+/yr/user | $770+/yr/user | **Internal tool** |
| Comments / review | ✅ Articulate Review 360 | ⚠️ via Review 360 | ✅ | ❌ |
| Templates | ✅ | ✅ extensive | ✅ | ❌ (duplicate-as-template) |
| Mobile responsive output | ✅ | ⚠️ depends on author | ✅ | ✅ |
| Self-contained SCORM zip | ✅ | ✅ | ✅ | ✅ |
| Export speed (medium module) | 60–180s | minutes | 30–90s | **Target <10s** |

## Sources

- **Rise 360 product documentation** — articulate.com/360/rise (block types, theming model, publish flow). Confidence: HIGH.
- **Articulate Storyline 360 / Adobe Captivate documentation** — feature parity baselines for slide-based competitors. Confidence: HIGH.
- **iSpring Suite, EasyGenerator, Elucidat, dominKnow ONE, Gomo public feature pages** — used to triangulate "table stakes" — features that *every* mid-market tool ships. Confidence: HIGH.
- **SCORM 1.2 Run-Time Environment specification (ADL)** — `cmi.core.*` data model elements that exported packages must populate. Stable since 2001. Confidence: HIGH.
- **IMS Content Packaging 1.1.4 spec** — `imsmanifest.xml` schema for SCORM 1.2 packages. Confidence: HIGH.
- **WCAG 2.1 AA** — accessibility minimums driving the alt-text-required and contrast-warning calls. Confidence: HIGH.
- **PROJECT.md (Prism Learning, 2026-05-27)** — binding v1 scope and Out of Scope; this document defers to it on conflicts.
- **Common community reports (Articulate community forum, Reddit r/instructionaldesign)** — used for "what users complain about in Rise" → became the differentiator targets (publish speed, per-block override drift, co-edit lag). Confidence: MEDIUM (anecdotal but consistent).

---
*Feature research for: Rise-360-style learning module authoring tool*
*Researched: 2026-05-27*

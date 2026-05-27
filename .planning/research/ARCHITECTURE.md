# Architecture Research

**Domain:** Block-based learning module authoring tool (Rise-360-style), realtime collaborative, SCORM 1.2 export
**Researched:** 2026-05-27
**Confidence:** HIGH (stack is locked; decisions derive from stack constraints and well-understood patterns)

## Stack Recap (locked)

Vite + React SPA on Cloudflare Pages · Convex (auth/DB/realtime/functions) · Cloudflare R2 (large assets, export zips) · Cloudflare Workers (compute/edge) · Tiptap editor · magic-link auth · SCORM 1.2 export.

---

## System Overview

```
                           ┌──────────────────────────┐
                           │  Author's Browser (SPA)  │
                           │  Vite + React            │
                           │ ┌──────────────────────┐ │
                           │ │ Authoring UI         │ │
                           │ │  • Tiptap editor     │ │
                           │ │  • Block list        │ │
                           │ │  • Preview pane ─────┼─┼──┐
                           │ │  • Theme controls    │ │  │ imports
                           │ │  • Presence/cursors  │ │  │
                           │ └──────────────────────┘ │  │
                           │ ┌──────────────────────┐ │  │
                           │ │ @prism/renderer ◄────┼─┼──┘ (shared)
                           │ │ pure React, no I/O   │ │
                           │ └──────────────────────┘ │
                           └────────┬─────────────────┘
                                    │  WebSocket (reactive queries + mutations)
                                    │  HTTPS (R2 PUT direct upload)
                                    │  HTTPS (Worker: export, presign)
                                    │
        ┌───────────────────────────┼────────────────────────────────┐
        │                           │                                │
        ▼                           ▼                                ▼
┌───────────────┐         ┌────────────────────┐         ┌────────────────────┐
│  Convex       │         │ Cloudflare Worker  │         │ Cloudflare R2      │
│               │         │  (edge compute)    │         │  (object storage)  │
│ • Auth        │         │                    │         │                    │
│ • Schema/DB   │◄────────┤ • SCORM export     │────────►│ • assets/...       │
│ • Realtime    │ reads   │ • R2 presign       │ writes  │ • exports/...      │
│ • Mutations   │ blocks  │ • Webhook handler  │ zip     │ • lottie/...       │
│ • Actions     │ + assets│   (R2→Convex on    │         │                    │
│ • Functions   │ meta    │   upload done)     │         │ Signed GET URLs    │
└───────────────┘         └────────────────────┘         │ for browser reads  │
                                                          └────────────────────┘
```

### Component Responsibilities

| Component | Owns | Does NOT own |
|-----------|------|--------------|
| **SPA (Vite + React)** | Authoring UI, Tiptap editor instance, preview rendering, optimistic edits, theme variable injection, SCORM zip download trigger | Persistence, auth state mint, asset bytes, export generation |
| **`@prism/renderer` package** | Pure React component tree that maps a typed `Block[]` + `Theme` to DOM. No fetch, no Convex, no auth. | Editing, persistence, asset URL resolution (URLs are passed in as props) |
| **Convex** | Auth (magic link), workspace/user/module/lesson/block schema, reactive queries, mutations with optimistic concurrency, server functions for invariants (e.g. block ordering), asset *metadata* (id, r2Key, mime, size). | Storing large asset bytes, generating zip files, long-running CPU work |
| **R2** | Authoritative storage for assets (images, Lottie JSON) and generated SCORM zips. Keyed `workspaces/{wsId}/assets/{assetId}` and `workspaces/{wsId}/exports/{exportId}.zip`. | Authorization decisions (Worker does this), metadata, ordering |
| **Worker** | (1) Mint short-lived presigned R2 PUT URLs after Convex authorizes; (2) Run SCORM export — fetch module from Convex, fetch asset bytes from R2, build manifest + runtime, zip, write back to R2, notify Convex; (3) Optional R2 event webhook → Convex to mark asset `ready`. | Long-term state, auth tokens |

### Critical Seams (where complexity lives)

1. **SPA ↔ Convex (Tiptap doc ↔ Convex doc).** The bridge between Tiptap's in-memory editor state and the Convex `blocks` table. This is the single highest-risk seam — see Realtime Sync below.
2. **SPA ↔ R2 (asset bytes).** Bytes must never traverse Convex. The Convex-authorize → Worker-presign → browser-PUT-direct dance must be airtight or you'll either lose authorization or eat egress costs.
3. **`@prism/renderer` purity boundary.** The renderer MUST NOT import Convex, fetch, or auth. If it does, the SCORM export breaks because the export bundle has no backend. This is enforced by package-level lint rules.
4. **Theme tokens.** Same tokens must drive (a) authoring CSS variables at runtime and (b) a static `<style>` block in the exported HTML. One source of truth in the renderer package.
5. **SCORM runtime ↔ LMS API.** Quiz blocks need a tiny adapter that talks `window.parent.API.LMSSetValue(...)`. This is a separate concern from the renderer and only activates in export mode.

---

## Convex Data Model

Convex schema sketches. Convex uses `Id<"table">` for typed FKs. All tables get `_id` and `_creationTime` automatically.

```ts
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),                 // unique, for URLs
    ownerId: v.id("users"),
    theme: v.object({
      primary: v.string(),            // hex
      accent: v.string(),
      headingFont: v.string(),        // e.g. "Inter"
      bodyFont: v.string(),
    }),
  }).index("by_slug", ["slug"]),

  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  }).index("by_email", ["email"]),

  memberships: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("editor")),
    invitedBy: v.optional(v.id("users")),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_workspace_user", ["workspaceId", "userId"]),

  modules: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    description: v.optional(v.string()),
    coverAssetId: v.optional(v.id("assets")),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  }).index("by_workspace", ["workspaceId"]),

  lessons: defineTable({
    moduleId: v.id("modules"),
    title: v.string(),
    order: v.number(),                // fractional-index string would be safer; see note below
  }).index("by_module_order", ["moduleId", "order"]),

  blocks: defineTable({
    lessonId: v.id("lessons"),
    moduleId: v.id("modules"),        // denormalized for cheap module-scoped queries
    order: v.number(),                // fractional index recommended (e.g. lexorank string)
    type: v.union(
      v.literal("richText"),
      v.literal("image"),
      v.literal("videoEmbed"),
      v.literal("quizMc"),
      v.literal("quizTf"),
      v.literal("accordion"),
      v.literal("lottie"),
    ),
    // Per-type data. Tiptap richText stored as ProseMirror JSON.
    data: v.any(),                    // see Block payloads below
    updatedAt: v.number(),
    updatedBy: v.id("users"),
    editingBy: v.optional(v.id("users")),  // soft "someone is in this block" hint
    editingExpiresAt: v.optional(v.number()),
  })
    .index("by_lesson_order", ["lessonId", "order"])
    .index("by_module", ["moduleId"]),

  assets: defineTable({
    workspaceId: v.id("workspaces"),
    r2Key: v.string(),                // workspaces/{wsId}/assets/{assetId}.{ext}
    mime: v.string(),
    sizeBytes: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    status: v.union(v.literal("pending"), v.literal("ready"), v.literal("failed")),
    uploadedBy: v.id("users"),
  }).index("by_workspace", ["workspaceId"]),

  exports: defineTable({
    moduleId: v.id("modules"),
    workspaceId: v.id("workspaces"),
    requestedBy: v.id("users"),
    status: v.union(
      v.literal("queued"),
      v.literal("building"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    r2Key: v.optional(v.string()),    // workspaces/{wsId}/exports/{exportId}.zip
    sizeBytes: v.optional(v.number()),
    error: v.optional(v.string()),
    moduleSnapshot: v.any(),          // frozen JSON of module at export time (audit + reproducibility)
  }).index("by_module", ["moduleId"]),

  presence: defineTable({
    moduleId: v.id("modules"),
    userId: v.id("users"),
    cursor: v.optional(v.object({ blockId: v.id("blocks"), pos: v.number() })),
    lastSeen: v.number(),
  }).index("by_module", ["moduleId"]),
});
```

### Block payload shapes (TypeScript, not Convex validators)

```ts
type RichTextData   = { doc: ProseMirrorJSON };
type ImageData      = { assetId: Id<"assets">; alt: string; caption?: string };
type VideoEmbedData = { provider: "youtube" | "vimeo"; url: string; title?: string };
type QuizMcData     = {
  question: ProseMirrorJSON;
  choices: { id: string; text: string; isCorrect: boolean; feedback?: string }[];
};
type QuizTfData     = { question: ProseMirrorJSON; correct: boolean; feedbackTrue?: string; feedbackFalse?: string };
type AccordionData  = { sections: { id: string; title: string; body: ProseMirrorJSON }[] };
type LottieData     = { assetId: Id<"assets">; loop: boolean; autoplay: boolean };
```

### Schema notes
- **Ordering:** `order: v.number()` is the simplest start, but with realtime co-edit two authors reordering can collide. Strongly recommend a fractional-index string (lexorank/`fracdex`) in the same field once the first reordering bug hits. Defer until then.
- **`editingBy`** is a soft hint for UI ("Alice is editing this block"), NOT a lock. Co-editing is still allowed; this just powers the avatar dot.
- **Per-block granularity** is the key choice. Each block is its own document, so realtime updates are scoped tightly (see sync strategy).

---

## Realtime Sync Strategy

### Decision: **Option A — Convex reactive queries with per-block (and within-richText, per-field) last-writer-wins.** No CRDT, no Y.js.

### Why not the others

- **Option B (Y.js + Convex provider).** Y.js is the right answer for character-level concurrent editing of a single rich-text document with multi-author cursor merging. But:
  - There is no first-party Convex Y.js provider. You'd build one against Convex's mutation API, which means re-implementing an awareness/sync protocol on top of a system that already has reactive sync. That's reinventing a wheel inside another wheel.
  - The product requirement is "edits never silently overwrite each other (last-writer-wins is acceptable per-field if cleanly scoped)" — explicitly permits LWW. Y.js solves a harder problem than is being asked.
  - CRDT doc state ballooning across blocks (each block becomes a Y.Doc) plus Convex-as-transport adds two non-trivial subsystems on the critical path to v1.
- **Option C (Tiptap Collaboration + custom Convex transport).** Same problem as B — Tiptap Collaboration is a Y.js wrapper. Same reasoning rejects it. The hosted Tiptap Collab Cloud is also a paid service, which the constraint "everything on Convex + Cloudflare" forbids.

### How Option A works

1. **Per-block subscription.** The editor subscribes to `query.blocks.byLesson({ lessonId })`. Convex pushes a new array whenever any block changes. This is the realtime channel — no WebSocket plumbing of our own.
2. **Tiptap is mounted per block** (for rich-text and accordion-section richtext sub-fields). Tiptap's local editor state is the source of truth *while the user is typing*; on `onUpdate` (debounced ~300ms) the SPA fires `mutation.blocks.updateRichText({ blockId, doc, baseUpdatedAt })`.
3. **Optimistic concurrency.** Mutation compares `baseUpdatedAt` to the row's current `updatedAt`. On mismatch, the mutation **still wins** (LWW) but emits a `conflictDetected` event so the UI can flash a "your edit overwrote Bob's — undo?" toast. This satisfies "never silently overwrite" — the user is notified.
4. **Field-scoped LWW.** Different fields on the same block don't collide: editing a quiz's `question` doesn't fight with editing its `choices[2].feedback`. Mutations target the smallest field possible (e.g., `mutation.blocks.updateQuizChoice`).
5. **Reactive query re-merges.** When a remote update arrives via the subscription, the SPA reconciles: if the user is *not currently focused* on that block, the Tiptap content is replaced with the new ProseMirror JSON. If the user IS focused, the remote update is queued until blur (or applied with `dispatchTransaction` if it's a different field).
6. **Presence** lives in the `presence` table with a heartbeat mutation every 5s and `lastSeen`-based stale eviction in queries.

### Tradeoff acknowledged
Two authors typing in the same paragraph of the same rich-text block within the 300ms debounce window will produce one winner. The losing edit is preserved in the toast for one-click restore. This is the v1 ceiling and matches the stated requirement.

### Upgrade path
If character-level concurrent editing of the same block becomes a real complaint, Y.js can be retrofit *per block* later: change `data` to store a Y.js update vector, build a Convex-backed `Y.Doc` provider. The block-level boundaries chosen above mean this upgrade does not require re-architecting — only swapping the rich-text block's data layer.

---

## Asset Upload Flow

### Decision: **Convex-authorized, Worker-presigned, browser-direct-to-R2.** Bytes never touch Convex or the Worker.

```
[Author drops image]
    │
    ▼
SPA: mutation `assets.createPending({ workspaceId, mime, sizeBytes })`
    │   Convex checks membership, inserts assets row (status=pending),
    │   returns { assetId, r2Key }
    ▼
SPA: POST /presign  →  Worker
    │   { assetId, r2Key, convexAuthToken }
    │
    │   Worker validates token by calling Convex action
    │   `assets.authorizeUpload({ assetId })` which re-checks
    │   membership + asset is still pending.
    │
    │   Worker signs an R2 PUT URL (S3-compatible, 5-min TTL,
    │   content-type + content-length-range pinned).
    │   Returns { uploadUrl }
    ▼
SPA: PUT bytes directly to R2 via uploadUrl
    │   (progress bar via XHR/fetch streaming)
    ▼
On 200: SPA: mutation `assets.markReady({ assetId, width, height })`
    │   Convex flips status to "ready".
    ▼
Block referencing assetId now renders.
```

### Why this shape

- **Convex storage rejected for large assets.** Convex's built-in file storage works but the product requires bundling assets into an exported SCORM zip — fetching them from Convex storage means Convex egress on every export. R2 egress is free to Cloudflare Workers, so the export Worker reads R2 directly. Putting bytes in Convex would also push toward Convex's storage pricing for what is fundamentally a CDN-shaped workload.
- **Worker presign over Convex presign.** R2 is S3-compatible and signing is a Worker-native operation (`aws4fetch` or similar). Convex doesn't natively sign R2 URLs. Adding it inside a Convex action is possible but the Worker is the natural home for any R2-touching credential.
- **Two-step (createPending → markReady) over single-step.** The pending row gives the UI a real `assetId` immediately for optimistic rendering and lets the block reference an asset that hasn't finished uploading (shows a spinner). Also lets a Worker-side R2 event webhook flip status if the SPA crashes mid-upload.

### Reads
For learner-preview and authoring, R2 returns signed GET URLs (5-min TTL) minted by a Worker route `GET /asset/:assetId`. For the exported SCORM zip, the Worker pulls bytes directly into the zip — no signed URLs needed because the zip is self-contained.

---

## Shared Renderer Architecture

### Decision: **Monorepo package `@prism/renderer`, pure React, consumed by both the SPA and the SCORM export bundle.**

```
learnflow/
├── apps/
│   ├── web/                  # The Vite + React SPA (authoring)
│   └── scorm-runtime/        # Vite build that produces the embedded SCORM HTML
├── packages/
│   ├── renderer/             # @prism/renderer  — THE SHARED PIECE
│   │   ├── src/blocks/       # <RichTextBlock/>, <ImageBlock/>, ...
│   │   ├── src/theme.ts      # tokens → CSS variables
│   │   ├── src/types.ts      # Block, Module, Theme types (single source of truth)
│   │   └── src/Module.tsx    # <Module blocks={...} theme={...} resolveAsset={...} />
│   └── scorm/                # @prism/scorm — manifest builder, SCORM 1.2 JS adapter
└── workers/
    └── export/               # SCORM export Worker
```

### Purity rules (enforced by ESLint `no-restricted-imports`)

- `@prism/renderer` must NOT import `convex/*`, `fetch`, `window.*` beyond DOM, or any auth code.
- All I/O is dependency-injected via props: `resolveAsset(assetId): string` returns a URL. In the SPA it returns a Worker-signed R2 URL; in the SCORM bundle it returns a relative path like `assets/img-123.png`.
- All theme is dependency-injected: `<Module theme={...}>` writes CSS variables to a scoped root.

### Why not alternatives

- **Build-time inlining of authoring components into SCORM.** Possible, but the authoring components depend on Tiptap, drag-handles, Convex hooks — none of which belong in a learner-facing static export. The renderer must be a separate, leaner artifact.
- **Web component wrapper.** Adds shadow DOM complexity for no win. The SCORM zip is its own document; no isolation needed.
- **Render-to-string at export time, ship dead HTML.** Tempting, but quiz blocks need runtime interactivity (state, scoring, LMS API calls). So a JS bundle ships either way. Given that, ship the same React renderer.

### Versioning
Exports record `rendererVersion` in `moduleSnapshot`. Old exports remain reproducible from snapshot + a pinned renderer build. Future v2 renderer changes don't invalidate v1 zips already deployed in LMSes (those zips are self-contained anyway).

---

## SCORM Export Flow

### Decision: **Worker-side export.** Not client-side JSZip.

```
[Author clicks Export]
    │
    ▼
SPA: mutation `exports.request({ moduleId })`
    │   Convex creates exports row (status=queued),
    │   schedules action `exports.runBuild({ exportId })`
    │   which calls the Worker via HTTP with a one-shot token.
    ▼
Worker: GET module + lessons + blocks from Convex (action `exports.fetchSnapshot`)
    │   Convex returns frozen JSON + list of asset r2Keys
    │
    ▼
Worker: stream-fetch each asset from R2 (free intra-Cloudflare egress)
    │
    ▼
Worker: assemble zip in memory using fflate (streaming, low-mem)
    │   ├── index.html         (boots @prism/scorm-runtime bundle)
    │   ├── runtime.js          (pre-built, pinned version)
    │   ├── runtime.css
    │   ├── module.json         (the moduleSnapshot)
    │   ├── assets/             (image, lottie bytes)
    │   ├── theme.css           (generated from workspace.theme)
    │   └── imsmanifest.xml     (built from @prism/scorm builder)
    ▼
Worker: PUT zip to R2 at workspaces/{wsId}/exports/{exportId}.zip
    │
    ▼
Worker: action `exports.markReady({ exportId, r2Key, sizeBytes })`
    │
    ▼
SPA: reactive query sees status=ready, shows "Download" button
    │   Download = Worker-signed GET URL to R2 (5-min TTL)
```

### Why Worker, not client JSZip

- **Self-containment requirement.** The zip must include the runtime JS bundle, which lives in `apps/scorm-runtime/dist/`. Shipping that bundle to the SPA *just to re-zip it* is wasteful and bloats the SPA.
- **Asset bytes.** A 50MB module with Lottie + images would force the browser to fetch each asset from R2 (with auth) then zip in-memory. The Worker fetches from R2 with zero egress cost and streams.
- **CPU/memory.** Worker CPU limits (30s on paid, 10ms-50ms wall + isolate budget) are tight but sufficient for a few-MB zip via streaming `fflate`. For larger modules, the Worker can chunk-upload to R2 using multipart. Browser zipping in a tab is *less* predictable than a Worker.
- **Reproducibility.** The `moduleSnapshot` is frozen at request time, so re-exporting yields the same zip. Client-side export is non-deterministic across browsers.

### SCORM 1.2 specifics baked into `@prism/scorm`
- `imsmanifest.xml` with `<schemaversion>1.2</schemaversion>`, single SCO, organization tree from lessons.
- `runtime.js` includes an `API` finder (`window.parent.API`, walks up frames) and wraps `LMSInitialize/LMSSetValue/LMSCommit/LMSFinish`.
- Quiz blocks call `cmi.core.score.raw`, `cmi.core.lesson_status`, `cmi.interactions.n.*`.

---

## Theme Propagation

### Decision: **CSS variables, one source of truth in `@prism/renderer/theme.ts`, baked into export as a static `theme.css`.**

```
Convex workspaces.theme  ──────┐
  { primary, accent, ... }     │
                                ▼
                  packages/renderer/theme.ts
                  tokensToCss(theme): string
                                ▼
          ┌─────────────────────┴─────────────────────┐
          │                                             │
   Authoring (runtime)                       Export (build-time)
   <ThemeProvider theme={t}>                  Worker writes
   sets :root { --primary: ... }              theme.css with
   via inline <style>                          same tokens
                                               <link rel="stylesheet"
                                                  href="theme.css">
```

- All renderer components use `var(--prism-primary)`, never raw colors. ESLint rule forbids hex literals in `@prism/renderer/src/blocks/`.
- Theme change in authoring → reactive query → CSS variables update → entire preview re-themes with zero re-render.
- Theme change does NOT invalidate prior exports (they have their own baked `theme.css`). Authors must re-export to propagate to LMS-uploaded modules. This is the intended semantics ("changing the theme updates all modules without re-authoring" — re-authoring is not required, but re-export is).

---

## Failure Modes by Component

| Failure | Symptom | System response | User experience |
|---------|---------|-----------------|-----------------|
| **R2 down** | Asset GETs 5xx, exports can't write | SPA shows broken-image placeholder w/ retry; export marked `failed` with retryable error | Existing modules without new images still editable; new uploads queue locally and retry on R2 recovery |
| **Convex down** | WebSocket disconnect, mutations fail | Convex client buffers mutations, retries on reconnect (built-in). SPA shows "Reconnecting…" banner | Edits made offline replay on reconnect, but reordering may conflict — show LWW toast if it does |
| **Worker timeout (export)** | Export stuck in `building` | Convex action sets a 60s deadline; on miss, marks `failed` with "export too large" | User sees failure, can retry. Future: chunked export across multiple Worker invocations using R2 multipart |
| **Auth token expires mid-edit** | Mutation 401s | Convex client auto-refreshes magic-link session; if refresh fails, route to /signin and replay buffered mutations after re-auth | Worst case: one toast, re-sign in via magic link, edits resume |
| **Worker presign call fails** | New uploads can't start | SPA shows "upload failed, retry" | Existing assets unaffected; user retries |
| **R2 PUT succeeds but `markReady` fails** | Orphan `pending` asset row | Worker-side R2 event webhook (later phase) reconciles by calling `assets.markReady` from R2's upload event | First-tier mitigation: SPA retries `markReady` on next page load if it sees own `pending` rows |
| **Tiptap update lost (network flake mid-debounce)** | Last 300ms of typing not saved | Tiptap state is local until `onUpdate` fires; Convex client retries the mutation. Worst case the user sees their text "snap back" briefly | Acceptable for v1. Mitigated by short debounce |
| **Concurrent block reorder** | Two authors drag same block | LWW on `order` field; second mutation wins. Toast shown to loser | Acceptable; this is why fractional index is the planned upgrade |
| **SCORM zip exceeds R2/Worker size limits** | Build fails late | Pre-flight: action `exports.request` rejects modules whose snapshot+assets exceed N MB | Author sees actionable error before clicking export |

---

## Recommended Project Structure

```
learnflow/
├── apps/
│   ├── web/                          # Authoring SPA (Vite + React)
│   │   ├── src/
│   │   │   ├── routes/               # /, /signin, /w/:slug, /w/:slug/m/:id
│   │   │   ├── editor/               # Tiptap mount, block list, drag-handles
│   │   │   ├── blocks-authoring/     # Edit-mode wrappers around renderer blocks
│   │   │   ├── preview/              # Wraps @prism/renderer in iframe for fidelity
│   │   │   ├── theme-editor/
│   │   │   └── convex/               # generated Convex client
│   │   └── vite.config.ts
│   └── scorm-runtime/                # Bundle that ships inside every export
│       ├── src/
│       │   ├── main.tsx              # Boots <Module/> from module.json
│       │   └── scorm-api.ts          # window.parent.API adapter
│       └── vite.config.ts            # outputs runtime.js, runtime.css
├── packages/
│   ├── renderer/                     # @prism/renderer (PURE, no I/O)
│   │   ├── src/blocks/
│   │   ├── src/theme.ts
│   │   ├── src/types.ts
│   │   └── src/Module.tsx
│   └── scorm/                        # @prism/scorm (manifest, validators)
│       └── src/manifest.ts
├── convex/
│   ├── schema.ts
│   ├── auth.ts                       # magic-link config
│   ├── workspaces.ts
│   ├── modules.ts
│   ├── lessons.ts
│   ├── blocks.ts                     # bulk of mutations
│   ├── assets.ts
│   ├── exports.ts                    # action -> Worker
│   └── presence.ts
├── workers/
│   └── export/
│       ├── src/index.ts              # /presign, /export, /asset/:id routes
│       └── wrangler.toml
└── package.json                      # pnpm workspace root
```

### Structure rationale
- `apps/` separates the two end-user runtimes (authoring SPA, learner SCORM bundle). They differ in build target, deps, and entry — separation prevents accidental coupling.
- `packages/renderer` is the load-bearing wall. It is the only code path that runs in BOTH apps, and it MUST stay I/O-free.
- `convex/` lives at the root because Convex's CLI expects it there; treat it as a top-level "app".
- `workers/` is separate so it can deploy on its own Wrangler cadence.

---

## Suggested Build Order

Derived from the dependency graph: each phase below unblocks the next.

| # | Phase | Why this order | Unblocks |
|---|-------|----------------|----------|
| 1 | **Foundations** — pnpm workspace, Vite SPA boot, Convex init, magic-link auth, workspace + membership schema/CRUD | Nothing works without auth + a workspace to scope data to. Convex schema + auth shake out earliest. | All multi-user features |
| 2 | **Renderer package skeleton** — `@prism/renderer` with `<Module>`, `<RichTextBlock>` (read-only), types, theme tokens → CSS vars | Establishes the purity boundary BEFORE authoring code grows tendrils into it. Cheap to do early, expensive to retrofit. | Preview, SCORM export |
| 3 | **Block CRUD (text only)** — modules/lessons/blocks schema; create, reorder, delete; Tiptap mounted for rich text; per-block Convex mutations with LWW + conflict toast | Proves the realtime sync strategy end-to-end on the simplest block. If Option A doesn't work, find out here, not after building 7 block types. | All other block types, presence |
| 4 | **Block type expansion** — Image (depends on asset upload), Video embed, Quiz MC, Quiz TF, Accordion, Lottie | Asset upload flow gates Image and Lottie. Stand it up alongside Image. Quiz blocks are pure data, no infra dep. | Full v1 block set |
| 5 | **Asset upload pipeline** — Worker `/presign`, Convex `assets.*`, two-step pending→ready | Required by Image and Lottie blocks. Worker introduced here for the first time. | Image/Lottie blocks, SCORM export (which reuses R2) |
| 6 | **Theming** — workspace theme editor, CSS-variable propagation, font loading | Renderer is ready, blocks exist; now we can theme them. Earlier would mean theming a moving target. | SCORM export (theme.css generation) |
| 7 | **Preview pane** — iframe-isolated `<Module>` render of current module state, fed by reactive Convex query | Same component path the SCORM export uses → dogfoods the renderer before export ships. | SCORM export confidence |
| 8 | **SCORM export** — `apps/scorm-runtime` bundle, `@prism/scorm` manifest builder, `workers/export`, Convex `exports.*` table + action, quiz LMS adapter | All inputs exist (renderer, blocks, assets, theme, runtime). This is the integration phase. | Core value validation |
| 9 | **Realtime polish** — presence (avatars, cursors), conflict toast UX, fractional indices for ordering if needed | Quality-of-life on top of Phase 3's sync. Defer until co-edit is being actually used. | — |
| 10 | **Hardening** — error boundaries, retry queues, R2 event webhook for orphan asset reconciliation, export size pre-flight | Production-readiness work. Discovered from real usage in 8–9. | Production rollout |

### Critical dependency notes
- **Phase 2 before Phase 3** is the single most important ordering choice. The renderer's purity rules must be locked in before any Convex-aware code is written alongside it.
- **Phase 5 (asset upload) before Phase 4's image/lottie blocks**, but Phase 4 can start with Quiz MC, Quiz TF, Video embed, Accordion in parallel — those have no asset dependency.
- **Phase 8 (SCORM export) blocks the core value proposition.** Don't let Phase 9 polish defer it.

---

## Anti-Patterns to Avoid

### 1. Storing asset bytes in Convex
**Why wrong:** Convex storage has egress cost; the export Worker would pay to read every asset. R2-to-Worker egress is free.
**Do instead:** Convex stores only `r2Key` and metadata. Bytes live in R2 from the moment of upload.

### 2. Letting `@prism/renderer` import Convex
**Why wrong:** Export bundle has no backend. Importing `convex/react` into the renderer would mean the SCORM zip tries to phone home — violating "exported package is fully self-contained".
**Do instead:** Renderer receives data and `resolveAsset` as props. Enforce with ESLint `no-restricted-imports`.

### 3. Single Tiptap editor spanning the whole module
**Why wrong:** Couples all blocks into one ProseMirror doc, defeating per-block LWW, exploding conflict scope, and breaking drag-reorder of non-text blocks.
**Do instead:** One Tiptap instance per rich-text block. Block list is a plain React array with drag handles outside the editor.

### 4. Client-side SCORM zipping
**Why wrong:** Forces the SPA to ship the runtime bundle to itself just to re-zip it; non-deterministic across browsers; cannot stream from R2 cheaply.
**Do instead:** Worker fetches from R2, streams via fflate, writes zip to R2.

### 5. Optimistic reorder without a fractional index
**Why wrong:** Two simultaneous reorders both compute `order = midpoint(a, b)` from stale data and collide. Endless renumbering required.
**Do instead:** Plan for fractional-index strings (lexorank/`fracdex`). It's fine to start with floats but expect this swap.

### 6. Long-lived R2 signed URLs in block data
**Why wrong:** URLs expire; module data becomes broken after TTL.
**Do instead:** Store only `assetId` in block data. Resolve to a fresh signed URL on render via `resolveAsset` (SPA) or to a relative path (SCORM export).

### 7. Realtime "lock the block" UX
**Why wrong:** Contradicts the requirement that "two authors editing the same module see each other's changes live". Locks are async-with-locking, which was explicitly rejected.
**Do instead:** `editingBy` is a *hint* for UI affordances (cursor color, avatar dot), never a gate.

### 8. Tying SCORM 1.2 API calls into the renderer
**Why wrong:** The renderer must also work in authoring preview, where there is no LMS frame.
**Do instead:** Quiz blocks expose `onScore(payload)` callback. SPA's preview ignores it; SCORM runtime maps it to `LMSSetValue` calls.

---

## Scaling Considerations (sanity-check, not a roadmap)

The user's stated scale is **a small team of authors (a few people)**. Scaling sections below exist only to confirm nothing in the architecture caps growth early.

| Scale | Reality check |
|-------|---------------|
| Team of 3–10 authors, 100s of modules | Default architecture handles this trivially. Convex free tier likely sufficient. |
| 50+ concurrent editors on one module | Per-block subscriptions stay tight; presence table is the first bottleneck — switch to ephemeral presence (Convex sessions) if it shows up. |
| Modules > 50MB exported | Worker export needs multipart R2 PUT and possibly Durable Object for state across chunked builds. Add export size pre-flight before pursuing. |
| Multi-tenant SaaS | Explicitly out of scope. Schema is workspace-scoped, so the door isn't shut, but auth/billing/quotas are not designed for it. |

---

## Sources & Confidence

- **Convex reactive queries + LWW pattern:** Convex official docs on optimistic updates and mutation semantics. HIGH confidence — this is Convex's intended usage pattern.
- **R2 presigned PUT via Worker:** Cloudflare R2 docs (S3 API compatibility, `aws4fetch` in Workers). HIGH confidence.
- **Tiptap per-block, no Y.js for v1:** Derived from product requirement permitting field-scoped LWW. Tiptap+Convex without Y.js is unusual but well within Tiptap's design (Y.js is opt-in via `Collaboration` extension). HIGH confidence given requirements; MEDIUM confidence as a general recommendation if the product later demands google-docs-grade concurrency.
- **SCORM 1.2 manifest + API surface:** ADL SCORM 1.2 spec. HIGH confidence on what to generate.
- **Worker zip with fflate:** Cloudflare Workers community pattern for in-Worker zipping. HIGH confidence for module sizes <50MB; MEDIUM above that (needs chunking).

---
*Architecture research for: Prism Learning (Rise-360-style authoring tool)*
*Researched: 2026-05-27*

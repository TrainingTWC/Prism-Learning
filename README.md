# Prism Learning

**Prism Learning** is a Rise-360-style collaborative learning module authoring tool for small teams. Authors build themed, block-based learning modules in real-time and export them as **SCORM 1.2 packages** that drop into any LMS — no code, no design effort, no installation required.

> **Core value:** A team author can sit down, build a themed multi-block lesson collaboratively in real-time, and export a working SCORM 1.2 zip that runs in their LMS — without writing code, fighting layout, or installing anything.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Repository Layout](#repository-layout)
4. [Architecture & Design Principles](#architecture--design-principles)
5. [Database Schema](#database-schema)
6. [Block Types](#block-types)
7. [Application Pages & Routes](#application-pages--routes)
8. [Components](#components)
9. [Convex Backend](#convex-backend)
10. [AI Module Generation](#ai-module-generation)
11. [SCORM Export](#scorm-export)
12. [Theme System](#theme-system)
13. [Module Templates](#module-templates)
14. [Real-Time Presence](#real-time-presence)
15. [Authentication](#authentication)
16. [Team & Workspace Management](#team--workspace-management)
17. [Renderer Package (`@prism/renderer`)](#renderer-package-prismrenderer)
18. [Cloudflare Worker (presign)](#cloudflare-worker-presign)
19. [Design System & Styling](#design-system--styling)
20. [Prerequisites](#prerequisites)
21. [Setup](#setup)
22. [Environment Variables](#environment-variables)
23. [Running the App](#running-the-app)
24. [Available Scripts](#available-scripts)
25. [Deployment](#deployment)
26. [Security Model](#security-model)

---

## Project Overview

Prism Learning solves a specific problem: small instructional design teams lack a clean, opinionated tool for producing modular learning content collaboratively without design effort or infrastructure overhead.

**What it does:**
- Provides a multi-workspace authoring environment where teams can create and manage learning content.
- Lets authors compose lessons from 25+ content and interactive block types, all drag-and-drop reorderable.
- Generates complete multi-lesson modules from a text brief, PDF, DOCX, image, or video using AI.
- Exports fully compliant **SCORM 1.2 packages** (with LMS score reporting) from the browser — no server needed for packaging.
- Applies a per-workspace **brand theme** (colors, typography, shape) consistently across authoring previews and exported packages.
- Supports real-time multi-author collaboration with live presence indicators.

---

## Tech Stack

| Layer | Technology | Version | Role |
|-------|-----------|---------|------|
| **Frontend** | Vite + React | 19.x | SPA build and UI |
| **Language** | TypeScript | 5.7.x | Strict mode throughout |
| **Backend** | Convex | 1.18.x | Auth, database, real-time sync, server functions, file storage |
| **Auth** | `@convex-dev/auth` | 0.0.92 | Magic-link + password auth sessions |
| **Email** | Resend | 6.12.x | Transactional email for magic links and invites |
| **Routing** | TanStack Router | 1.95.x | Type-safe client-side routing with search-param validation |
| **Rich Text** | Tiptap | 3.23.x | ProseMirror-based block editor (placeholder, text-align, underline extensions) |
| **Drag & Drop** | dnd-kit | 6.3.x / 10.x | Accessible sortable block reordering |
| **Animation** | dotlottie-react | 0.19.x | Lottie block playback (WASM renderer) |
| **PDF Parsing** | pdfjs-dist | 5.7.x | Client-side PDF text extraction for AI builder |
| **SCORM Runtime** | scorm-again | 3.0.4 | SCORM 1.2 LMS API bundled into exported packages |
| **Zip Assembly** | JSZip | 3.10.x | Client-side SCORM `.zip` construction |
| **HTML Sanitization** | DOMPurify | 3.4.x | Rich text sanitization before SCORM export |
| **Forms** | react-hook-form + Zod | 7.76.x / 4.4.x | Schema-validated forms |
| **Local State** | Zustand | 5.0.x | Client-only ephemeral UI state |
| **Styling** | Tailwind CSS v4 | 4.0.0-beta | CSS-first theming via `@theme` |
| **Icons** | lucide-react | 0.469.x | Tree-shakeable icon set |
| **Static Hosting** | Cloudflare Pages | — | Hosts the compiled SPA |
| **Asset Storage** | Cloudflare R2 | — | Large assets (images, Lottie, SCORM zips) |
| **Edge Compute** | Cloudflare Workers | — | R2 presigned PUT/GET URL generation |
| **Package Manager** | pnpm | 9.15.x | Workspace-aware monorepo management |

---

## Repository Layout

```
prism-learning/
├── apps/
│   └── web/                        # @prism/web — Vite + React 19 SPA (authoring tool)
│       ├── index.html
│       ├── vite.config.ts
│       └── src/
│           ├── main.tsx             # Entry point — ConvexAuthProvider + RouterProvider
│           ├── App.tsx              # Root component
│           ├── router.tsx           # TanStack Router route tree
│           ├── styles.css           # Tailwind v4 + CSS design tokens
│           ├── components/          # Reusable UI components + block editors
│           ├── pages/               # Page-level route components
│           └── lib/
│               ├── scormExport.ts   # SCORM 1.2 package builder (JSZip)
│               └── moduleTemplates.ts # Pre-built module starting points
│
├── packages/
│   └── renderer/                   # @prism/renderer — pure React renderer (I/O-free)
│       └── src/
│           ├── index.ts             # Public exports
│           ├── types.ts             # Block + Theme type definitions
│           ├── Module.tsx           # Top-level lesson renderer
│           ├── tokensToCss.ts       # Theme tokens → CSS variables
│           └── *BlockRenderer.tsx   # One file per block type (25 renderers)
│
├── convex/                         # Convex backend
│   ├── schema.ts                   # Full DB schema definition
│   ├── auth.config.ts              # Auth provider configuration
│   ├── auth.ts                     # Auth HTTP actions
│   ├── workspaces.ts               # Workspace CRUD
│   ├── modules.ts                  # Module CRUD + aggregate query
│   ├── lessons.ts                  # Lesson CRUD + reorder
│   ├── blocks.ts                   # Block CRUD + reorder + duplicate
│   ├── members.ts                  # Membership + invite system
│   ├── presence.ts                 # Real-time presence (ping/list)
│   ├── files.ts                    # Convex Storage upload/URL/delete
│   ├── users.ts                    # User profile queries
│   ├── ai.ts                       # AI module generation action
│   └── http.ts                     # HTTP action router
│
└── workers/
    └── presign/                    # @prism/worker-presign — Cloudflare Worker
        ├── wrangler.toml
        └── src/
            └── index.ts            # R2 presigned URL generation (Phase 4)
```

---

## Architecture & Design Principles

### 1. Renderer Purity (Load-Bearing Rule)

`packages/renderer` is a **pure React package** — it may not import from `convex/*`, call `fetch`, or use auth. This is enforced by the package's own `eslint.config.js`.

**Why:** The renderer drives two completely different consumers:
- The **authoring preview** inside the editor (fed live Convex data).
- The **SCORM export runtime** (a standalone HTML file bundled into the `.zip`).

If any I/O or auth code leaks into the renderer, the exported SCORM package breaks.

### 2. One Convex Document Per Block

Every block is its own Convex document. Convex's 1 MB document cap makes a "module-wide JSON blob" approach untenable at scale. Fine-grained documents also enable granular real-time subscriptions.

### 3. Theme Baked at Export

Each SCORM export captures a snapshot of the workspace theme at export time. Themes are represented as a frozen set of CSS custom properties injected into the exported `index.html`. Post-export theme changes don't affect already-exported packages.

### 4. Assets Bypass Convex

Binary files (images, Lottie JSON, audio) flow `browser → Cloudflare R2` via a Worker-presigned PUT URL. Convex authorizes the upload but never touches the bytes. This keeps Convex storage for structured data only and asset delivery fast and cheap.

### 5. Float-Ordered Records

Both lessons and blocks use a floating-point `order` field. Reordering inserts midpoints between neighbors (`(a + b) / 2`) so no sibling renumbering is needed, and live subscriptions only see one document change per reorder.

---

## Database Schema

Defined in [`convex/schema.ts`](convex/schema.ts).

### `workspaces`

| Field | Type | Notes |
|-------|------|-------|
| `name` | `string` | Display name |
| `ownerId` | `Id<'users'>` | Creator — only owner can rename/delete |
| `createdAt` | `number` | Unix ms |
| `theme` | `object` (optional) | Per-workspace brand theme (see [Theme System](#theme-system)) |

### `memberships`

| Field | Type | Notes |
|-------|------|-------|
| `workspaceId` | `Id<'workspaces'>` | |
| `userId` | `Id<'users'>` | |
| `role` | `'owner' \| 'editor'` | Owners can rename, delete, invite, revoke |

Indexes: `by_workspace`, `by_user`

### `pendingInvites`

| Field | Type | Notes |
|-------|------|-------|
| `workspaceId` | `Id<'workspaces'>` | |
| `email` | `string` | Invitee email address |
| `invitedBy` | `Id<'users'>` | |
| `createdAt` | `number` | |
| `expiresAt` | `number` | 7-day TTL; checked on acceptance and list |

### `modules`

| Field | Type | Notes |
|-------|------|-------|
| `workspaceId` | `Id<'workspaces'>` | |
| `title` | `string` | |
| `status` | `'draft' \| 'published'` | |
| `deletedAt` | `number` (optional) | Soft-delete timestamp |
| `createdAt` | `number` | |
| `updatedAt` | `number` | Updated on any block/lesson edit |
| `lastEditedBy` | `Id<'users'>` | |

Indexes: `by_workspace`, `by_workspace_updated`

### `lessons`

| Field | Type | Notes |
|-------|------|-------|
| `moduleId` | `Id<'modules'>` | |
| `title` | `string` | |
| `order` | `number` | Float order for gapless reorder |
| `createdAt` | `number` | |

Index: `by_module`

### `blocks`

| Field | Type | Notes |
|-------|------|-------|
| `lessonId` | `Id<'lessons'>` | |
| `moduleId` | `Id<'modules'>` | Denormalized for aggregate subscription |
| `type` | `BlockType` union | 25 block type literals |
| `order` | `number` | Float order |
| `content` | `string` (optional) | HTML string for `richText`; JSON string for everything else |
| `updatedAt` | `number` | |
| `lastEditedBy` | `Id<'users'>` (optional) | |

Indexes: `by_lesson`, `by_module`

### `presence`

| Field | Type | Notes |
|-------|------|-------|
| `userId` | `Id<'users'>` | |
| `moduleId` | `Id<'modules'>` | |
| `lastSeen` | `number` | Unix ms; entries older than 30s filtered out by query |
| `displayName` | `string` | Cached from user record |
| `activeLessonId` | `Id<'lessons'>` (optional) | Which lesson the user is viewing |

---

## Block Types

Prism Learning supports **25 block types** across four categories:

### Content Blocks

| Block | Type Key | Content Shape |
|-------|----------|--------------|
| **Rich Text** | `richText` | Trusted HTML string (Tiptap output) |
| **Image** | `image` | `{ storageId, altText, caption }` |
| **Video** | `video` | `{ src, srcType: 'embed'\|'storage', caption }` |
| **Lottie Animation** | `lottie` | `{ storageId, loop, autoplay }` |
| **Quote** | `quote` | `{ text, attribution? }` |
| **Callout** | `callout` | `{ variant: 'info'\|'warning'\|'success'\|'tip', title?, body }` |
| **Divider** | `divider` | `{ style: 'line'\|'space'\|'dots', label?, padding? }` |
| **Button** | `button` | `{ label, url?, style: 'primary'\|'outline'\|'ghost', align }` |
| **Custom HTML** | `customHtml` | `{ html, notes? }` |

### Interactive / Assessment Blocks

| Block | Type Key | Content Shape |
|-------|----------|--------------|
| **Multiple Choice (MCQ)** | `mcq` | `{ question, options[{ id, text, isCorrect, feedback }], multiSelect, showFeedback }` |
| **True / False** | `trueFalse` | `{ statement, correctAnswer, trueFeedback, falseFeedback }` |
| **Flashcards** | `flashcard` | `{ cards[{ id, front, back }] }` |
| **Fill in the Blanks** | `fillBlanks` | `{ template, blanks[{ key, answer, alternates }] }` |
| **Matching** | `matching` | `{ instructions, pairs[{ id, term, definition }] }` |
| **Sorting** | `sorting` | `{ instructions, items[{ id, text }] }` (array order = correct order) |
| **Scenario (Branching)** | `scenario` | `{ startNodeId, nodes[{ id, prompt, choices[{ label, nextId, feedback }], outcome }] }` |

### Presentation / Layout Blocks

| Block | Type Key | Content Shape |
|-------|----------|--------------|
| **Accordion** | `accordion` | `{ sections[{ id, title, content }] }` |
| **Process Steps** | `process` | `{ steps[{ id, title, body }] }` |
| **Tabs** | `tabs` | `{ tabs[{ id, title, content }] }` |
| **Reveal Cards** | `revealCards` | `{ columns: 2\|3\|4, cards[{ id, front, back }] }` |

### Media Blocks

| Block | Type Key | Content Shape |
|-------|----------|--------------|
| **Hotspots** | `hotspots` | `{ storageId, altText, hotspots[{ id, xPct, yPct, title, body }] }` |
| **Gallery** | `gallery` | `{ layout: 'carousel'\|'grid', items[{ storageId, altText, caption }] }` |
| **Before/After Compare** | `compare` | `{ beforeStorageId, afterStorageId, beforeLabel, afterLabel }` |
| **Audio** | `audio` | `{ storageId, title, transcript }` |
| **Labeled Graphic** | `labeledGraphic` | `{ storageId, altText, labels[{ id, xPct, yPct, text }] }` |

---

## Application Pages & Routes

All routes are defined in [`apps/web/src/router.tsx`](apps/web/src/router.tsx) using TanStack Router.

| Route | Component | Auth Required | Description |
|-------|-----------|:---:|-------------|
| `/sign-in` | `SignInPage` | No | Magic-link email form + password fallback. Auto-detects `?code=` magic-link parameter and completes sign-in transparently. |
| `/` | `DashboardPage` | Yes | Home screen showing all workspaces the user belongs to. Feature cards for Workspaces, AI Builder, and Brand System. |
| `/w/:workspaceId` | `WorkspacePage` | Yes | Per-workspace overview with quick navigation to modules, theme, AI builder, and team. |
| `/w/:workspaceId/modules` | `ModuleListPage` | Yes | Grid of all non-deleted modules. Supports create, rename, duplicate, soft-delete, and launch from template gallery. |
| `/w/:workspaceId/m/:moduleId` | `ModuleEditorPage` | Yes | Full authoring canvas. Two-panel layout: lesson list (left) + block editor (right). All 25 block editors, drag-and-drop reorder, duplicate, delete, SCORM export, presence avatars. |
| `/w/:workspaceId/m/:moduleId/preview` | `PreviewPage` | Yes | Learner preview using `@prism/renderer`. Switchable phone / tablet / desktop viewport frames. Lesson navigation. |
| `/w/:workspaceId/theme` | `ThemeEditorPage` | Yes | Full theme editor: color pickers, preset palettes, typography (font pickers, sizes, weights, line-height), border radius, button style. Live preview panel. |
| `/w/:workspaceId/build-with-ai` | `BuildWithAIPage` | Yes | 3-step AI wizard: (1) basics — module name, objective, type; (2) source — describe or upload files (PDF, DOCX, image, video); (3) generate — progress messages + auto-redirect to new module on completion. |
| `/w/:workspaceId/members` | `MembersPage` | Yes | Member list with roles, pending invites, invite by email, remove members (owner only), revoke invites. |
| `/renderer-demo` | `RendererDemoPage` | No | Dev-only page proving renderer purity. Renders a hardcoded block set without any Convex connection. |

### Route Guards

- All routes under the `protectedRoute` layout use `AppLayout`, which checks `useConvexAuth()` and redirects unauthenticated users to `/sign-in`.
- On first authenticated load, `AppLayout` calls `acceptPendingInvites` to automatically accept any workspace invitations linked to the user's email, then shows a toast notification for each workspace joined.
- All routes are wrapped in `MobileGuard`, which blocks access on very small viewports and shows a "desktop required" message.

---

## Components

### Shell & Layout

| Component | Description |
|-----------|-------------|
| `AppLayout` | Auth guard + invite acceptance on mount. Renders `<Outlet />` for child routes. Shows joined-workspace toast notifications. |
| `PrismWorkspaceShell` | Primary application shell. Collapsible sidebar with nav items (Workspace, Modules, AI Builder, Brand Theme, Members), top bar with dark/light toggle, user avatar with initials, sign out, set password modal. Persists sidebar collapse state and theme preference to `localStorage`. |
| `MobileGuard` | Blocks rendering on screens narrower than the minimum supported width. |

### Block Editors (one per block type)

Every block type has a dedicated editor component in `apps/web/src/components/`. All editors receive the current block content, a Convex mutation callback, and the workspace theme. Changes are saved immediately on every meaningful interaction.

| Editor Component | Block Type |
|-----------------|-----------|
| `RichTextBlockEditor` | `richText` — Tiptap editor with Bold, Italic, Underline, Headings (H2/H3), Lists, Text Align |
| `ImageBlockEditor` | `image` — File upload to Convex Storage, alt text + caption fields |
| `VideoBlockEditor` | `video` — YouTube/Vimeo/direct URL embed or Convex Storage upload |
| `LottieBlockEditor` | `lottie` — `.json`/`.lottie` file upload, loop + autoplay toggles, live preview |
| `MCQBlockEditor` | `mcq` — Question, options (add/remove/mark correct), multi-select toggle, feedback per option |
| `TrueFalseBlockEditor` | `trueFalse` — Statement, correct answer toggle, per-answer feedback text |
| `AccordionBlockEditor` | `accordion` — Add/remove/reorder sections, each with title + body |
| `QuoteBlockEditor` | `quote` — Quote text + attribution |
| `CalloutBlockEditor` | `callout` — Variant selector (info/warning/success/tip), title + body |
| `DividerBlockEditor` | `divider` — Style selector (line/space/dots), optional label, vertical padding |
| `FlashcardBlockEditor` | `flashcard` — Add/remove cards, front/back per card |
| `ProcessBlockEditor` | `process` — Add/remove/reorder steps, title + body per step |
| `TabsBlockEditor` | `tabs` — Add/remove/reorder tabs, title + content per tab |
| `ButtonBlockEditor` | `button` — Label, URL, style (primary/outline/ghost), alignment |
| `CustomHtmlBlockEditor` | `customHtml` — Raw HTML textarea + optional dev notes |
| `HotspotsBlockEditor` | `hotspots` — Image upload, click-to-place hotspots with title + body per spot |
| `GalleryBlockEditor` | `gallery` — Multi-image upload, layout (carousel/grid), per-image alt + caption |
| `CompareBlockEditor` | `compare` — Two image uploads (before/after) with labels |
| `AudioBlockEditor` | `audio` — Audio file upload, title, transcript |
| `LabeledGraphicBlockEditor` | `labeledGraphic` — Image upload, click-to-place text labels |
| `FillBlanksBlockEditor` | `fillBlanks` — Template text with `{{key}}` syntax, per-blank answer + alternates |
| `RevealCardsBlockEditor` | `revealCards` — Column count (2/3/4), add/remove cards, front/back |
| `MatchingBlockEditor` | `matching` — Instructions, term-definition pairs |
| `SortingBlockEditor` | `sorting` — Instructions, items (correct order = array order) |
| `ScenarioBlockEditor` | `scenario` — Node-based branching: prompt, choices with `nextId` links, outcome nodes |

### Other Components

| Component | Description |
|-----------|-------------|
| `FontPicker` | Dropdown for selecting heading/body fonts (Google Fonts). Loads font via `<link>` injection. |
| `TemplateGalleryDialog` | Modal dialog showing all pre-built module templates grouped by category. "Use Template" imports the full lesson/block structure into a new module. |
| `SetPasswordModal` | In-app dialog for users who signed in via magic link to optionally set a password for future sign-ins. |

---

## Convex Backend

The backend lives entirely in the `convex/` directory and is deployed to the Convex cloud.

### `workspaces.ts`

| Function | Type | Description |
|----------|------|-------------|
| `listMine` | query | Returns all workspaces the authenticated user is a member of, with their `role` on each. |
| `getById` | query | Returns a single workspace if the caller is a member. Includes `role`. |
| `create` | mutation | Creates a workspace and inserts the creator as `owner` in `memberships`. |
| `rename` | mutation | Renames a workspace. Owner-only. |

### `modules.ts`

| Function | Type | Description |
|----------|------|-------------|
| `list` | query | Non-deleted modules for a workspace, sorted by `updatedAt` descending. |
| `getById` | query | Single module (must be a member). |
| `getWithContent` | query | Aggregate: module + all its lessons + all their blocks in one subscription. Used by the editor and preview. |
| `create` | mutation | Create a new draft module. |
| `rename` | mutation | Rename a module. |
| `duplicate` | mutation | Deep-copy a module with all its lessons and blocks (new `createdAt`). |
| `softDelete` | mutation | Sets `deletedAt` — module is hidden from all list queries but data is retained. |
| `updateStatus` | mutation | Toggle between `draft` and `published`. |

### `lessons.ts`

| Function | Type | Description |
|----------|------|-------------|
| `list` | query | Ordered lessons for a module. |
| `add` | mutation | Append a new lesson. |
| `rename` | mutation | Update lesson title. |
| `reorder` | mutation | Swap float `order` values between two lessons. |
| `remove` | mutation | Delete a lesson and all its blocks. |

### `blocks.ts`

| Function | Type | Description |
|----------|------|-------------|
| `list` | query | Ordered blocks for a lesson. |
| `add` | mutation | Insert a new block at a position (uses float midpoint logic). |
| `update` | mutation | Patch `content` and `updatedAt` + `lastEditedBy`. |
| `reorder` | mutation | Swap float `order` values between two blocks. |
| `duplicate` | mutation | Clone a block immediately after the original. |
| `remove` | mutation | Delete a block. |

### `members.ts`

| Function | Type | Description |
|----------|------|-------------|
| `list` | query | All members of a workspace with their email, name, and role. |
| `listPendingInvites` | query | Active (non-expired) pending invites. Owner-only. |
| `invite` | action | Validates email, creates a `pendingInvites` record, sends a magic-link invitation email via Resend. |
| `acceptPendingInvites` | mutation | Called on every auth. Finds all pending invites for the user's email, inserts membership rows, deletes invite records. Returns names of joined workspaces. |
| `remove` | mutation | Remove a member from a workspace. Owner-only; cannot remove self if owner. |
| `revokeInvite` | mutation | Delete a pending invite. Owner-only. |

### `presence.ts`

| Function | Type | Description |
|----------|------|-------------|
| `ping` | mutation | Upsert presence record for the current user in a module. Called every ~5s by the editor. |
| `list` | query | Return presence records with `lastSeen > now - 30000ms`. Used to show live collaborator avatars. |

### `files.ts`

| Function | Type | Description |
|----------|------|-------------|
| `generateUploadUrl` | mutation | Returns a short-lived Convex Storage upload URL for direct browser-to-storage PUT. |
| `getFileUrl` | query | Resolves a `storageId` to a public URL. |
| `deleteFile` | mutation | Deletes a file from Convex Storage. |

### `ai.ts`

See [AI Module Generation](#ai-module-generation).

---

## AI Module Generation

**Entry point:** `BuildWithAIPage` → `api.ai.generateModule` (Convex action).

### Wizard Flow (3 steps)

1. **Basics** — Module name, learning objective, module type (`microLearning` or `course`).
2. **Source** — Choose between:
   - **Describe:** Free-text description of the topic.
   - **Upload:** One or more files. Supported types:
     - **PDF** — Text extracted client-side using `pdfjs-dist` (up to 80 pages, max 18,000 characters).
     - **DOCX / TXT** — Read as plain text.
     - **Images** — Uploaded to Convex Storage; visual description extracted by the AI vision model.
     - **Video** — Uploaded to Convex Storage; AI summarizes the visual content.
3. **Generate** — Shows animated progress messages while the AI generates the module. On success, redirects directly to the new module's editor.

### AI Prompt Strategy

The `generateModule` action builds a system prompt tailored to the module type:

- **Micro-learning:** 1–3 lessons, 5–8 blocks per lesson. Designed for 5–10 min mobile consumption.
- **Course:** 3–7 lessons, 6–10 blocks per lesson. Designed for 20–40 min desktop/mobile learning.

Each lesson is required to include:
- A setup `richText` block.
- A generated image visual brief (for AI image generation — phase-pending).
- A concrete example or scenario.
- At least one interactive block (`mcq` or `trueFalse`).
- An accordion for optional details.
- A short takeaway.

The AI returns a single JSON object (no prose, no markdown). The action scaffolds the full module/lesson/block hierarchy in Convex via `createModuleFromAI` (internal mutation).

**Supported AI-generated block types:** `richText`, `image`, `video`, `lottie`, `mcq`, `trueFalse`, `accordion`.

---

## SCORM Export

**Entry point:** `apps/web/src/lib/scormExport.ts` — entirely client-side, no server required.

### What Gets Exported

A `.zip` file containing:

```
my-module-title.zip
├── imsmanifest.xml          # SCORM 1.2 manifest
├── index.html               # Entry point — one page per lesson
├── assets/
│   ├── scorm12.min.js       # scorm-again SCORM 1.2 runtime
│   └── [embedded images]    # Re-fetched from Convex Storage URLs
└── lesson-*.html            # (Future: separate SCO per lesson)
```

### SCORM 1.2 Compliance

- `imsmanifest.xml` is generated from a template with the module title, identifier, and SCO item list.
- The exported `index.html` instantiates `Scorm12API` from `scorm-again`, attaches it to `window.API`, and wires quiz blocks to `LMSSetValue` / `LMSCommit` / `LMSFinish`.
- Score reporting: correct answers across all `mcq` and `trueFalse` blocks are tallied; `cmi.core.score.raw` and `cmi.core.lesson_status` (`passed` / `failed`) are reported to the LMS.

### Block Rendering in Export

Each block type has a dedicated HTML renderer in `scormExport.ts`. Rich text is sanitized with DOMPurify before inclusion. Theme CSS variables are injected inline into the `<head>`.

### Theme Snapshot

The workspace theme is captured at export time and baked in as CSS custom properties — `--prism-primary`, `--prism-accent`, `--prism-font-heading`, `--prism-radius`, etc. Post-export theme changes don't affect the package.

---

## Theme System

**Entry point:** `ThemeEditorPage` → `api.workspaces.updateTheme`.

Each workspace stores an optional `theme` object with these properties:

| Property | Type | Default | Notes |
|----------|------|---------|-------|
| `primary` | hex color | `#4f46e5` | Primary brand color (buttons, links) |
| `accent` | hex color | `#aa75dd` | Accent / highlight color |
| `correct` | hex color | `#16a34a` | Feedback color for correct answers |
| `incorrect` | hex color | `#dc2626` | Feedback color for incorrect answers |
| `headingTextColor` | hex color | `#1e293b` | Heading text color |
| `bodyTextColor` | hex color | `#64748b` | Body text color |
| `headingFont` | string | `Inter` | Google Font family name |
| `bodyFont` | string | `Inter` | Google Font family name |
| `headingSize` | `'sm'\|'md'\|'lg'\|'xl'` | `'lg'` | Maps to rem values |
| `headingWeight` | `'400'–'800'` | `'700'` | Font weight |
| `bodySize` | `'sm'\|'md'\|'lg'` | `'md'` | Maps to rem values |
| `lineHeight` | `'tight'\|'normal'\|'relaxed'\|'loose'` | `'relaxed'` | Maps to unitless values |
| `borderRadius` | `'none'\|'sm'\|'md'\|'lg'\|'xl'\|'full'` | `'md'` | Maps to rem / px values |
| `buttonStyle` | `'filled'\|'outline'\|'soft'` | `'filled'` | Button visual style |

### Preset Palettes

The theme editor ships six preset color combinations:

| Preset | Primary | Accent |
|--------|---------|--------|
| Indigo & Orchid | `#4f46e5` | `#aa75dd` |
| Blue & Amber | `#2563eb` | `#f59e0b` |
| Rose & Violet | `#e11d48` | `#7c3aed` |
| Teal & Orange | `#0d9488` | `#ea580c` |
| Slate & Cyan | `#475569` | `#0891b2` |
| Midnight & Gold | `#1e1b4b` | `#ca8a04` |

---

## Module Templates

**Entry point:** `TemplateGalleryDialog` → imports from `apps/web/src/lib/moduleTemplates.ts`.

Pre-built module templates are organized into six categories:

| Category | Templates |
|----------|-----------|
| Onboarding | Employee onboarding, welcome modules |
| Compliance | Policy, safety, regulatory content |
| Product | Product training, feature walkthroughs |
| Safety | Workplace safety procedures |
| Microlearning | Short-form focused skill topics |
| Sales | Sales methodology, objection handling |

Each template defines a full lesson/block structure. Selecting a template in the gallery creates a new module pre-populated with all lessons and blocks, which authors can then edit.

---

## Real-Time Presence

The editor tracks which collaborators are currently viewing a module using a lightweight heartbeat system.

**How it works:**
1. While the `ModuleEditorPage` is mounted, it calls `api.presence.ping` every ~5 seconds with the current `moduleId` and optionally the `activeLessonId`.
2. `api.presence.list` is subscribed via `useQuery` and returns all presence records with `lastSeen` within the last 30 seconds.
3. The editor renders an avatar cluster showing initials of active collaborators.

No Y.js or CRDT is used — Convex's per-field last-write-wins semantics on individual block documents is sufficient for the v1 collaboration model.

---

## Authentication

Auth is handled entirely by `@convex-dev/auth` with no third-party auth provider.

### Sign-in Methods

1. **Magic Link** — User enters their email. Convex Auth sends a one-time link via Resend. Clicking the link returns the user to the app with `?code=` in the URL; `ConvexAuthProvider` intercepts this and completes authentication transparently.
2. **Password** — Users who have set a password can sign in directly with email + password. New accounts are created via magic link; the `SetPasswordModal` in the sidebar lets users add a password post-signup.

### Auth Flow

```
User enters email
  → POST /api/auth/send-magic-link (Convex HTTP action)
  → Resend delivers email with ?code=…
  → Browser opens magic link
  → ConvexAuthProvider.replaceURL strips the code param
  → Session established (Convex JWT in IndexedDB)
  → AppLayout.acceptPendingInvites fires
  → Redirect to intended destination
```

### Session Management

- Sessions are managed server-side in Convex Auth tables (included via `authTables` in the schema).
- `useConvexAuth()` exposes `isAuthenticated` and `isLoading` for guard components.
- `useAuthActions()` provides `signIn` and `signOut`.

---

## Team & Workspace Management

### Workspaces

- Each user can own or be a member of multiple workspaces.
- Workspaces are isolated: modules, themes, and members don't cross workspace boundaries.
- Roles: `owner` (full control) and `editor` (can author content, cannot manage members or rename).

### Inviting Members

1. Workspace owner enters an email address in the Members page.
2. `api.members.invite` action:
   - Checks the email isn't already a member or has a pending invite.
   - Inserts a `pendingInvites` record (7-day TTL).
   - Sends an invitation email via Resend with a magic-link sign-in URL.
3. When the invitee signs in (via the magic link or any other method), `AppLayout` calls `acceptPendingInvites`, which automatically converts matching invite records to `memberships`.

### Removing Members

- Owners can remove any non-owner member from the Members page.
- Owners cannot remove themselves (prevents abandoned workspaces with no owner).

---

## Renderer Package (`@prism/renderer`)

The `packages/renderer` package is a **pure, I/O-free React component library**. It has no knowledge of Convex, no fetch calls, and no auth dependencies.

### Public API

```ts
import { Module, tokensToCss } from '@prism/renderer';
import type { Block, Theme, ModuleProps } from '@prism/renderer';
```

### `Module` Component

Top-level renderer that accepts a flat array of `Block` objects and a `Theme`, and renders the full lesson. Used by both:
- `PreviewPage` (passing live Convex data).
- The SCORM export HTML (passing inlined JSON data).

### `tokensToCss(theme: Theme): string`

Converts a `Theme` object into a CSS string of custom properties. Used by the SCORM exporter to inject theme variables inline.

### `ResolveAsset` Callback

```ts
type ResolveAsset = (assetId: string) => string;
```

Passed to the `Module` component. In the preview, this resolves storage IDs to Convex URLs. In the SCORM export, it resolves to relative paths within the zip.

This callback is the only I/O boundary — the renderer itself does zero async work.

---

## Cloudflare Worker (presign)

**Location:** `workers/presign/`

**Current state:** Health-check stub — Phase 4 will implement the full R2 presigned URL generation.

**Planned endpoints:**
- `POST /presign` — Verify Convex session → return scoped R2 PUT URL for direct browser-to-R2 uploads.
- `GET /asset/:id` — Verify workspace membership → return scoped R2 GET URL for asset delivery.

**Why:** Large binary assets (images, Lottie, exported SCORM zips) are stored in Cloudflare R2 rather than Convex Storage. R2 is cheaper at scale, has zero-cost egress on Cloudflare Workers, and Convex authorizes access without bytes traversing it.

---

## Design System & Styling

### Color Palette

The app uses a dark-first design with an **obsidian** (near-black) base and **ember/orchid purple** brand accents.

| Token | Value | Usage |
|-------|-------|-------|
| `--obsidian-950` | `#09090b` | Darkest background |
| `--obsidian-900` | `#111113` | App shell background |
| `--obsidian-800` | `#18181b` | Card/widget backgrounds |
| `--ember-600` | `#6d2bab` | Dark brand purple |
| `--ember-500` | `#8c43d0` | Primary brand purple |
| `--ember-400` | `#aa75dd` | Accent / highlight purple |
| `--ember-300` | `#c5a1e8` | Light purple |

### Typography

- **Primary font:** JetBrains Mono (monospace — used for all UI text giving the app a technical/code aesthetic)
- **Secondary font:** Necto Mono (local, loaded via `@font-face`)
- **Learner fonts:** Configurable per workspace via the theme system (Google Fonts)

### Tailwind v4

The app uses Tailwind CSS v4 with the `@tailwindcss/vite` plugin. Themes are defined via CSS `@theme` blocks rather than `tailwind.config.js`. CSS custom properties are mapped to Tailwind color utilities.

### Dark / Light Mode

The shell provides a toggle between dark (default) and light modes. The preference is persisted to `localStorage` under `prism-theme`. Mode is applied by toggling the `.light` class on `<html>`.

---

## Prerequisites

- **Node.js** ≥ 20.11 (tested with 24.x)
- **pnpm** 9.x — `npm install -g pnpm@9`
- **Convex account** — Free tier at [convex.dev](https://convex.dev). `npx convex dev` provisions a deployment.
- **Resend account** — Free tier for transactional email (magic links + invite emails). [resend.com](https://resend.com)
- **Cloudflare account** — For R2 (assets) and Workers (presign). Required from Phase 4 onward; the dev Worker stub works locally without credentials.

---

## Setup

```powershell
# 1. Clone the repository
git clone https://github.com/your-org/prism-learning.git
cd prism-learning

# 2. Install all workspace dependencies
pnpm install

# 3. Copy the environment template
copy .env.example .env.local
```

---

## Environment Variables

Set these in `apps/web/.env.local` (or the root `.env.local` if using workspace hoisting).

| Variable | Required | Description |
|----------|:--------:|-------------|
| `VITE_CONVEX_URL` | ✅ | Your Convex deployment URL (e.g. `https://xyz.convex.cloud`). Printed by `pnpm dev:convex` on first run. |
| `RESEND_API_KEY` | ✅ | Resend API key for sending magic-link and invite emails. Set this in the Convex dashboard under **Environment Variables**, not in `.env.local` (it's used server-side). |
| `CONVEX_SITE_URL` | ✅ | Your deployment URL (same as `VITE_CONVEX_URL`). Used by `auth.config.ts` as the auth domain. Set in Convex dashboard. |

---

## Running the App

Three processes are needed in development (each in a separate terminal):

```powershell
# Terminal 1 — Convex backend (first run guides you through deployment creation)
pnpm dev:convex

# Terminal 2 — Vite SPA dev server (http://localhost:5173)
pnpm dev

# Terminal 3 — Cloudflare Worker (presign stub, http://localhost:8787)
pnpm dev:worker
```

On first `pnpm dev:convex` run:
1. You'll be prompted to log in to Convex or create an account.
2. A new deployment is provisioned and its URL is printed.
3. Copy the URL into `apps/web/.env.local` as `VITE_CONVEX_URL=<url>`.
4. Restart `pnpm dev`.

---

## Available Scripts

Run from the **repository root** unless noted.

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start the Vite SPA dev server on `http://localhost:5173` |
| `pnpm dev:convex` | Start the Convex backend in watch mode (auto-deploys on file change) |
| `pnpm dev:worker` | Start the Cloudflare Worker locally via `wrangler dev` on `http://localhost:8787` |
| `pnpm build` | Build all packages (`@prism/renderer`) then build the SPA (`@prism/web`) |
| `pnpm typecheck` | Run `tsc --noEmit` across all workspace packages |
| `pnpm lint` | Run ESLint with the root flat config + renderer purity rules |
| `pnpm format` | Run Prettier on all files (with `prettier-plugin-tailwindcss` for class sorting) |
| `pnpm format:check` | Check formatting without writing (CI use) |

---

## Deployment

### SPA → Cloudflare Pages

```powershell
pnpm build
# Deploy the apps/web/dist directory to Cloudflare Pages
```

Set `VITE_CONVEX_URL` as a build-time environment variable in the Cloudflare Pages project settings.

### Convex Backend → Convex Cloud

```powershell
npx convex deploy
```

Set `RESEND_API_KEY` and `CONVEX_SITE_URL` in the Convex deployment's environment variable settings (dashboard or `npx convex env set`).

### Cloudflare Worker → Cloudflare Workers

```powershell
cd workers/presign
npx wrangler deploy
```

Wire R2 bucket binding and Convex deployment URL in `wrangler.toml` (Phase 4).

---

## Security Model

| Concern | Mitigation |
|---------|-----------|
| **Authentication** | All Convex functions call `getAuthUserId(ctx)` and throw `Unauthenticated` if no session. No function is publicly callable without auth (except the auth HTTP actions themselves). |
| **Authorization** | Workspace membership is checked in every query and mutation. Users can only access data in workspaces they belong to. |
| **Owner-only operations** | Rename workspace, invite/remove members, revoke invites are guarded by `ownerId` or `role === 'owner'` checks. |
| **Input validation** | All Convex function args are validated by Convex's `v.*` validator system. Forms use Zod schemas. |
| **HTML injection** | Rich text content is sanitized with DOMPurify before inclusion in SCORM exports. Allowed tags are explicitly allowlisted. |
| **File uploads** | Upload URLs are short-lived (Convex Storage) and require authentication to generate. Files are never proxied through application code. |
| **Invite expiry** | Pending invites expire after 7 days. Expired invites are filtered at query time and not accepted. |
| **CSRF** | Not applicable — the app uses Convex's token-based auth (JWT in IndexedDB), not cookie-based sessions. |

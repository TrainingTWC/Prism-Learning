<!-- GSD:project-start source:PROJECT.md -->
## Project

**Prism Authoring**

Prism Authoring is a Rise-360-style learning module authoring tool for small teams. Authors collaborate in realtime to build polished, themed, block-based learning modules — text, images, video embeds, quizzes, accordions, and Lottie animations — and export them as SCORM 1.2 packages that drop straight into any LMS.

The product is for a small team of authors (the user + a few collaborators) who currently lack a clean, opinionated tool for producing modular learning content without design effort.

**Core Value:** **A team author can sit down, build a themed, multi-block lesson collaboratively in realtime, and export a working SCORM 1.2 zip that runs in their LMS — without writing code, fighting layout, or installing anything.**

If theming, realtime co-editing, and a valid SCORM export all work, the product is useful. Everything else is polish.

### Constraints

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
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Locked Stack (Not Researched — Project Constraints)
| Technology | Purpose | Source |
|------------|---------|--------|
| Vite + React 19 | SPA build + UI | PROJECT.md constraint |
| Convex | Auth, DB, realtime sync, server functions | PROJECT.md constraint |
| Cloudflare Pages | Static SPA hosting | PROJECT.md constraint |
| Cloudflare R2 | Asset storage (images, Lottie JSON, SCORM zips) | PROJECT.md constraint |
| Cloudflare Workers | Edge compute (signed uploads, optional SCORM assembly) | PROJECT.md constraint |
| TypeScript 5.9+ | Implied by all recommended libs | Convention |
## Recommended Stack
### Core Authoring Libraries
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@tiptap/react` + `@tiptap/starter-kit` | `^3.23.6` | Rich-text block editor (ProseMirror-based) | Industry standard for block-aware rich text in React. v3 is stable with active weekly releases. Headless — styles cleanly with Tailwind. PROJECT.md already locks this choice. |
| `@tiptap/extension-collaboration-caret` | `^3.23.6` | Presence cursors (optional) | Only needed if running Y.js. For Convex LWW-per-field model, skip this and render presence via plain Convex queries. |
| `@dnd-kit/core` + `@dnd-kit/sortable` | `^6.3.x` / `^10.x` | Drag-and-drop reorder for lessons and blocks | Stable, accessible (keyboard support out of the box), zero-dep, framework-agnostic. The "classic" `@dnd-kit/core` API is production-proven; the newer `@dnd-kit/react` v0.4 rewrite is still pre-1.0 with churning API — avoid for v1. |
| `scorm-again` | `^3.0.4` | SCORM 1.2 (and 2004) runtime API for the exported package | The de facto modern SCORM JS runtime. Maintained by jcputney, full SCORM 1.2 + 2004 support, TypeScript types, ESM, granular imports (`scorm-again/scorm12/min` — ~tiny bundle for 1.2-only). Used by Articulate-class tools. |
| `jszip` | `^3.10.1` | Build SCORM `.zip` package in-browser or in a Worker | Battle-tested, works in browser + Workers, streaming-capable. The lighter `fflate` is faster but less ergonomic; JSZip's API matches the "build a directory tree then `generateAsync({type:'blob'})`" mental model that SCORM packaging needs. |
| `@lottiefiles/dotlottie-react` | `^0.19.4` (wraps `@lottiefiles/dotlottie-web@^0.74.0`) | Lottie playback (block + exported runtime) | Official LottieFiles modern player built on Rust→WASM (dotlottie-rs / thorvg). Faster and smaller than legacy `lottie-web`, supports both `.json` and `.lottie` formats, actively maintained. Works in plain HTML for the SCORM export bundle too. |
### UI / Styling
| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `tailwindcss` | `^4.x` | Utility-first styling | Tailwind v4 (Lightning CSS engine, zero-config, CSS-first theming via `@theme`) is the 2025/2026 default for Vite+React. CSS variables map cleanly to per-workspace theme (primary/accent/fonts). |
| `shadcn/ui` (copy-in components) | latest CLI | Headless accessible component primitives (Button, Dialog, Popover, Select, Tabs, Toast, etc.) | Not an npm dep — uses Radix UI primitives + Tailwind, source-copied via CLI. Fully customizable, no runtime bloat, themeable via CSS vars. The standard 2025/2026 choice for "polished but bespoke" React UIs. |
| `@radix-ui/react-*` | latest | Underlying accessible primitives (pulled in by shadcn) | WAI-ARIA correct, keyboard-friendly, headless. Used by shadcn. |
| `lucide-react` | `^0.460.x` | Icons | Tree-shakeable, default with shadcn/ui, large set, MIT. |
| `class-variance-authority` + `tailwind-merge` + `clsx` | latest | Variant + className composition helpers | Standard shadcn companions for type-safe component variants. |
| `next-themes` (or `usehooks-ts` equivalent) | `^0.4.x` | Light/dark mode toggle (if desired) | Works in Vite SPAs despite the name. Optional for v1. |
### State, Forms, Routing
| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `convex` (React client) | `^1.x` (latest) | Server state, queries, mutations, realtime sync, file storage | Locked. Convex's React hooks (`useQuery`, `useMutation`) ARE the state layer for server data. Do not duplicate server data into Zustand. |
| `zustand` | `^5.x` | Local-only UI state (selected block, draft toolbar state, drag indicators, modal flags) | Tiny (~1 KB), simple, no provider. Use ONLY for ephemeral client-only state. Convex owns the rest. Jotai is fine too but Zustand's store model fits this app's coarse-grained state better. |
| `react-hook-form` | `^7.54.x` | Form state (theme editor, module create dialog, quiz authoring) | De facto React form lib. Tiny, performant, integrates with Zod. |
| `zod` | `^3.24.x` | Schema validation (forms + Convex args + SCORM manifest validation) | Universal schema layer. Use the SAME zod schemas in Convex `args` validators and in `react-hook-form` resolvers. |
| `@hookform/resolvers` | `^3.10.x` | Zod ↔ react-hook-form bridge | Standard glue. |
| `@tanstack/react-router` | `^1.168.x` | Client-side routing | Type-safe routes, file-based or code-based, first-class search-param validation with Zod, excellent loaders. Better fit than React Router v7 for a typed Vite SPA. Adds slight learning curve — if the team strongly prefers familiarity, `react-router@^7.x` (declarative mode, not framework mode) is an acceptable fallback. |
### Auth
| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `@convex-dev/auth` (Convex Auth) | latest beta | Magic-link auth, sessions, user records — all inside Convex | Magic links are a first-class flow in Convex Auth via the email OTP / magic link provider. No third-party service, no extra hosting, integrates with Convex's `ctx.auth` natively. PROJECT.md scope (one team, no OAuth, no passwords) is exactly Convex Auth's sweet spot. Beta status accepted — the magic-link flow is the most stable part of the surface. |
| `resend` (or AWS SES) | latest | Transactional email provider for magic links | Resend's React Email + free tier is the smoothest setup; Convex Auth has a documented Resend integration. SES is the cheaper at-scale alternative. |
### SCORM Packaging
| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `jszip` | `^3.10.1` | Zip construction | See above. |
| `scorm-again` (`scorm-again/scorm12/min`) | `^3.0.4` | Runtime API shim bundled INTO the exported package | Bundle the SCORM 1.2 min build (~15 KB gzipped) into the exported zip's `assets/`. The exported `index.html` instantiates `Scorm12API`, attaches to `window.API`, and quiz blocks call `LMSSetValue`/`LMSCommit`/`LMSFinish`. |
| `fast-xml-parser` (or template string) | `^4.x` | Build/validate `imsmanifest.xml` | A simple template string is enough for v1 (the manifest is small and templatable); use `fast-xml-parser` only if you also want to **parse** existing manifests for diagnostics. |
| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Client-side (browser, JSZip)** | Zero infra, no upload roundtrip, instant download, no Worker CPU/time limits to worry about for typical module sizes (<50 MB) | Locks up tab briefly on huge modules; assets must be re-fetched from R2 to browser before bundling | **Recommended for v1.** Simpler, faster perceived UX for the realistic module size (a few MB to ~20 MB). |
| **Worker-side (Cloudflare Worker, JSZip or `fflate`)** | Offloads CPU; the user just downloads a pre-built zip URL | Worker CPU time limit (50 ms free / 30 s paid bundled); must stream R2 assets through Worker; more moving parts | Defer to v2 if module sizes ever exceed comfortable client packaging. |
### Testing
| Tool | Version | Purpose | Why Recommended |
|------|---------|---------|-----------------|
| `vitest` | `^2.1.x` | Unit + component tests | Native Vite integration, Jest-compatible API, fast watch mode. Standard 2025/2026 choice for Vite projects. |
| `@testing-library/react` | `^16.x` | React component testing | Standard, accessibility-oriented. |
| `@testing-library/user-event` | `^14.x` | Realistic input simulation | Required for testing drag interactions and rich-text input. |
| `playwright` | `^1.49.x` | End-to-end (authoring flow, export-and-validate flow) | Best browser automation; the export flow E2E test should drive the app, download the zip, unzip in test, parse `imsmanifest.xml`, and assert structure. |
| `convex-test` | latest | Convex function unit tests with in-memory backend | Official Convex testing harness. |
| `msw` (Mock Service Worker) | `^2.x` | Mock external HTTP (Resend, YouTube/Vimeo oEmbed, R2 signed-URL endpoints) | Standard. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| `vite` | Build + dev server | v6+. With `@vitejs/plugin-react`. |
| `@vitejs/plugin-react` | React Fast Refresh | v4+. |
| `typescript` | Type checking | `^5.9.x`. Strict mode on. |
| `eslint` + `eslint-config-prettier` + `eslint-plugin-react-hooks` | Linting | Use the flat config (`eslint.config.js`). |
| `prettier` | Formatting | With `prettier-plugin-tailwindcss` for class sorting. |
| `wrangler` | Cloudflare Worker dev + deploy | Required for any Worker code (signed-upload endpoint, future Worker-side zip). |
| `convex` CLI | Convex deploy + codegen | `npx convex dev` during development. |
| SCORM Cloud test player | Validate exported zips against a real SCORM 1.2 player | Free tier sufficient for v1; this is the source-of-truth validator per PROJECT.md compliance constraint. |
## Installation
# Core runtime
# UI
# shadcn/ui components are added via CLI per-component, not installed:
# Dev
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Tiptap** | Lexical (Meta), Slate, BlockNote, Plate, Novel | Lexical has excellent perf but ProseMirror's mature node/mark model and Tiptap's extension ecosystem (drag handle, mentions, tables, collaboration, lists, code) win for a block-based authoring tool. BlockNote is Tiptap-on-top so worth a look if you want a pre-built "Notion-block" UX — but you trade design control. PROJECT.md already locks Tiptap. |
| **shadcn/ui + Tailwind** | Mantine, Chakra UI, MUI, Park UI, HeroUI/NextUI | shadcn lets you fully own the components — critical because the workspace theme (primary/accent/fonts) must apply consistently to authoring preview AND exported SCORM HTML. Pre-styled libraries (Mantine, Chakra, MUI) make custom theming harder and ship more runtime CSS than needed. |
| **`@dnd-kit/core` (classic stable API)** | `@dnd-kit/react` v0.4 (new rewrite), `react-dnd`, `framer-motion` Reorder, `react-beautiful-dnd` (deprecated), Pragmatic drag-and-drop (Atlassian) | The new `@dnd-kit/react` v0.4.x is a promising rewrite but still pre-1.0 with breaking changes in late 2026 — use stable `@dnd-kit/core` for v1. `react-beautiful-dnd` is officially deprecated. Atlassian's Pragmatic DnD is excellent but heavier API. |
| **scorm-again** | rustici-software pipwerks SCORM API (`pipwerks-scorm-api-wrapper`), custom hand-rolled API | pipwerks is the legacy choice (last meaningful update ~2019); scorm-again is the modern, typed, maintained successor with bundled SCORM 1.2 + 2004 + cross-frame + event hooks. Hand-rolling a SCORM 1.2 API is well-documented but reinvents tested code. |
| **JSZip** | `fflate`, `client-zip`, `@zip.js/zip.js` | `fflate` is ~3× faster and smaller but has a lower-level API; `client-zip` streams beautifully but is write-only. JSZip's read+write+folder API best matches "build a manifest tree" needs. Swap to `fflate` only if zip times become a UX problem. |
| **@lottiefiles/dotlottie-react** | `lottie-react` (wraps lottie-web), `lottie-web` directly, `@lottiefiles/react-lottie-player` (legacy) | Classic `lottie-web` works but is unmaintained-ish and ~250 KB. dotLottie format is smaller, faster (WASM/thorvg), and the modern recommendation from LottieFiles themselves. Falls back to plain `.json` Lotties — backwards compatible. |
| **TanStack Router** | `react-router` v7 (declarative mode), `wouter`, `@tanstack/start` | React Router v7 is fine and more familiar; pick it if the team has React Router muscle memory. TanStack Router's typed search params and loaders pay off heavily once you have nested authoring routes (`/workspace/:wsId/module/:modId/lesson/:lessonId`). Wouter is too minimal for this app. Do NOT use `@tanstack/start` — it's an SSR framework and conflicts with the Cloudflare Pages "static SPA" constraint. |
| **Zustand** | Jotai, Valtio, Redux Toolkit, React Context | Jotai (atom-based) is equally good — pick whichever the team prefers. Both are tiny. Avoid Redux Toolkit (overkill for ephemeral UI state when Convex owns server state). |
| **Convex Auth (magic link)** | Clerk + Convex, WorkOS AuthKit + Convex, Auth.js + Convex adapter, custom JWT via Workers | Clerk/WorkOS are great but add a paid third-party for what is fundamentally "send an email, set a session" for a small team. PROJECT.md explicitly chose magic-link-only to keep auth simple — Convex Auth fits that scope precisely with no extra vendor. Choose Clerk later if SSO/MFA/orgs become requirements. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `lottie-web` (classic) | Larger bundle, slower, unmaintained CSS/HTML renderer paths, no dotLottie support | `@lottiefiles/dotlottie-react` |
| `react-beautiful-dnd` | Officially deprecated by Atlassian (Oct 2024) | `@dnd-kit/core` + `@dnd-kit/sortable` |
| `pipwerks-scorm-api-wrapper` | Stagnant for years, no TS types, no SCORM 2004 unification | `scorm-again` |
| `next.js` | Requires a server runtime; Cloudflare Pages is static-only per PROJECT.md constraint. The whole reason Vite was chosen. | `vite` + `@tanstack/react-router` |
| `@tanstack/start` | SSR framework — conflicts with static SPA constraint | `@tanstack/react-router` (router only) |
| `material-ui (mui)` | Heavy runtime, opinionated styling, hard to theme deeply per-workspace | `shadcn/ui` + Tailwind |
| Convex storage for module assets (large images, Lottie, exported zips) | Convex storage is fine for small blobs but R2 is cheaper, has free egress on Workers, and was explicitly chosen in PROJECT.md | Cloudflare R2 via signed PUT URLs from a Worker (or Convex action) |
| `firebase` / `supabase` / `liveblocks` / raw `y-websocket` server | Duplicates Convex's realtime; PROJECT.md explicitly collapsed these into Convex | Convex queries/mutations + per-field LWW |
| Auth.js (NextAuth) | Designed for Next.js server runtime; awkward in a pure Vite SPA | Convex Auth (or Clerk if scope grows) |
| `webpack` / Create React App | CRA is deprecated; webpack is slower than Vite for dev | Vite |
| `jest` | Slower than Vitest for Vite projects; double config burden | Vitest |
| Y.js for Tiptap collaboration (in v1) | Requires a y-websocket-style provider; adding one duplicates Convex's job and creates two source-of-truth systems. PROJECT.md accepts per-field LWW. | Plain Tiptap with content persisted to Convex on debounced change; presence via Convex query |
## Stack Patterns by Variant
- Add Y.js + `@tiptap/extension-collaboration` + a custom Convex-backed Y.js provider (or a hosted provider like Tiptap Cloud, Liveblocks, or Hocuspocus)
- Until then, per-field LWW via Convex mutations is sufficient and matches PROJECT.md
- Move zip assembly from browser to Cloudflare Worker (`fflate` recommended over JSZip in Workers for speed)
- Stream assets directly from R2 → Worker → zip → R2-uploaded download URL
- Reconsider SCORM 2004 — `scorm-again` already supports it; the work is in `imsmanifest.xml` rewrites, not the JS API
- Migrate auth from Convex Auth → Clerk or WorkOS for orgs/SSO/audit logging
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| React `19.x` | All recommended libs | Tiptap v3, dnd-kit, dotlottie-react, TanStack Router, shadcn all support React 19. |
| Tailwind `4.x` | Vite 6+ via `@tailwindcss/vite` plugin | v4 dropped PostCSS-only setup in favor of the Vite plugin; shadcn/ui CLI now supports v4 out of the box. |
| Tiptap `3.x` | ProseMirror `1.x` (peer dep via `@tiptap/pm`) | Always install `@tiptap/pm` alongside `@tiptap/react`. |
| `@dnd-kit/core` `6.x` (stable) | React 17 / 18 / 19 | Do not mix with `@dnd-kit/react` v0.4 — different package, different API. |
| `scorm-again` `3.x` | Modern browsers; for IE11 needs a fetch polyfill (not relevant for this product) | Import `scorm-again/scorm12/min` only — saves ~30 KB vs full bundle. |
| `convex` client + `@convex-dev/auth` | Convex deployment must have Auth tables migrated | Run `npx convex dev` after adding the auth package. |
| TanStack Router `1.168.x` | Vite 6+, React 19 | The numerous `@tanstack/*-start*` packages in the same monorepo are for SSR — ignore them; only install `@tanstack/react-router`. |
## Sources
- `scorm-again` README and v3.0.4 release — https://github.com/jcputney/scorm-again (verified May 2026, v3.0.4 latest, full SCORM 1.2 + 2004, cross-frame, granular ESM imports) — HIGH confidence
- Tiptap releases — https://github.com/ueberdosis/tiptap/releases (v3.23.6 confirmed latest, May 2026) — HIGH confidence
- TanStack Router releases — https://github.com/TanStack/router/releases (1.168.x range confirmed late May 2026) — HIGH confidence
- dnd-kit releases — https://github.com/clauderic/dnd-kit/releases (v0.4.0 new rewrite released Apr 2026; classic `@dnd-kit/core` 6.x remains stable production choice) — HIGH confidence
- LottieFiles dotlottie-web releases — https://github.com/LottieFiles/dotlottie-web/releases (`@lottiefiles/dotlottie-react@0.19.4` wrapping `dotlottie-web@0.74.0`) — HIGH confidence
- Convex Auth docs — https://docs.convex.dev/auth (magic-link via Convex Auth library, beta but supported) — HIGH confidence for core flow, MEDIUM for long-term stability (beta status acknowledged)
- shadcn/ui — https://ui.shadcn.com (canonical 2025/2026 React+Tailwind component approach) — HIGH confidence
- PROJECT.md — Locked stack constraints (Vite, React, Convex, Cloudflare Pages/Workers/R2, magic-link, SCORM 1.2) — AUTHORITATIVE
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

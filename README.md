# Prism Learning

Rise-360-style collaborative learning module authoring tool. Authors build themed, block-based modules and export them as SCORM 1.2 packages.

See [`.planning/PROJECT.md`](.planning/PROJECT.md) and [`.planning/ROADMAP.md`](.planning/ROADMAP.md) for full scope.

## Repo layout

```
apps/
  web/                Vite + React 19 SPA (authoring tool)
packages/
  renderer/           @prism/renderer — pure React renderer (purity-boundary enforced)
convex/               Convex backend (auth, DB, realtime, server functions)
workers/
  presign/            Cloudflare Worker — R2 presigned PUT/GET
.planning/            GSD project artifacts (PROJECT, ROADMAP, STATE, REQUIREMENTS, research)
```

## Prerequisites

- Node.js ≥ 20.11 (tested with 24.x)
- pnpm 9 (`npm install -g pnpm@9`)
- A Convex account (`npx convex dev` walks you through it)
- A Cloudflare account (for R2 + Workers, used from Phase 1 onward)

## Setup

```powershell
pnpm install
copy .env.example .env.local
```

## Run

```powershell
# SPA dev server (http://localhost:5173)
pnpm dev

# Convex backend (separate terminal) — first run prompts to create a deployment
pnpm dev:convex

# Cloudflare Worker (separate terminal)
pnpm dev:worker
```

When `npx convex dev` prints your deployment URL, paste it into `.env.local` as `VITE_CONVEX_URL` and restart `pnpm dev`.

## Scripts

| Script | What it does |
|--------|--------------|
| `pnpm dev` | Run the Vite SPA |
| `pnpm dev:convex` | Run Convex backend in dev mode |
| `pnpm dev:worker` | Run the presign Worker via `wrangler dev` |
| `pnpm build` | Build all packages, then the SPA |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm lint` | Run ESLint (root config + renderer purity rules) |
| `pnpm format` | Run Prettier |

## Architectural rules (load-bearing)

1. **Renderer purity** — `packages/renderer` may NOT import `convex/*`, call `fetch`, or use auth. The package's own `eslint.config.js` enforces this. The renderer drives both authoring preview AND the SCORM export runtime, so any I/O leaking in breaks export.
2. **One Convex document per block** — Convex's 1 MB document cap forces fine-grained docs from day one. No "module-wide JSON blob".
3. **Theme baked at export** — themes are append-only, versioned; SCORM exports reference a frozen version.
4. **Assets bypass Convex** — bytes flow `browser → R2` via a Worker-presigned PUT URL. Convex authorizes; bytes never traverse it.

## Status

Scaffold only — Phase 1 (Foundations & Auth) has not started.
Next entry point: `/gsd-discuss-phase 1` or `/gsd-ui-phase 1`.

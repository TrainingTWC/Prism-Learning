---
quick_id: 260710-eyl
status: planned
---

# Quick Task 260710-eyl: Rename "Prism Learning" → "Prism Authoring"

Full rebrand per user decision: user-facing text AND internal references (package.json,
CLAUDE.md, planning docs), but NOT the GitHub repo, Cloudflare project names, or Convex
deployment name (infra-level, out of scope; user is separately pointing a new custom
domain `authoring.prismintelligence.in` at the existing Cloudflare Pages project).

## Task 1: Rename across codebase and docs

**Files:**
- `apps/web/index.html` — `<title>`
- `apps/web/src/pages/DashboardPage.tsx` — title prop, wordmark JSX
- `apps/web/src/pages/SignInPage.tsx` — alt text, wordmark JSX
- `apps/web/src/components/PrismWorkspaceShell.tsx` — default workspace name fallback, alt text, wordmark span, search placeholder
- `apps/web/src/components/MobileGuard.tsx` — mobile-blocked message
- `apps/web/src/pages/RendererDemoPage.tsx` — welcome heading
- `apps/web/src/pages/IntelligenceDashboardPage.tsx` — title prop, welcome heading
- `apps/web/src/lib/scormExport.ts` — CSS comment header in exported theme
- `convex/auth.ts` — AUTH_EMAIL_FROM fallback, magic-link email subject/heading
- `convex/members.ts` — AUTH_EMAIL_FROM fallback, invite email subject/body
- `convex/analytics.ts` — comment: "Prism Learning (PL)" → "Prism Authoring (PA)", subsequent PL→PA shorthand
- `convex/schema.ts` — one comment referencing "PL workspace"
- `workers/presign/src/index.ts` — file header comment
- `package.json` (root) — `"name"` field
- `README.md` — title + description occurrences
- `.env.example` — header comment + AUTH_EMAIL_FROM example
- `CLAUDE.md` — `## Project` section name + description
- `.planning/PROJECT.md` — H1 + description
- `.planning/ROADMAP.md` — H1
- `.planning/STATE.md` — H1 + Name field

**Action:** Literal string replacement of "Prism Learning" → "Prism Authoring" and
"prism-learning" → "prism-authoring" (package.json name) in each listed file, plus the
split-JSX `Prism <span>Learning</span>` → `Prism <span>Authoring</span>` wordmark pattern
in DashboardPage.tsx and SignInPage.tsx.

**Explicitly out of scope (do not touch):** GitHub repo name, Cloudflare Pages project
name, Convex deployment name/slug, historical planning artifacts under
`.planning/quick/*`, `.planning/debug/*`, `.planning/research/*` (point-in-time records),
`.planning/REQUIREMENTS.md`, `.planning/DESIGN.md`, `.planning/ANALYTICS_PLAN.md` (locked
historical specs, not living identity docs).

**Verify:** `npx tsc --noEmit` in `apps/web` passes; `grep -rn "Prism Learning" apps/web/src convex workers package.json README.md .env.example CLAUDE.md .planning/PROJECT.md .planning/ROADMAP.md .planning/STATE.md` returns no matches.

**Done:** All in-scope occurrences renamed; typecheck clean; no remaining "Prism Learning" strings in the listed live files.

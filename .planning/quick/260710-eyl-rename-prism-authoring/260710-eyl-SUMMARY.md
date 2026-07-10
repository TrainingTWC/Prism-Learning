---
quick_id: 260710-eyl
status: complete
---

# Quick Task 260710-eyl: Rename "Prism Learning" → "Prism Authoring" — Summary

Renamed the app from "Prism Learning" to "Prism Authoring" across user-facing text and
internal references, per user decision (full rebrand except GitHub repo, Cloudflare
project names, and Convex deployment name — those stay as-is; user is pointing a new
custom domain `authoring.prismintelligence.in` at the existing Cloudflare Pages project).

**Changed:**
- User-facing UI: page title, sidebar wordmark/logo alt text, sign-in page heading,
  dashboard headings, mobile-blocked message, renderer demo page, intelligence dashboard,
  workspace search placeholder.
- Email templates (`convex/auth.ts`, `convex/members.ts`): `AUTH_EMAIL_FROM` fallback,
  magic-link subject/heading, invite email subject/body.
- Exported SCORM CSS theme comment header (`apps/web/src/lib/scormExport.ts`).
- Internal comments: `convex/analytics.ts` and `convex/schema.ts` PL→PA shorthand.
- `workers/presign/src/index.ts` file header comment.
- `package.json` root `"name"`: `prism-learning` → `prism-authoring`.
- `README.md`, `.env.example`, `CLAUDE.md`, `.planning/PROJECT.md`,
  `.planning/ROADMAP.md`, `.planning/STATE.md` — title/name/description lines.

**Explicitly left unchanged:** GitHub repo name/URL (`README.md`'s clone instructions
still reference `prism-learning.git`), Cloudflare Pages project name, Convex deployment
slug, and historical planning artifacts (`.planning/REQUIREMENTS.md`,
`.planning/DESIGN.md`, `.planning/ANALYTICS_PLAN.md`, `.planning/research/*`,
`.planning/quick/*` (older tasks), `.planning/debug/*`) — those are point-in-time records,
not living identity docs.

**Still needed (not part of this code change, tracked separately):** once the new
`authoring.prismintelligence.in` custom domain is live, the Convex `SITE_URL` env var
(`npx convex env set SITE_URL https://authoring.prismintelligence.in --prod`) must be
updated to match — magic links and invite links are built from it. Currently still set to
the old `learning.prismintelligence.in`.

**Verification:** `npx tsc --noEmit` clean in `apps/web`; convex functions typecheck
clean; `grep -rn "Prism Learning"` across all in-scope files returns no matches (only
the intentionally-excluded repo-URL/folder-name mentions in README.md and historical
planning docs remain).

**Files changed:**
- apps/web/index.html
- apps/web/src/pages/DashboardPage.tsx
- apps/web/src/pages/SignInPage.tsx
- apps/web/src/components/PrismWorkspaceShell.tsx
- apps/web/src/components/MobileGuard.tsx
- apps/web/src/pages/RendererDemoPage.tsx
- apps/web/src/pages/IntelligenceDashboardPage.tsx
- apps/web/src/lib/scormExport.ts
- convex/auth.ts
- convex/members.ts
- convex/analytics.ts
- convex/schema.ts
- workers/presign/src/index.ts
- package.json
- README.md
- .env.example
- CLAUDE.md
- .planning/PROJECT.md
- .planning/ROADMAP.md
- .planning/STATE.md

---
phase: quick-261022-l8f
plan: 01
subsystem: web-authoring
tags: [router, ux, preview, tab-title]
key-files:
  created:
    - apps/web/src/lib/editorNav.ts
    - apps/web/src/lib/editorNav.test.ts
    - apps/web/src/lib/useDocumentTitle.ts
  modified:
    - apps/web/src/router.tsx
    - apps/web/src/pages/ModuleEditorPage.tsx
    - apps/web/src/pages/PreviewPage.tsx
metrics:
  completed: 2026-10-22
---

# Quick 261022-l8f: Tab titles, preview start options, return-to-lesson

Active lesson is now URL state (`?lesson=` on editor, `?lesson=&returnTo=` on preview) via TanStack `validateSearch`; no Convex changes.

## Commits
- b0ed04e test: failing tests for editor nav helpers (RED)
- 06dace5 feat: editor nav + tab title helpers (GREEN)
- feat: preview start options, return to edited lesson, per-module tab titles (router, ModuleEditorPage, PreviewPage)

## What changed
- Tab titles: "{module} · Prism Authoring" in editor, "Preview · {module} · Prism Authoring" in preview; restored on unmount.
- Editor Preview button is a dropdown: "From the beginning" / "From this lesson" (disabled when no active lesson).
- Editor seeds lesson from `?lesson=` (unknown id -> first lesson) and syncs state to URL with `replace: true`.
- Preview seeds start lesson once (ref guard); Back link and iframe Exit return to `returnTo` lesson.

## Deviations from Plan
- Worktree base was not b5e53ec; reset to it as instructed. Ran `pnpm install --frozen-lockfile` (no node_modules in worktree).
- Added an eslint-disable for exhaustive-deps on the seed effect (intentional: URL only seeds the initial selection).

## Verification
Typecheck, eslint, and full web test suite (39 tests) pass. Manual browser check (human-check in plan) not performed.

## Self-Check: PASSED

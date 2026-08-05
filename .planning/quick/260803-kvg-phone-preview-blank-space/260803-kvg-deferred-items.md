# Deferred Items — quick-260803-kvg

Out-of-scope issues discovered during execution of `260803-kvg-PLAN.md` Task 1. Not
fixed here because they are pre-existing and unrelated to `PreviewPage.tsx`.

## Repo-wide ESLint config gap

`pnpm lint --max-warnings=0` (run from repo root) fails with 76 errors / 29 warnings
across many unrelated files:

- `Definition for rule 'react/no-danger' was not found` and
  `Definition for rule 'jsx-a11y/media-has-caption' was not found` — `eslint.config.js`
  references rules from `eslint-plugin-react` and `eslint-plugin-jsx-a11y`, but neither
  package is present in `node_modules` (confirmed via `ls node_modules/eslint-plugin-react`
  / `eslint-plugin-jsx-a11y` — both missing). Affects: `AccordionBlockEditor.tsx`,
  `CalloutBlockEditor.tsx`, `ImageBlockEditor.tsx`, and every `packages/renderer/src/*Renderer.tsx`
  file that uses `dangerouslySetInnerHTML`.
- Assorted pre-existing `@typescript-eslint/no-unused-vars` and
  `@typescript-eslint/no-explicit-any` findings scattered across many component/Convex
  files (e.g. `blockId` unused-arg warnings in most `*BlockEditor.tsx` files,
  `no-explicit-any` errors in a large file around line ~1183, `workers/presign/src/index.ts`
  empty-interface error).

**Why deferred:** Fixing the plugin gap requires installing new npm packages
(`eslint-plugin-react`, `eslint-plugin-jsx-a11y`), which is explicitly excluded from
Rule 3 auto-fix and requires a human package-legitimacy check per this project's
deviation rules. The remaining unused-vars/no-explicit-any findings are in files
completely unrelated to this task (`PreviewPage.tsx` itself has zero lint findings).

**Suggested follow-up:** A separate quick task or chore ticket to (a) add the missing
ESLint plugin packages after legitimacy verification, and (b) clean up the pre-existing
`no-unused-vars`/`no-explicit-any` findings repo-wide.

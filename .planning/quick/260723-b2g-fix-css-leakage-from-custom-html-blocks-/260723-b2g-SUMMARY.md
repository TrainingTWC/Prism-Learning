---
status: incomplete
---

# Quick Task 260723-b2g: Fix CSS leakage from custom-html blocks — Summary

**Status:** 2/3 tasks complete. Task 3 is a blocking human-verify checkpoint — not executed by design.

## What changed

**Task 1 — React render path** (`packages/renderer/src/CustomHtmlBlockRenderer.tsx`, commit `fb0de00`):
Replaced the `dangerouslySetInnerHTML` div with a `ref` + `useEffect` mount that calls `element.attachShadow({ mode: 'open' })` and sets `shadowRoot.innerHTML` to the DOMPurify-sanitized HTML. `PURIFY_CONFIG` and sanitization behavior are unchanged — style/link tags still pass through, but are now fully scoped inside the shadow root instead of landing in the light DOM. The host div keeps its existing `prism-custom-html my-6` classes, so the pre-existing `overflow-x` containment CSS still applies (it targets the host, not shadow content).

**Task 2 — SCORM/preview export path** (`apps/web/src/lib/scormExport.ts`, commit `4cc5f31`):
The `customHtml` block-rendering case now emits a `prism-custom-html` host div containing an inert `<template>` (holding the sanitized HTML) plus an inline bootstrap `<script>`. That script attaches an open shadow root to the host, copies the template content into it, then explicitly re-creates and re-inserts any `<script>` elements found inside — because assigning to `.innerHTML` does not execute embedded scripts, and author-authored widgets in these blocks may rely on inline `<script>` to function. `deferExternalScripts` and the existing `.prism-custom-html` CSS rule (host-level overflow containment) are untouched. No DOMPurify config changes.

## Verification run (automated)

All passed on the merged code:
- `pnpm --filter @prism/renderer typecheck`
- `pnpm --filter @prism/web typecheck`
- `pnpm -r typecheck`
- `pnpm --filter @prism/renderer build`
- `pnpm --filter @prism/web build`
- `pnpm exec eslint` on both changed files

One pre-existing, unrelated `no-useless-escape` lint warning was found in the `sorting` block case of `scormExport.ts`. Confirmed present in the pre-dispatch base commit (`ff3430a`) — out of scope for this fix, logged as a deferred item rather than fixed.

## Task 3 — Checkpoint (not executed, requires manual verification)

**Type:** `checkpoint:human-verify`, gate = blocking.

**What to verify:** Both render paths (live React `CustomHtmlBlockRenderer` in the authoring/preview UI, and the SCORM-exported static HTML) now shadow-scope custom-html content so CSS cannot leak in either direction.

**How to verify:**
1. In the authoring UI, add/edit a Custom HTML block and paste something like:
   ```html
   <style>
     body { font-family: "Comic Sans MS", cursive; }
     :root { --prism-font-heading: "Comic Sans MS", cursive; }
   </style>
   <div class="my-widget">Hello</div>
   ```
2. Confirm the lesson title and rest of the page (e.g. the "Activity" heading, editor chrome) do **not** change font — the leak is gone.
3. Confirm CSS scoped to `.my-widget` (or similar pasted selectors) still visually applies *inside* the custom-html block itself — pasted styling for the author's own widget must still work.
4. Confirm horizontal overflow containment still holds (wide pasted content scrolls within the block, doesn't blow out page width).
5. Export the module as a SCORM package, unzip it, and repeat steps 1–4 against the exported static HTML in a browser (or SCORM Cloud test player) — including confirming that any `<script>` in the pasted HTML still executes (e.g. a script that mutates the widget's DOM on load).

**Resume signal:** Report "approved" if isolation holds in both surfaces, or describe what leaked/broke, so a follow-up session can address it.

## Files modified
- `packages/renderer/src/CustomHtmlBlockRenderer.tsx`
- `apps/web/src/lib/scormExport.ts`

## Commits
- `fb0de00` — fix(260723-b2g): shadow-mount React custom-html renderer
- `4cc5f31` — fix(260723-b2g): shadow-scope custom-html in SCORM/preview export

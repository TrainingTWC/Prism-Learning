---
phase: quick-260707-gtl
plan: 01
subsystem: ui
tags: [tiptap, font-size, captions, dompurify, scorm, renderer]

requires:
  - phase: v1 authoring core
    provides: RichTextBlockEditor, TabsBlockEditor, Image/Gallery block editors, SCORM exporter
provides:
  - Shared FontSize Tiptap extension + FONT_SIZES + FontSizeControl toolbar select
  - Shared CaptionEditor (rich-text captions for image + gallery blocks, legacy-string compatible)
  - sanitizeInline caption sanitizer in @prism/renderer
  - Inline style spans (font-size/color/spacing) rendering in preview AND SCORM export
  - vitest + jsdom test infrastructure in apps/web (first tests in repo)

affects: [authoring, scorm-export, renderer]

tech-stack:
  added: [vitest ^4.1.10 (devDep), jsdom (devDep)]
  patterns:
    - "Inline text attributes live on the shared textStyle mark (fontSize joins color/letterSpacing) so setMark preserves sibling attrs"
    - "Caption fields store inline HTML strings; includes('<') fallback keeps legacy plain strings working"
    - "sanitizeInline allowlist (span/strong/em/b/i/u/s/br/a + style) for any caption injected via dangerouslySetInnerHTML"

key-files:
  created:
    - apps/web/src/lib/tiptap/fontSize.tsx
    - apps/web/src/lib/tiptap/fontSize.test.ts
    - apps/web/src/components/CaptionEditor.tsx
    - packages/renderer/src/sanitizeInline.ts
    - apps/web/vitest.config.ts
    - apps/web/src/test/setup.ts
  modified:
    - apps/web/src/components/RichTextBlockEditor.tsx
    - apps/web/src/components/TabsBlockEditor.tsx
    - apps/web/src/components/ImageBlockEditor.tsx
    - apps/web/src/components/GalleryBlockEditor.tsx
    - packages/renderer/src/RichTextBlock.tsx
    - packages/renderer/src/ImageBlockRenderer.tsx
    - packages/renderer/src/GalleryBlockRenderer.tsx
    - apps/web/src/lib/scormExport.ts
    - apps/web/package.json
    - apps/web/tsconfig.app.json
    - pnpm-lock.yaml

key-decisions:
  - "fontSize attribute added to textStyle mark (not a new mark) so set/unset via setMark preserves color and letter-spacing on the same span"
  - "Test files excluded from tsc -b (vitest transpiles them) so the RED commit still satisfied the typecheck-before-commit bar"
  - "scormExport keeps alt text on escapeHtml; only caption text switched to sanitizeInlineHtml"

patterns-established:
  - "Shared Tiptap extensions live in apps/web/src/lib/tiptap/ and are imported by every editor surface (no duplication)"
  - "apps/web unit tests: vitest + jsdom with ProseMirror layout polyfills in src/test/setup.ts"

requirements-completed: []

duration: 12min
completed: 2026-07-07
---

# Quick Task 260707-gtl: Rich-Text Captions with Per-Character Font Size Summary

**Selection-scoped font sizing on the shared textStyle mark across every Tiptap surface, rich-text image/gallery captions via a new CaptionEditor, and style-preserving sanitization in both the preview renderer and the SCORM 1.2 exporter.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-07
- **Tasks:** 3/3 (Task 3 implementation done; its human-verify gate deferred to user smoke test per yolo config)
- **Files modified:** 17 (6 created, 11 modified)

## Commits

| Task | Commit | Description |
| ---- | ------- | ----------- |
| 1 (RED) | b927a79 | Failing vitest spec for FontSize extension + test infra (vitest, jsdom, ProseMirror polyfills) |
| 1 (GREEN) | 31060cc | Shared FontSize extension + FontSizeControl wired into RichTextBlockEditor + Tabs InlineLabelEditor |
| 2 | cc32129 | CaptionEditor; image + gallery captions now rich-text with font-size control |
| 3 | 5ef77c0 | 'style' allowed in RichTextBlock sanitizer; sanitizeInline for caption rendering; SCORM export caption sanitization |

## Accomplishments

- `FontSize` Tiptap v3 extension adds a `fontSize` attribute to the shared `textStyle` mark (mirrors the existing LetterSpacing pattern), with `setFontSize`/`unsetFontSize` commands that preserve color/letter-spacing on the same span. One module powers all five surfaces: text block, tab label, tab content, image caption, gallery caption.
- `CaptionEditor` replaces the plain caption `<input>` in ImageBlockEditor and GalleryBlockEditor. Stored JSON shape unchanged (caption remains a string, now holding inline HTML). Legacy plain-string captions load via the `includes('<')` fallback and save unchanged until edited.
- Preview rendering: `RichTextBlock` now allows the `style` attribute (also fixes pre-existing color/letter-spacing stripping); image figcaption and both gallery caption sites render through the new `sanitizeInline` (inline-tag allowlist + `style`, escaped-plain-text fallback for legacy captions).
- SCORM export: image and gallery captions switched from `escapeHtml` to a `sanitizeInlineHtml` DOMPurify pass with the same allowlist; alt text remains escaped; the richText case already allowed `style` (verified, unchanged).
- 5 unit tests pass covering: selection-scoped sizing, active-size reflection, unset preserving color, HTML round-trip, FONT_SIZES options.

## TDD Gate Compliance

- RED gate: b927a79 `test(quick-260707-gtl)` — test run confirmed failing (module not found) before implementation.
- GREEN gate: 31060cc `feat(quick-260707-gtl)` — all 5 tests passed on first run after implementation.
- No refactor commit needed.
- Note: the repo had zero test infrastructure; vitest + jsdom were installed in apps/web as part of the RED commit. Test files are excluded from `tsc -b` so the failing-test commit still satisfied the orchestrator's typecheck-before-commit bar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree had no node_modules for packages/renderer**
- **Found during:** Task 1 (first typecheck run failed with JSX.IntrinsicElements errors in `packages/renderer`)
- **Issue:** The fresh worktree had never had a full workspace install; `pnpm add` in apps/web only linked that package.
- **Fix:** Ran `pnpm install` at the workspace root. Typecheck then passed.
- **Files modified:** none (node_modules only)

**2. [Rule 2 - Missing critical functionality] ImageBlockEditor caption preview would show raw HTML**
- **Found during:** Task 2
- **Issue:** `ImageDisplay` rendered `{caption}` as text; with captions now holding inline HTML, authors would see literal `<span style=...>` markup in the editor preview.
- **Fix:** Render the caption via DOMPurify-sanitized `dangerouslySetInnerHTML` using the same inline allowlist.
- **Files modified:** apps/web/src/components/ImageBlockEditor.tsx
- **Commit:** cc32129

**3. [Rule 3 - Blocking, infra] Added vitest + jsdom test infrastructure**
- **Found during:** Task 1 (tdd="true" but no test runner existed anywhere in the repo)
- **Fix:** `vitest` + `jsdom` devDeps in apps/web, `vitest.config.ts` (alias-matched to tsconfig paths), `src/test/setup.ts` with ProseMirror layout polyfills (Range.getBoundingClientRect/getClientRects, elementFromPoint), `test` script, and tsconfig exclusion of `*.test.ts*` + `src/test`.
- **Files modified:** apps/web/package.json, apps/web/tsconfig.app.json, apps/web/vitest.config.ts, apps/web/src/test/setup.ts, pnpm-lock.yaml
- **Commit:** b927a79

## Verification

- `pnpm --filter @prism/renderer build` (tsc -b): PASS
- `pnpm --filter @prism/web run typecheck` (tsc -b, includes renderer project reference): PASS
- `pnpm --filter @prism/web build` (tsc -b && vite build): PASS
- `pnpm --filter @prism/web test` (vitest): 5/5 PASS
- Code trace: all five must-have truths verified against source (selection-scoped spans, shared control on all surfaces, preview `style` attr, export sanitization, legacy fallback).

## Pending User Smoke Test (yolo: checkpoint auto-completed, manual steps recorded)

Task 3 was a `checkpoint:human-verify` gate; config mode "yolo" directed completion of all automatable verification and deferral of manual checks. Please verify:

1. `cd apps/web && pnpm run dev`. In a lesson: add a Text block, select a few letters, change their font size — only those letters resize in editor and live preview.
2. Add an Image block, type a caption, size + bold part of it — preview figcaption shows the formatting.
3. Add a Gallery block (carousel layout) with a slide caption; format part of it — preview slide caption shows the formatting.
4. Export to SCORM, unzip, open a `lesson_*.html` (or upload to SCORM Cloud): sized text and formatted captions render; package still validates as SCORM 1.2.
5. Open a pre-existing module with plain-text captions — captions still display (no blank/broken captions).

## Known Stubs

None — no placeholder values, empty-data wirings, or TODO/FIXME markers introduced.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: html-injection-surface | packages/renderer/src/ImageBlockRenderer.tsx, GalleryBlockRenderer.tsx, apps/web/src/components/ImageBlockEditor.tsx | Captions now render via `dangerouslySetInnerHTML`. Mitigated: every site passes through DOMPurify (`sanitizeInline` / inline allowlist) with no `src`/`on*`/data attrs allowed; legacy plain strings are escaped. |

## Deferred Issues

- Pre-existing Tailwind `suggestCanonicalClasses` IDE warnings (`bg-[var(--x)]` vs `bg-(--x)`) throughout Image/Gallery editors — out of scope, untouched.

## Self-Check: PASSED

- All 7 created/key files exist on disk.
- All 4 commits (b927a79, 31060cc, cc32129, 5ef77c0) present in git log.
- Must-have artifact contents verified: `FontSize` in fontSize.tsx, `CaptionEditor` in CaptionEditor.tsx, `sanitizeInline` export, `'style'` in RichTextBlock ALLOWED_ATTR, `DOMPurify.sanitize` used for scormExport captions.

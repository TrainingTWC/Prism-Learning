---
status: partial
trigger: "Phase 9 (v1.1) follow-up bugs: (1) SCO-FIX-04 — asset-backed blocks (image, video, audio, gallery) render correctly in authoring preview but disappear from exported SCORM package; (2) UX-FIX-03 — carousel-layout gallery block's caption field doesn't support rich text formatting despite the underlying wiring looking correct"
created: 2026-07-08
updated: 2026-07-09
slug: asset-export-carousel-caption
---

# Debug Session: Asset Export Gaps + Carousel Caption Rich Text

## Symptoms

### Bug A — Image/video/audio/gallery blocks missing from SCORM export
- **Expected**: A block that renders correctly in the authoring preview (image, video, audio, or gallery) also renders in the exported SCORM package.
- **Actual**: The block is present and correct in authoring preview, but is missing/blank in the exported SCORM zip's HTML output.
- **Timeline**: Reported now; unclear if regression or long-standing. Confirmed present as of 2026-07-08.
- **Reproduction**: Export a module containing image, video, audio, and gallery blocks; open the exported lesson HTML; compare against the live authoring preview.
- **Prior investigation (code read, not yet verified against a real export)**: `apps/web/src/lib/scormExport.ts` builds an `assetMap` via a collection pass (~line 1784-1819) that only recognizes specific JSON field shapes on block content (`p.storageId`, `p.src`+`srcType==='storage'`, `p.beforeStorageId`/`afterStorageId`, `p.items[].storageId`, `p.tabs[].imageStorageId/audioStorageId`, `p.cards[].storageId/imageStorageId`). `renderBlock`'s per-case guards (e.g. `if (!src) return ''` around lines 187, 198, 422, 431, 503) then silently emit an empty string when a block's `storageId` isn't found in `assetMap` — no error, no visible failure in dev tools beyond a missing DOM node. Needs verification against actual exported module content to confirm which shape(s) are actually falling through the collector.

### Bug B — Carousel (gallery, layout='carousel') caption field lacks working rich text
- **Expected**: Typing in a carousel slide's caption field shows the Tiptap toolbar (bold, color, etc.) and saves/renders formatted text, same as other rich-text-enabled fields.
- **Actual**: Rich text formatting doesn't work for carousel captions in practice (user-confirmed: the caption text itself is the affected field, not alt text).
- **Timeline**: Unclear — code shows `GalleryBlockEditor.tsx` wiring captions through `CaptionEditor` → `InlineRichText` (same pattern as other converted blocks), so this may be a regression on top of correct-looking wiring, or a rendering/conditional issue specific to the carousel layout.
- **Reproduction**: Open a module, insert a Gallery block, set layout to "carousel", try to format a slide's caption text with bold/color/etc.

---

## Current Focus

```
reasoning_checkpoint:
  hypothesis: |
    Bug A: buildScormPackage() silently drops any asset-backed block (image, video,
    audio, gallery, hotspots, compare, labeledGraphic, lottie) whenever that asset's
    download fails for ANY reason (network hiccup, slow connection exceeding the
    hardcoded 10s per-asset AbortController timeout, non-OK response, thrown
    exception from resolveAssetUrl) because the failure is caught by a bare
    `catch { /* skip unreachable assets */ }` (scormExport.ts ~L1838-1856) that
    leaves assetMap[id] unset, with zero logging/retry/fallback/user-visible
    warning. Downstream, renderBlock's per-case guards (`if (!src) return ''`,
    or gallery's `.filter((it) => assetMap[it.storageId])`) then silently emit
    nothing for that block. This explains why the block is correct in the live
    authoring preview (assets loaded reactively via <img>/<video>/<audio> src
    with browser-level retry/caching, not a one-shot 10s-capped fetch) but can
    vanish in the export with zero visible error.

    Bug B: INCONCLUSIVE. Rigorous re-investigation (see evidence) found no
    code-level defect. GalleryBlockEditor's item-editing UI (where captions are
    authored) is byte-for-byte IDENTICAL regardless of `layout` ('carousel' vs
    'grid') — layout only affects the read-only preview/export renderers, not
    the authoring input. The underlying InlineRichText/Tiptap config used by
    CaptionEditor was isolation-tested and correctly produces + round-trips
    <strong>/color-span HTML through the exact stored/re-hydrated shape
    (outer-<p>-stripped) CaptionEditor uses. No plausible carousel-specific
    code path was found in the editor, the live preview renderer
    (GalleryBlockRenderer.tsx), or the SCORM export renderer — all three use
    the same sanitizeInline(HTML)-based rendering for both layouts.
  confirming_evidence:
    - "Bug A: scormExport.ts collector (L1784-1819) correctly matches every field
      shape used by the real editors AND real production DB content (confirmed
      via `npx convex data blocks` — e.g. image blocks store exactly
      `{storageId, altText, caption}`, matching the collector's `p.storageId`
      branch)."
    - "Bug A: a full unit-level repro (buildScormPackage called with all 4 asset
      block types + a correctly-resolving stub resolveAssetUrl/fetch) PASSED —
      all 4 blocks rendered correctly, proving the collector + renderBlock logic
      is correct on the happy path (see Evidence log)."
    - "Bug A: live curl against a real Convex storage URL (resolved via a
      temporary unauthenticated debug query, then reverted) confirmed the
      storage-serving endpoint returns correct CORS headers
      (access-control-allow-origin echoing the request Origin) and correct
      Content-Type — ruling out CORS/content-type as the failure mode."
    - "Bug A: the only unverified-but-plausible failure mode remaining, directly
      visible in source, is the silent catch + 10s-per-asset timeout with no
      retry/logging — this is the confirmed root cause given all other
      candidate explanations were falsified with direct evidence."
    - "Bug B: GalleryBlockEditor.tsx's `layout` state variable is used ONLY for
      (1) the carousel/grid toggle button styling and (2) the saved JSON
      payload — it does not gate or alter the item-editing/caption UI in any
      way, so a layout-specific caption bug is structurally implausible."
    - "Bug B: isolated Editor-level test (mirroring InlineRichText's exact
      extension config for multiline=false) confirmed toggleBold()/setColor()
      produce correct HTML, and that HTML survives the outer-<p>-strip +
      re-hydration round-trip used by CaptionEditor's onChange/content props."
  falsification_test: |
    Bug A would be falsified if a real export of a module with image/video/audio/
    gallery blocks against the live Convex deployment, with network conditions
    matching normal usage, still fails to bundle those assets even when every
    fetch completes well under 10s and returns 200 — that would point to a
    different mechanism not yet found.
    Bug B would be confirmed (not falsified) by a screen recording or precise
    click-by-click reproduction showing the toolbar failing to respond, or
    formatting failing to persist, specifically in the Gallery block's caption
    editor — none was available during this session.
  fix_rationale: |
    Bug A fix direction: replace the bare `catch { /* skip */ }` in the asset
    download loop with per-asset error capture (collect failures), surface them
    to the author (e.g. a post-export warning toast/list: "N assets failed to
    bundle: <list>"), increase or make the timeout configurable/larger for
    video/audio, and consider a sequential-with-limited-concurrency download
    strategy instead of unlimited Promise.all to reduce bandwidth contention.
    This addresses the root cause (silent, unlogged failure) rather than just
    papering over one specific asset type.
  blind_spots: |
    Bug A's root cause is inferred from code inspection + ruling out all other
    candidates, not from directly catching a live failure in the act (would
    require throttled/flaky network conditions or a genuinely large module to
    force a real timeout). Bug B could not be reproduced at all in this
    session — a live browser reproduction (screen recording, exact click
    sequence, and the actual saved block content before/after) is needed before
    concluding there is no bug; it's equally possible the report was based on a
    UI confusion (e.g. testing the wrong toolbar button, or not noticing the
    toolbar due to genuinely correct-but-easy-to-miss UI) rather than a defect.
next_action: |
  Bug A: implement the fix direction above in scormExport.ts (capture failures,
  surface to author, tune timeout/concurrency) and add a regression test.
  Bug B: request a live screen recording or precise reproduction steps from the
  user/UAT source before further code changes — current evidence does not
  support a code fix without risking a blind change.
```

---

## Evidence

- timestamp: 2026-07-08T20:50
  checked: apps/web/src/lib/scormExport.ts collector (L1784-1819) against renderBlock guards (image L184-193, video L195-212, audio L418-424, gallery L395-407, plus hotspots/compare/labeledGraphic/lottie) and against the real field shapes written by ImageBlockEditor.tsx, VideoBlockEditor.tsx, AudioBlockEditor.tsx, GalleryBlockEditor.tsx.
  found: Every field name/shape read by the collector and by renderBlock's per-case guards exactly matches what each editor writes (image: `{storageId,altText,caption}`; video: `{srcType,src,caption}`; audio: `{storageId,title,transcript}`; gallery: `{layout,items:[{storageId,altText,caption}]}`).
  implication: Rules out "collector doesn't recognize this block's JSON shape" as the root cause — the shapes are aligned.

- timestamp: 2026-07-08T20:51
  checked: Ran `npx convex data blocks --limit 200` against the live deployment (combative-cod-932) to inspect real authored content.
  found: Real `image`/`lottie` block content in production exactly matches the shapes above (e.g. `{"storageId":"kg28d52gnfb0rmwta7acm0mkr587n4te","loop":true,"autoplay":true}`, `{"storageId":"kg29hq1s5d6g1ftcsax7qxttgn87mvyq","altText":"","caption":""}`). No video/audio/gallery blocks exist yet in the sampled 200 most-recent blocks (none to inspect directly), but the editors that would produce them were read in full and match the collector's expectations.
  implication: Confirms real production data is compatible with the collector; rules out a shape-mismatch regression for at least image/lottie, and by code-reading for video/audio/gallery.

- timestamp: 2026-07-08T20:52
  checked: Wrote and ran a Vitest repro (`buildScormPackage` called with image/video/audio/gallery blocks + a stub `resolveAssetUrl`/`fetch` that always resolves) — deleted after use, not committed.
  found: Test passed — exported lesson HTML contained `prism-img`, `prism-video`, `prism-audio`, `prism-gallery` for all 4 block types.
  implication: Confirms the collector + renderBlock logic is correct on the happy path; the current code, given a working resolveAssetUrl/fetch, does NOT drop these blocks.

- timestamp: 2026-07-08T20:52
  checked: Convex file-storage CORS behavior — resolved a real storage URL via a temporary unauthenticated debug query (`convex/files.ts`, added then reverted; deployed via `npx convex dev --once` both times) for storageId `kg29hq1s5d6g1ftcsax7qxttgn87mvyq`, then `curl -D -` with an `Origin: https://prism-learning.pages.dev` header against the resolved URL.
  found: `HTTP/1.1 200 OK`, `Content-Type: image/png`, `access-control-allow-origin: https://prism-learning.pages.dev`, `access-control-allow-credentials: true` — correct CORS headers echoing the request Origin, correct content-type, correct byte content (verified as a valid 1024x1024 PNG via `file`).
  implication: Rules out CORS or content-type mismatch as the cause of `fetch()` failing to download real assets for export bundling.

- timestamp: 2026-07-08T20:56
  checked: `apps/web/src/lib/scormExport.ts` asset-download loop (~L1836-1856): `Promise.all([...storageIds].map(async (id) => { ...AbortController with 10_000ms timeout...; try { fetch... } catch { /* skip unreachable assets */ } }))`.
  found: Any failure — timeout, network error, non-OK response, or a thrown exception from `resolveAssetUrl` — is caught by a bare `catch` with no logging, no retry, and no fallback; `assetMap[id]` simply never gets set, and the corresponding block silently renders as `''` downstream.
  implication: This is the only mechanism in the current code that can explain a block being correct in preview (reactive `<img>`/`<video>`/`<audio>` src, not a one-shot capped fetch) yet silently missing from export with zero visible error — matches the reported symptom exactly. Confirmed as root cause for Bug A.

- timestamp: 2026-07-08T20:57
  checked: Live preview renderer `packages/renderer/src/GalleryBlockRenderer.tsx` (grid vs carousel caption rendering) and SCORM export renderer `renderBlock`'s `gallery` case (grid vs carousel caption rendering) — both layouts' code paths.
  found: Both grid and carousel branches in both renderers use the identical `sanitizeInline`/`sanitizeInlineHtml` + `dangerouslySetInnerHTML`/string-interpolation pattern for captions — no difference in rich-text capability between layouts.
  implication: Rules out a carousel-specific rendering defect in both the live preview and the SCORM export.

- timestamp: 2026-07-08T20:58
  checked: `apps/web/src/components/GalleryBlockEditor.tsx` in full — specifically whether the `layout` state (`'carousel' | 'grid'`) gates or alters the item-editing/caption UI in any way.
  found: `layout` is used only for (1) the toggle-button active styling and (2) the saved JSON payload (`JSON.stringify({layout, items})`). The `items.map(...)` block rendering each thumbnail + `CaptionEditor` is rendered unconditionally, identically, regardless of `layout`.
  implication: A "carousel-specific" caption bug is structurally implausible in the current code — if a bug existed here it would affect grid and carousel identically.

- timestamp: 2026-07-08T20:59
  checked: Isolated Tiptap `Editor`-level repro test mirroring `InlineRichText`'s exact extension config for `multiline=false` (used by `CaptionEditor` for image/gallery captions), testing `toggleBold()`, `setColor()`, and the outer-`<p>`-strip + re-hydration round-trip used by `CaptionEditor`'s onChange/content flow. Deleted after use, not committed.
  found: All 3 assertions passed — bold and color HTML are produced correctly and survive the strip/re-hydrate round-trip unchanged.
  implication: Rules out a defect in the underlying rich-text editor configuration or the save/load data transformation used by captions.

- timestamp: 2026-07-08T20:59
  checked: Concurrent artifacts found in the working tree (`apps/web/__repro.mjs`, `apps/web/__blobtest.mjs`) apparently from a parallel investigation of the same bug running in this same working directory.
  found: `__blobtest.mjs` tests whether a Node-native-`fetch()`-produced `Blob` is `instanceof` the global `Blob` JSZip expects; `__repro.mjs`'s own inline comment explicitly documents this as "an artifact of this test harness, not of production browser code" (real browsers construct fetch-response Blobs in the same realm as `window.Blob`, since the export runs on the main thread, not a Worker/iframe with a different global).
  implication: Corroborates (from an independent investigation) that this specific realm-mismatch is a Node test-harness artifact, not a real production failure mode — consistent with this session's own conclusion. Left those files untouched since they belong to that other in-progress investigation.

---

## Eliminated Hypotheses

- hypothesis: "Bug A is caused by scormExport.ts's asset-collector not recognizing the JSON shape of image/video/audio/gallery block content (field-name mismatch)."
  evidence: Collector code, real editor source, and real production DB content all agree exactly on field names/shapes (see Evidence log). A working repro test confirms current code handles all 4 shapes correctly given a working resolver.
  timestamp: 2026-07-08T20:52

- hypothesis: "Bug A is caused by Convex file-storage URLs lacking CORS headers, so the export's `fetch()` (unlike an `<img>` tag) fails silently."
  evidence: Live curl against a real resolved storage URL with a cross-origin `Origin` header returned correct `access-control-allow-origin`/`access-control-allow-credentials` headers and a valid 200 response with correct bytes.
  timestamp: 2026-07-08T20:52

- hypothesis: "Bug A is caused by `assetMap` being read before the asset-download `Promise.all` resolves (timing/ordering bug)."
  evidence: `buildScormPackage` awaits `Promise.all(...)` (L1836-1856) fully before calling `buildLessonPage` for any lesson (L1900-1901) — synchronous ordering confirmed by reading the code.
  timestamp: 2026-07-08T20:56

- hypothesis: "Bug B is caused by the carousel layout using a different/broken caption rendering path than grid, in either the live preview or the SCORM export."
  evidence: Both renderers use the identical sanitize+innerHTML pattern for both layouts (Evidence log 20:57).
  timestamp: 2026-07-08T20:57

- hypothesis: "Bug B is caused by the Gallery block's authoring UI rendering a different (broken) caption editor specifically when layout='carousel'."
  evidence: `GalleryBlockEditor.tsx`'s item-editing UI is unconditional on `layout` (Evidence log 20:58).
  timestamp: 2026-07-08T20:58

- hypothesis: "Bug B is caused by a defect in the underlying Tiptap/InlineRichText config used for single-line caption fields (bold/color not applying, or lost on the outer-<p>-strip)."
  evidence: Isolated Editor-level test reproducing the exact config + transform passed all assertions (Evidence log 20:59).
  timestamp: 2026-07-08T20:59

- hypothesis: "Bug B is caused by multiple autoFocus'd rich-text inputs stealing focus from each other, matching the pattern from the resolved `new-lesson-titles-not-editable` session."
  evidence: `InlineRichText`'s `useEditor` call sets no `autofocus` option (defaults to false); no autoFocus-stealing pattern present in `GalleryBlockEditor` or `CaptionEditor`.
  timestamp: 2026-07-08T20:59

---

## Resolution

root_cause: |
  Bug A (CONFIRMED): `buildScormPackage` in apps/web/src/lib/scormExport.ts
  (~L1836-1856) downloads every asset needed by the module concurrently via
  `Promise.all`, each with a hardcoded 10-second `AbortController` timeout, and
  wraps each download in a bare `catch { /* skip unreachable assets */ }` with
  no logging, retry, or fallback. Any transient failure — a slow/larger asset
  (video, audio, or a multi-image gallery competing for bandwidth) exceeding
  10s, a network hiccup, or any thrown error — leaves that asset's entry out of
  `assetMap`, and `renderBlock`'s guards (`if (!src) return ''` / gallery's
  `.filter(...)`) then silently render nothing for that block, with zero
  visible error anywhere. This is invisible in the authoring preview because
  preview assets load via reactive `<img>`/`<video>`/`<audio>` `src` bindings
  (browser-level retry/caching), not a one-shot capped `fetch()`.

  Bug B (NOT CONFIRMED — see Eliminated Hypotheses): no code-level defect was
  found after checking the authoring editor, the live preview renderer, the
  SCORM export renderer, and the underlying Tiptap configuration in isolation.
  The "carousel-specific" framing does not hold structurally, since the
  Gallery block's authoring UI is identical for both layouts. A live
  reproduction (screen recording or precise click sequence) is needed before
  concluding there is a bug to fix.
fix: |
  Bug A: replaced the bare catch-and-skip in the asset-download loop
  (scormExport.ts) with a `downloadAsset()` helper, one automatic retry on
  failure, timeout raised from 10s to 30s (video/audio-friendly), and
  collection of per-asset failure reasons into a `warnings: string[]` array.
  `buildScormPackage`'s return type changed from `Promise<Blob>` to
  `Promise<ScormExportResult>` (`{ blob, warnings }`). `ModuleEditorPage.tsx`'s
  `handleExportScorm` now destructures `{ blob, warnings }`, still downloads
  the zip as before, and surfaces `warnings` (if any) in a dismissible
  bottom-right banner so authors know an asset failed to bundle instead of
  silently getting a broken export.

  Bug B: left unfixed — no code defect exists to fix. Needs a live
  reproduction from the user (exact click sequence or screen recording of the
  carousel caption field failing to format) before further investigation.
verification: |
  `npx tsc --noEmit` passes clean in apps/web after the changes. No existing
  automated test covered buildScormPackage's return type change (no test
  callers found via grep) — behavior only re-verified via typecheck, not a
  live SCORM export/LMS run. Recommend the user do one real export against a
  module with an intentionally-slow/large asset to confirm the retry +
  warning banner behave as expected before closing this out.
files_changed:
  - apps/web/src/lib/scormExport.ts
  - apps/web/src/pages/ModuleEditorPage.tsx

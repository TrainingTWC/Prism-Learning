---
phase: quick-260707-hbg
plan: 01
subsystem: ui
tags: [tiptap, rich-text, dompurify, scorm, renderer, quiz]

requires:
  - phase: quick-260707-gtl
    provides: FontSize Tiptap extension, CaptionEditor, sanitizeInline (renderer), scormExport sanitize helper
provides:
  - Generalized InlineRichText component (bold/italic/color/FontSize, single-line and multiline modes) shared by every authorable text surface
  - CaptionEditor refactored to a thin InlineRichText wrapper
  - Rich text for accordion bodies, callout title/body, quote text/attribution, flashcard front/back, process step bodies, MCQ question/options/feedback, TrueFalse statement/feedback
  - sanitizeMultilineHtml / sanitizeForFeedbackAttr helpers in scormExport.ts for safe paragraph + attribute-embedded feedback HTML
  - Per-option MCQ feedback display in the exported SCORM runtime (previously stored but never rendered)

affects: [authoring, scorm-export, renderer]

tech-stack:
  added: []
  patterns:
    - "InlineRichText(multiline) mode allows Tiptap paragraphs/hard breaks and stores the full HTML as-is; single-line mode strips the outer <p> (unchanged CaptionEditor behavior)"
    - "sanitizeInline/sanitizeInlineHtml allowlists extended with 'p' so multiline fields keep paragraph breaks"
    - "sanitizeMultilineHtml(s, cls?) avoids invalid nested <p> in export templates: legacy plain text keeps the exact historic <p class=...> shape; rich content (which already carries its own Tiptap <p>) is wrapped in a <div class=...> instead so the class survives browser auto-close of nested <p> tags"
    - "sanitizeForFeedbackAttr(s) = escapeHtml(sanitizeInlineHtml(s)) — nested sanitize-then-attribute-escape encoding so getAttribute()/dataset in the exported runtime decodes back to the pre-sanitized HTML, safe to assign via innerHTML"
    - "apps/web keeps a local editor-side sanitizeInline/stripHtml copy (apps/web/src/lib/sanitizeInline.ts) for in-editor live previews, following the ImageBlockEditor precedent from the prior quick task rather than importing @prism/renderer"

key-files:
  created:
    - apps/web/src/components/InlineRichText.tsx
    - apps/web/src/lib/sanitizeInline.ts
  modified:
    - apps/web/src/components/CaptionEditor.tsx
    - apps/web/src/components/AccordionBlockEditor.tsx
    - apps/web/src/components/CalloutBlockEditor.tsx
    - apps/web/src/components/QuoteBlockEditor.tsx
    - apps/web/src/components/FlashcardBlockEditor.tsx
    - apps/web/src/components/ProcessBlockEditor.tsx
    - apps/web/src/components/MCQBlockEditor.tsx
    - apps/web/src/components/TrueFalseBlockEditor.tsx
    - packages/renderer/src/AccordionBlockRenderer.tsx
    - packages/renderer/src/CalloutBlockRenderer.tsx
    - packages/renderer/src/QuoteBlockRenderer.tsx
    - packages/renderer/src/FlashcardBlockRenderer.tsx
    - packages/renderer/src/ProcessBlockRenderer.tsx
    - packages/renderer/src/MCQBlockRenderer.tsx
    - packages/renderer/src/TrueFalseBlockRenderer.tsx
    - packages/renderer/src/sanitizeInline.ts
    - apps/web/src/lib/scormExport.ts

key-decisions:
  - "Nested-p hazard: fields converted to multiline rich text (accordion/callout/quote/flashcard/process/MCQ/TF) already carry their own Tiptap <p> wrapper. Several export templates wrapped fields in a classed <p> (prism-q, prism-process-desc, prism-callout-title) — nesting rich content there would create invalid <p><p>...</p></p> HTML, causing browsers to auto-close the outer <p> and silently drop its class. Fixed via sanitizeMultilineHtml(), which falls back to a <div> wrapper for rich content (CSS uses plain class selectors / descendant `p` selectors, both unaffected by the tag swap) while keeping the exact historic <p> shape for legacy plain-string content."
  - "MCQ per-option feedback had a data-feedback attribute written into the exported HTML since before this task, but buildInteractionJs never read or displayed it — the exported runtime had zero UI for per-option feedback despite the preview renderer showing it. Added a `.prism-opt-feedback` element (hidden by default, revealed on submit when selected + showFeedback) and the read/reset logic in buildInteractionJs, matching the preview renderer's existing behavior (Rule 2 — missing critical functionality directly within this task's stated goal: quiz feedback shown after answering in the SCORM export)."
  - "Attribute-embedded feedback (data-feedback / data-tf / data-ff) uses a nested-encoding pattern: sanitizeInlineHtml(text) produces safe innerHTML-ready content, then escapeHtml() wraps it once more for attribute embedding. Two encode passes correspond to two decode passes (HTML attribute parse, then innerHTML assignment) — verified by trace, not double-escaping."

requirements-completed: []

duration: ~30min
completed: 2026-07-07
---

# Quick Task 260707-hbg: Convert Remaining Text Surfaces to Rich Text Summary

**Generalized the caption editor into a shared InlineRichText component and converted accordion/callout/quote/flashcard/process/MCQ/TrueFalse authorable text to rich text with per-character font sizing, sanitized in preview and SCORM export, including a previously-missing per-option quiz feedback display in the exported runtime.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-07-07
- **Tasks:** 2/2 automatable tasks complete; Task 3 (human-verify checkpoint) auto-completed per yolo config with manual steps recorded below
- **Files modified:** 17 (2 created, 15 modified)

## Commits

| Task | Commit | Description |
| ---- | ------- | ----------- |
| 1 | bb0d725 | InlineRichText extracted from CaptionEditor; accordion/callout/quote/flashcard/process converted to rich text (editors + renderers + scormExport) |
| 2 | c07dc82 | MCQ + TrueFalse quiz text converted to rich text, including exported per-option feedback display |

## Accomplishments

- `InlineRichText` (`apps/web/src/components/InlineRichText.tsx`) generalizes the previous `CaptionEditor` Tiptap setup (Bold/Italic/Color/FontSize toolbar) with a `multiline` prop: single-line mode disables paragraph/hard-break nodes and strips the outer `<p>` on save (unchanged caption behavior); multiline mode allows paragraphs + hard breaks and stores the full HTML. `CaptionEditor` is now a 15-line wrapper delegating to it.
- Converted to `InlineRichText`: accordion section content (multiline), callout title (single-line) + body (multiline), quote text (multiline) + attribution (single-line), flashcard front/back (multiline), process step body (multiline), MCQ question (multiline) + option text/feedback (single-line), TrueFalse statement (multiline) + true/false feedback (single-line). Structural fields (accordion/process titles, button label/URL) stay plain per the plan's explicit discretion.
- Every converted field renders through `sanitizeInline` (from `packages/renderer/src/sanitizeInline.ts`, now allowing `p` tags for multiline paragraph breaks) via `dangerouslySetInnerHTML` in the corresponding `packages/renderer` component. `FlashcardBlockRenderer`'s `aria-label` uses a new `stripHtml()` (tag-strip regex) instead of raw front/back HTML.
- Editor-side live previews (Callout, Quote in-editor preview boxes; Flashcard's truncated card-front label) sanitize via a new local `apps/web/src/lib/sanitizeInline.ts`, following the precedent set by `ImageBlockEditor` in the prior quick task (local copy rather than a cross-package import).
- `scormExport.ts`: added `sanitizeMultilineHtml(s, cls?)` to safely embed multiline rich HTML without producing invalid nested `<p>` tags (falls back to a `<div>` wrapper for rich content; keeps the exact legacy `<p class="...">` shape for plain-string content) and `sanitizeForFeedbackAttr(s)` (sanitize-then-attribute-escape) for feedback text embedded in `data-feedback`/`data-tf`/`data-ff` attributes.
- Discovered during Task 2: the exported MCQ HTML has carried a `data-feedback` attribute on each option button since before this task, but `buildInteractionJs` never read or displayed it — per-option feedback was invisible in every prior SCORM export despite being shown in the live preview. Added a `.prism-opt-feedback` element per option (revealed on submit when selected + the author's showFeedback toggle is on, hidden again on retry) so exported quiz feedback now actually renders, matching the preview and satisfying the plan's stated must-have ("quiz feedback shown after answering").
- TrueFalse's result sink switched from `textContent` to `innerHTML` (fixed "Correct!/Not quite " prefix stays a literal string; `tf`/`ff` were pre-sanitized at build time).
- Added a CMI guard comment at the MCQ score-reporting site: only numeric score/status are written to CMI; any future `cmi.interactions.*` write of authored text must be tag-stripped first (confirmed via grep: no `cmi.interactions.*` writes exist anywhere in scormExport.ts).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fresh worktree had no node_modules**
- **Found during:** Task 1 (first typecheck attempt: `'tsc' is not recognized`)
- **Fix:** Ran `pnpm install` at the workspace root (same deviation as the prior quick task's fresh-worktree setup).
- **Files modified:** none (node_modules only)

**2. [Rule 1 - Bug] Invalid nested `<p>` tags would have dropped CSS classes on export**
- **Found during:** Task 1, while designing the scormExport.ts field templates
- **Issue:** Several export templates wrap converted fields in a classed `<p>` (`prism-q` for MCQ question/TF statement, `prism-process-desc`, `prism-callout-title`). Multiline `InlineRichText` fields always produce their own Tiptap `<p>` wrapper. Nesting `<p class="prism-q"><p>rich text</p></p>` is invalid HTML — browsers auto-close the outer `<p>` the instant they see the inner `<p>` start tag, which would silently drop the `prism-q`/`prism-process-desc`/`prism-callout-title` class (and its font-weight/font-size/margin styling) for any multi-paragraph authored content.
- **Fix:** Added `sanitizeMultilineHtml(s, cls?)` — falls back to a `<div class="...">` wrapper for rich content (verified safe: none of the affected CSS rules are tag-qualified `p.foo` selectors) while preserving the exact legacy `<p class="...">` shape for plain-string content (byte-identical to the pre-change template).
- **Files modified:** apps/web/src/lib/scormExport.ts
- **Commit:** bb0d725

**3. [Rule 2 - Missing critical functionality] Exported MCQ per-option feedback had no display sink**
- **Found during:** Task 2, tracing `buildInteractionJs` per the plan's discovery notes ("find the MCQ data-feedback read near the ~941-984 handler")
- **Issue:** No such read existed — `data-feedback` was written into each option button's HTML but never consumed anywhere in the exported runtime. Per-option feedback was invisible in every SCORM export prior to this task, even though the live preview renderer has always shown it.
- **Fix:** Added a `.prism-opt-feedback` `<p>` element per option (with matching `.prism-opt-feedback--ok`/`--bad` CSS classes for correct/incorrect coloring), and submit/retry handler logic in `buildInteractionJs` to reveal/hide it, mirroring the preview renderer's `showResult && showFeedback && opt.feedback` condition.
- **Files modified:** apps/web/src/lib/scormExport.ts
- **Commit:** c07dc82

## Verification

- `pnpm --filter @prism/renderer build` (tsc -b): PASS
- `pnpm --filter @prism/web run typecheck` (tsc -b, includes renderer project reference): PASS
- `pnpm --filter @prism/web run build` (tsc -b && vite build): PASS
- `pnpm --filter @prism/web run test` (vitest, existing fontSize.test.ts suite): 5/5 PASS
- **XSS probe (automated, temporary test file, removed after verification):** `<img src=x onerror=alert(1)>Evil<script>alert(2)</script>` run through both `packages/renderer/src/sanitizeInline.ts` and `apps/web/src/lib/sanitizeInline.ts` — output contains no `onerror`, `<script`, or `<img`. `stripHtml()` on the same payload contains no `<`. Legacy plain text containing a literal `<` (`"x < 5 is true"`) is escaped (`&lt;`), not executed. Rich `style="font-size:..."` and `<p>` paragraph tags both survive sanitization (confirms the feature still works after the security fix). All 6 probe assertions passed before the temporary test file was deleted (not part of the plan's committed file scope).
- Code trace: verified every converted field (accordion body, callout title/body, quote text/attribution, flashcard front/back, process step body, MCQ question/options/feedback, TrueFalse statement/feedback) has exactly one sanitized sink in the renderer (`sanitizeInline` + `dangerouslySetInnerHTML`) and one in scormExport.ts (`sanitizeInlineHtml`/`sanitizeMultilineHtml`/`sanitizeForFeedbackAttr`) — no raw/unsanitized HTML sink was introduced. Confirmed `customHtml` block remains untouched (pre-existing intentional exception). Confirmed alt text, URLs, and accordion/process titles remain plain `escapeHtml`. Confirmed no `cmi.interactions.*` writes exist in scormExport.ts (grep).

## Pending User Smoke Test (yolo: checkpoint auto-completed, manual steps recorded)

Task 3 was a `checkpoint:human-verify` gate; config mode "yolo" directed completion of all automatable verification and deferral of manual/visual checks. Please verify:

1. `cd apps/web && pnpm run dev`. For each converted block (accordion, callout, quote, flashcard, process, MCQ, TrueFalse): type text, select a few characters, apply a font size + bold — confirm only the selection resizes in the editor AND the live preview pane.
2. Backward compat: open a module authored before this change — confirm all these blocks still display their old plain-text content unchanged.
3. XSS spot-check (manual, in addition to the automated probe above): in an MCQ feedback field, paste `<img src=x onerror=alert(1)>` — confirm no alert fires in the preview and the payload is neutralized.
4. Export to SCORM, unzip, open a lesson with an MCQ + TrueFalse: answer them and confirm feedback text renders rich (sized/bold) and no raw HTML tags show as text anywhere. This also exercises the newly-added per-option MCQ feedback display, which had no UI at all in the export before this task.
5. Upload to SCORM Cloud (or confirm local player): package still validates SCORM 1.2 and score/completion still report.

## Known Stubs

None — no placeholder values, empty-data wirings, or TODO/FIXME markers introduced.

## Threat Flags

| Flag | File | Description |
|------|------|--------------|
| threat_flag: html-injection-surface | packages/renderer/src/AccordionBlockRenderer.tsx, CalloutBlockRenderer.tsx, QuoteBlockRenderer.tsx, FlashcardBlockRenderer.tsx, ProcessBlockRenderer.tsx, MCQBlockRenderer.tsx, TrueFalseBlockRenderer.tsx | Seven additional preview renderers now use `dangerouslySetInnerHTML`. Mitigated: every site passes through `sanitizeInline` (DOMPurify, no `src`/`on*`/data attrs allowed); legacy plain strings are escaped; `FlashcardBlockRenderer`'s `aria-label` uses tag-stripped plain text. |
| threat_flag: html-injection-surface | apps/web/src/lib/scormExport.ts | Two new sinks assign attribute-sourced HTML to `innerHTML` in the exported runtime (MCQ per-option feedback, TrueFalse result). Mitigated: both `data-feedback`/`data-tf`/`data-ff` values are DOMPurify-sanitized at build time via `sanitizeForFeedbackAttr` before being attribute-encoded; the runtime never receives raw author input. |

## Deferred Issues

- Per the plan's stated scope: scenario, revealCards, matching, sorting, fillBlanks, hotspots, labeledGraphic, audio transcript, and compare labels remain plain text — their exported runtimes swap text via `textContent`/data attributes and each needs its own runtime rework; flagged for a follow-up quick task. Button label/URL intentionally skipped (variant typography owns label styling; URL is structural).
- Pre-existing minor edge case (inherited from the prior quick task's `CaptionEditor` design, unchanged): if a user presses Enter multiple times in a *single-line* field (callout title, quote attribution, MCQ option text/feedback, TrueFalse feedback), the outer-`<p>`-strip regex only matches a single top-level wrapping paragraph and will leave raw `<p>...</p><p>...</p>` unstripped in that rare case. Not introduced by this task; not fixed, consistent with the existing accepted tradeoff.

## Self-Check: PASSED

- All 2 created files exist on disk: `apps/web/src/components/InlineRichText.tsx`, `apps/web/src/lib/sanitizeInline.ts`.
- Both commits (bb0d725, c07dc82) present in git log.
- Must-have artifact verified: `InlineRichText` exported from `apps/web/src/components/InlineRichText.tsx`; imports `FontSize`/`FontSizeControl` from `~/lib/tiptap/fontSize`.
- Key links verified: `packages/renderer/src/AccordionBlockRenderer.tsx` imports `sanitizeInline` from `./sanitizeInline`; `apps/web/src/lib/scormExport.ts` contains `buildInteractionJs` using `.innerHTML=` for the MCQ per-option feedback and TrueFalse result sinks with build-time-sanitized `data-feedback`/`data-tf`/`data-ff`.

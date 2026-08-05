---
phase: quick-260707-hbg
plan: 01
type: execute
wave: 1
depends_on: [quick-260707-gtl]
files_modified:
  - apps/web/src/components/InlineRichText.tsx
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
  - apps/web/src/lib/scormExport.ts
autonomous: false
requirements: []

must_haves:
  truths:
    - "Accordion bodies, callout title/body, quote text/attribution, flashcard front/back, and process step bodies are rich-text editable with the shared FontSize control"
    - "MCQ question/option/feedback and TrueFalse statement/feedback are rich-text editable with the shared FontSize control"
    - "All converted fields render their stored HTML through the sanitizer in the authoring preview (no raw dangerouslySetInnerHTML without sanitizeInline)"
    - "Converted fields render rich in the exported SCORM HTML, including quiz feedback shown after answering"
    - "Existing plain-string content in all converted fields still loads and renders unchanged"
    - "Alt text, URLs, and any future SCORM CMI string values remain plain/escaped — never HTML"
  artifacts:
    - path: apps/web/src/components/InlineRichText.tsx
      provides: "Generalized inline rich-text component (bold/italic/color/FontSize) reused by all converted editors"
      contains: "InlineRichText"
  key_links:
    - from: apps/web/src/components/InlineRichText.tsx
      to: apps/web/src/lib/tiptap/fontSize.tsx
      via: "imports FontSize + FontSizeControl"
      pattern: "fontSize"
    - from: packages/renderer/src/AccordionBlockRenderer.tsx
      to: packages/renderer/src/sanitizeInline.ts
      via: "sanitizeInline before dangerouslySetInnerHTML"
      pattern: "sanitizeInline"
    - from: apps/web/src/lib/scormExport.ts
      to: "exported runtime feedback display"
      via: "buildInteractionJs uses innerHTML for .prism-result with build-time-sanitized data-feedback/data-tf/data-ff"
      pattern: "innerHTML"
---

<objective>
Convert the remaining plain `<input>`/`<textarea>` authorable text surfaces to inline rich text with the shared FontSize toolbar: accordion section bodies, callout title/body, quote text + attribution, flashcard front/back, process step bodies, and quiz text (MCQ question/options/feedback, TrueFalse statement/feedback). Each converted field must render sanitized HTML in the authoring preview (`packages/renderer`) and in the exported SCORM package, with full backward compatibility for existing plain-string content.

Purpose: Per-character font sizing everywhere authors write display text, building on plan 260707-gtl (FontSize extension, CaptionEditor, sanitizeInline).
Output: A generalized `InlineRichText` component, 7 converted editors, 7 updated renderers, and updated SCORM export (block HTML + interaction runtime).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@.planning/quick/260707-gtl-rich-text-captions-with-per-character-fo/260707-gtl-SUMMARY.md

<discovery>
Facts established during planning (do NOT re-derive):

Existing shared pieces (from plan 260707-gtl):
- `apps/web/src/lib/tiptap/fontSize.tsx` — FontSize extension + FontSizeControl.
- `apps/web/src/components/CaptionEditor.tsx` — compact inline Tiptap editor (trimmed StarterKit + Underline + TextStyle + Color + FontSize), legacy fallback `value.includes('<') ? value : '<p>'+value+'</p>'`, saves inline HTML with outer `<p>` stripped.
- `packages/renderer/src/sanitizeInline.ts` — DOMPurify inline allowlist incl. `style`; plain strings (no `<`) pass through as text.
- `apps/web/src/lib/scormExport.ts` already sanitizes image/gallery captions with an inline-allowlist DOMPurify call — reuse that same helper for all fields converted here.

Plain-text field inventory (exact edit sites):
- `AccordionBlockEditor.tsx`: section title `<input>` ~line 157 (STAYS PLAIN — structural), section content `<textarea>` ~line 182 → CONVERT.
- `CalloutBlockEditor.tsx`: title `<input>` ~line 72 → CONVERT; body `<textarea>` ~line 83 → CONVERT.
- `QuoteBlockEditor.tsx`: text `<textarea>` ~line 40 → CONVERT; attribution `<input>` ~line 50 → CONVERT.
- `FlashcardBlockEditor.tsx`: front `<textarea>` ~line 106, back `<textarea>` ~line 116 → CONVERT both.
- `ProcessBlockEditor.tsx`: step title `<input>` ~line 77 (STAYS PLAIN), step body `<textarea>` ~line 84 → CONVERT.
- `MCQBlockEditor.tsx`: question `<textarea>` ~line 167, option text `<input>` ~line 216, option feedback `<input>` ~line 260 → CONVERT all.
- `TrueFalseBlockEditor.tsx`: statement `<textarea>` ~line 67, trueFeedback `<input>` ~line 107, falseFeedback `<input>` ~line 119 → CONVERT all.
- `ButtonBlockEditor.tsx`: label + URL STAY PLAIN (discretion: label is styled by the button variant; rich inline sizing inside a themed button fights its typography; URL is structural).

Preview renderer sites (currently plain React text — all need sanitizeInline + dangerouslySetInnerHTML):
- `AccordionBlockRenderer.tsx` line ~56 `{s.content}`.
- `CalloutBlockRenderer.tsx` lines ~62 `{payload.title}`, ~65 `{payload.body}`.
- `QuoteBlockRenderer.tsx` line ~28 `{payload.text}` and the attribution/cite render site.
- `FlashcardBlockRenderer.tsx` — visible front/back render sites; NOTE line ~37 `aria-label` interpolates `card.front`/`card.back` — aria-label must use a tag-STRIPPED plain string, never HTML.
- `ProcessBlockRenderer.tsx` lines ~44 `{step.title}` (leave plain), ~46 `{step.body}`.
- `MCQBlockRenderer.tsx` lines ~70 `{question}`, ~105 `{opt.text}`, plus feedback display site.
- `TrueFalseBlockRenderer.tsx` lines ~33 `{statement}`, ~70 `{feedback}` (computed prefix + payload feedback — keep prefix outside the injected HTML).

SCORM export (`apps/web/src/lib/scormExport.ts`):
- Static HTML cases using `escapeHtml` on converted fields: `accordion` (~line 200 `<p>${escapeHtml(s.content)}</p>`), `quote` (~210-213), `callout` (~221-227), `flashcard` (~250-251 front/back — these are separate always-present divs toggled by display, NO runtime text swap, so a simple sanitize swap works), `process` (~273-275), `mcq` (~163-177: option text inline; per-option feedback goes into `data-feedback="${escapeHtml(...)}"`), `trueFalse` (~183-184: statement inline; feedback into `data-tf`/`data-ff` attributes).
- Exported runtime (`buildInteractionJs`): MCQ result at ~line 967 (`result.textContent=...` — fixed strings only, but per-option feedback display reads `data-feedback`; executor must locate that read) and TrueFalse at ~line 1002 (`res.textContent=(ok?'Correct! ':'Not quite. ')+(answer?tf:ff)` where tf/ff come from `data-tf`/`data-ff`). Displaying rich feedback requires switching these result sinks to `innerHTML`. This is SAFE ONLY because the attribute values are sanitized at build time (sanitize FIRST, then attribute-escape via escapeHtml when embedding; getAttribute un-escapes back to the sanitized HTML).
- CMI: the runtime currently writes ONLY `cmi.core.score.*` and `cmi.core.lesson_status` — no `cmi.interactions.*`. Nothing HTML-bearing reaches CMI today. Guard: if any CMI write of question/feedback text is ever added, it must use a tag-stripped plain string.

XSS rule for this whole plan: every author-HTML string crosses exactly one of two sinks — (a) renderer `dangerouslySetInnerHTML` ONLY via `sanitizeInline(...)`; (b) export HTML ONLY via the scormExport sanitize helper (never raw, never plain escapeHtml for converted fields; escapeHtml remains for alt text, URLs, ids, titles that stay plain). `customHtml` block is intentionally unsanitized (pre-existing decision) — do not touch.

Backward compat: `sanitizeInline` already treats no-`<` strings as plain text, so legacy content renders without migration; editors use the `includes('<')` seeding pattern. Known accepted edge: legacy plain text containing a literal `<` (e.g. "x < 5") may lose characters through the heuristic — same tradeoff already accepted for tab labels and captions.
</discovery>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Generalize InlineRichText and convert the five content-block editors + renderers + export</name>
  <files>apps/web/src/components/InlineRichText.tsx, apps/web/src/components/CaptionEditor.tsx, apps/web/src/components/AccordionBlockEditor.tsx, apps/web/src/components/CalloutBlockEditor.tsx, apps/web/src/components/QuoteBlockEditor.tsx, apps/web/src/components/FlashcardBlockEditor.tsx, apps/web/src/components/ProcessBlockEditor.tsx, packages/renderer/src/AccordionBlockRenderer.tsx, packages/renderer/src/CalloutBlockRenderer.tsx, packages/renderer/src/QuoteBlockRenderer.tsx, packages/renderer/src/FlashcardBlockRenderer.tsx, packages/renderer/src/ProcessBlockRenderer.tsx, apps/web/src/lib/scormExport.ts</files>
  <action>
    (a) Extract the guts of `CaptionEditor.tsx` into a new generalized `apps/web/src/components/InlineRichText.tsx` (props: `value`, `onChange`, `placeholder?`, `multiline?: boolean`, `className?`). Toolbar: Bold, Italic, Color, FontSizeControl (all from existing shared modules). Keep the legacy-seed (`includes('<')`) and outer-`<p>`-strip-on-save behavior for single-line use; when `multiline` is true, allow paragraphs/hard breaks and do NOT strip the wrapper (accordion bodies, callout body, quote text, flashcard faces, process bodies are multiline; callout title, quote attribution are single-line). Refactor `CaptionEditor.tsx` to be a thin wrapper over `InlineRichText` so caption behavior is unchanged.
    (b) Replace the plain fields listed in discovery with `InlineRichText` in AccordionBlockEditor (section content only — titles stay plain `<input>`), CalloutBlockEditor (title single-line + body multiline), QuoteBlockEditor (text multiline + attribution single-line), FlashcardBlockEditor (front + back multiline), ProcessBlockEditor (step body only — titles stay plain). Keep every stored JSON shape unchanged (fields remain strings, now holding inline HTML); wire onChange to the existing commit/update calls.
    (c) In the five corresponding renderers, replace the plain-text render sites (exact lines in discovery) with `dangerouslySetInnerHTML={{ __html: sanitizeInline(field) }}` importing from `./sanitizeInline`. In FlashcardBlockRenderer, the `aria-label` must use a tag-stripped plain string (add a tiny `stripHtml` — e.g. regex `/<[^>]*>/g` removal — inline or in sanitizeInline.ts as a named export).
    (d) In `scormExport.ts`, switch the `accordion`, `quote`, `callout`, `flashcard`, and `process` cases from `escapeHtml(field)` to the existing sanitize helper for the converted fields ONLY (accordion section titles, process step titles stay escapeHtml). Flashcards need no runtime change (front/back are separate divs toggled via display).
    XSS rule: no converted field may reach a dangerouslySetInnerHTML or export HTML string without passing the sanitizer.
  </action>
  <verify>
    <automated>cd apps/web && pnpm run typecheck</automated>
  </verify>
  <done>All five content blocks author rich inline text with FontSize; preview renders via sanitizeInline; export emits sanitized HTML; JSON shapes unchanged; legacy plain strings still render; typecheck passes.</done>
</task>

<task type="auto">
  <name>Task 2: Convert quiz text surfaces (MCQ + TrueFalse) end-to-end including exported runtime</name>
  <files>apps/web/src/components/MCQBlockEditor.tsx, apps/web/src/components/TrueFalseBlockEditor.tsx, packages/renderer/src/MCQBlockRenderer.tsx, packages/renderer/src/TrueFalseBlockRenderer.tsx, apps/web/src/lib/scormExport.ts</files>
  <action>
    (a) Editors: replace MCQ question/option-text/option-feedback and TrueFalse statement/trueFeedback/falseFeedback fields with `InlineRichText` (question + statement multiline; options + feedback single-line). Stored payload shapes unchanged.
    (b) Preview renderers: render question, statement, option text, and feedback through `sanitizeInline` + dangerouslySetInnerHTML (MCQBlockRenderer ~lines 70/105 + its feedback site; TrueFalseBlockRenderer ~lines 33/70). In TrueFalse, keep the "Correct!/Not quite" prefix as plain JSX OUTSIDE the injected HTML span.
    (c) scormExport static HTML: in the `mcq` case, sanitize question and option text instead of escapeHtml; for `data-feedback` (and TrueFalse `data-tf`/`data-ff`), sanitize the HTML FIRST, then pass the sanitized result through `escapeHtml` for attribute embedding (getAttribute returns the sanitized HTML at runtime). In `trueFalse`, sanitize the statement inline.
    (d) Exported runtime (`buildInteractionJs`): locate every sink that displays per-option feedback / tf-ff feedback (TrueFalse ~line 1002 `res.textContent=(ok?'Correct! ':'Not quite. ')+(answer?tf:ff)`; find the MCQ `data-feedback` read near the ~line 941-984 handler). Switch those feedback sinks from `textContent` to `innerHTML`, keeping fixed prefixes ("Correct! ", "✓ Nailed it!" etc.) concatenated as literal strings. Do NOT switch any sink that displays non-authored text. This is safe solely because attribute values were sanitized at build time — add a code comment saying so.
    (e) CMI guard: confirm no `cmi.interactions.*` writes exist (none do today — only score/status). Add a comment at the score-reporting site: any future CMI write of authored text must strip tags first.
  </action>
  <verify>
    <automated>cd apps/web && pnpm run typecheck</automated>
  </verify>
  <done>Quiz text authors rich; preview + exported quiz HTML render rich question/options/feedback; feedback attributes carry build-time-sanitized HTML; no HTML reaches CMI; typecheck passes.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify rich text across all converted blocks in editor, preview, and SCORM export</name>
  <what-built>Tasks 1-2 converted accordion bodies, callout title/body, quote text/attribution, flashcard front/back, process step bodies, MCQ question/options/feedback, and TrueFalse statement/feedback to inline rich text with FontSize, rendered through sanitizeInline in preview and sanitized HTML in the SCORM export (including a textContent→innerHTML change for quiz feedback display in the exported runtime).</what-built>
  <how-to-verify>
    1. `cd apps/web && pnpm run dev`. For each converted block (accordion, callout, quote, flashcard, process, MCQ, TrueFalse): type text, select a few characters, apply a font size + bold — confirm only the selection resizes in editor AND preview pane.
    2. Backward compat: open a module authored before this change — confirm all these blocks still display their old plain-text content.
    3. XSS spot-check: in an MCQ feedback field, paste `<img src=x onerror=alert(1)>` — confirm no alert fires in preview and the payload is neutralized.
    4. Export to SCORM, unzip, open a lesson with an MCQ + TrueFalse: answer them and confirm feedback text renders rich (sized/bold) and no raw HTML tags show as text anywhere.
    5. Upload to SCORM Cloud (or confirm local player): package still validates SCORM 1.2 and score/completion still report.
  </how-to-verify>
  <resume-signal>Type "approved" once all converted surfaces render rich in editor/preview/export with legacy content intact and the XSS probe neutralized, or describe issues.</resume-signal>
</task>

</tasks>

<verification>
- `pnpm run typecheck` passes in `apps/web` (project references cover `@prism/renderer`).
- Manual checkpoint (Task 3): rich rendering in editor, preview, and exported SCORM; legacy content intact; XSS probe neutralized; SCORM 1.2 still validates.
</verification>

<success_criteria>
- One shared `InlineRichText` component powers every converted field (no per-editor Tiptap duplication); CaptionEditor delegates to it.
- Accordion bodies, callout title/body, quote text/attribution, flashcard front/back, process step bodies, and all MCQ/TrueFalse authorable text support per-character font sizing.
- Every converted field passes through `sanitizeInline` (preview) or the scormExport sanitize helper (export) — zero unsanitized HTML sinks for author content (customHtml excepted, pre-existing).
- Alt text, URLs, accordion/process titles, button label, and structural fields remain plain; nothing HTML-bearing is written to SCORM CMI.
- Deferred (out of scope, flagged for a follow-up quick task): scenario, revealCards, matching, sorting, fillBlanks, hotspots, labeledGraphic, audio transcript, and compare labels — their exported runtimes swap text via `textContent`/data attributes and each needs its own runtime rework; button label skipped by discretion ("if sensible" — variant typography owns it).
</success_criteria>

<output>
Create `.planning/quick/260707-hbg-convert-remaining-text-surfaces-to-rich-/260707-hbg-SUMMARY.md` when done.
</output>

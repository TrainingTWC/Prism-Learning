---
phase: quick-260707-gtl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/lib/tiptap/fontSize.tsx
  - apps/web/src/components/RichTextBlockEditor.tsx
  - apps/web/src/components/TabsBlockEditor.tsx
  - apps/web/src/components/CaptionEditor.tsx
  - apps/web/src/components/ImageBlockEditor.tsx
  - apps/web/src/components/GalleryBlockEditor.tsx
  - packages/renderer/src/sanitizeInline.ts
  - packages/renderer/src/RichTextBlock.tsx
  - packages/renderer/src/ImageBlockRenderer.tsx
  - packages/renderer/src/GalleryBlockRenderer.tsx
  - apps/web/src/lib/scormExport.ts
autonomous: false
requirements: []

must_haves:
  truths:
    - "In any Tiptap toolbar, an author can select individual letters and change only their font size"
    - "Image block captions and carousel (gallery) slide captions are rich-text editable with the same font-size control"
    - "Inline font-size (and existing color/spacing) spans render correctly in the authoring preview"
    - "Inline font-size spans and rich captions survive into the exported SCORM 1.2 HTML"
    - "Existing plain-string captions still render (no data migration required)"
  artifacts:
    - path: apps/web/src/lib/tiptap/fontSize.tsx
      provides: "Shared FontSize Tiptap extension + FONT_SIZES + FontSizeControl component"
      contains: "FontSize"
    - path: apps/web/src/components/CaptionEditor.tsx
      provides: "Compact shared rich-text caption editor with backward-compat plain-string handling"
      contains: "CaptionEditor"
    - path: packages/renderer/src/sanitizeInline.ts
      provides: "Shared inline caption sanitizer allowing formatting + style attr"
  key_links:
    - from: apps/web/src/components/RichTextBlockEditor.tsx
      to: apps/web/src/lib/tiptap/fontSize.tsx
      via: "import FontSize extension + FontSizeControl"
      pattern: "fontSize"
    - from: apps/web/src/lib/scormExport.ts
      to: "caption HTML"
      via: "sanitize instead of escapeHtml for image/gallery captions"
      pattern: "DOMPurify.sanitize"
    - from: packages/renderer/src/RichTextBlock.tsx
      to: "inline style spans"
      via: "ALLOWED_ATTR includes 'style'"
      pattern: "'style'"
---

<objective>
Add rich-text editing with per-character font-size control across all Tiptap text surfaces of Prism Learning, convert image and carousel (gallery) captions from plain-text inputs to rich-text editors, and make inline font-size spans + rich captions render correctly in BOTH the authoring preview (`packages/renderer`) and the exported SCORM 1.2 HTML.

Purpose: Authors need selection-level font sizing (select individual letters, change only their size) and formatted captions, consistently everywhere text is edited.
Output: A shared FontSize extension + toolbar control, a shared caption editor, updated renderers/sanitizers, and an updated SCORM exporter.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

<discovery>
Codebase facts established during planning (do NOT re-derive):

- Only TWO Tiptap surfaces exist today:
  1. `apps/web/src/components/RichTextBlockEditor.tsx` — the main shared editor with a full toolbar. Used by the text block AND (via import) by Tabs content. It already registers `TextStyle`, `Color`, and custom `LineHeight` + `LetterSpacing` extensions. The `LetterSpacing` extension (an `Extension.create` that adds an attribute to the `textStyle` mark and applies it via `setMark('textStyle', { letterSpacing })`) is the EXACT pattern to copy for FontSize.
  2. `apps/web/src/components/TabsBlockEditor.tsx` — contains `InlineLabelEditor`, a mini Tiptap editor (StarterKit trimmed + Underline + TextStyle + Color) for tab labels.
- All OTHER block editors (Accordion, Callout, Quote, Flashcard, Process, MCQ, TrueFalse, etc.) use plain `<input>`/`<textarea>` — they are NOT Tiptap and are OUT OF SCOPE for the font-size control.
- Tiptap is v3.24.0. `@tiptap/extension-text-style` IS installed. There is NO `@tiptap/extension-font-size` — build a small custom extension (do NOT add a dependency). Pin to the Tiptap v3 API (`Extension.create`, `addGlobalAttributes` on `textStyle`, or `addAttributes` + a `setFontSize`/`unsetFontSize` command via `setMark`/`unsetMark` on `textStyle`).
- Captions: `ImageBlockEditor.tsx` stores `{ storageId, altText, caption }` JSON; caption is edited via a plain `<input>` (~line 215-224). `GalleryBlockEditor.tsx` stores `items: { storageId, altText, caption }[]`; caption via `<input>` (~line 94-95). "Carousel" == the gallery block's carousel layout.
- Rendering of captions today (plain text):
  - `packages/renderer/src/ImageBlockRenderer.tsx` line ~110: `<figcaption>{payload.caption}</figcaption>`.
  - `packages/renderer/src/GalleryBlockRenderer.tsx` lines ~21 and ~34: `{it.caption}` / `{cur.caption}`.
- Sanitizer state:
  - `packages/renderer/src/RichTextBlock.tsx` ALLOWED_ATTR = `['href','target','rel','class','src','alt','width','height']` — MISSING `'style'`, so inline font-size/color/spacing spans are currently stripped in preview. Adding `'style'` fixes font-size AND the pre-existing color/spacing stripping. DOMPurify's built-in CSS filter permits `font-size` once `'style'` is allowed — no extra CSS allowlist config needed.
  - `apps/web/src/lib/scormExport.ts` richText case (line ~114) ALREADY has `'style'` in ALLOWED_ATTR — text-block font sizes already survive export. BUT the `image` case (line ~136) and `gallery` case (line ~336/338) wrap captions in `escapeHtml(...)`, which would neutralize caption HTML — these must switch to sanitizing.
  - `packages/renderer/src/TabsBlockRenderer.tsx` injects `tab.content` and `tab.title` via `dangerouslySetInnerHTML` WITHOUT DOMPurify (author-trusted) — font-size spans already survive there; no change needed.
- Backward-compat pattern already in the codebase: `InlineLabelEditor` seeds Tiptap with `value.includes('<') ? value : '<p>' + value + '</p>'` and strips the outer `<p>` on save to keep inline HTML. Reuse this pattern for captions.
</discovery>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Shared FontSize extension + control, wired into both existing Tiptap surfaces</name>
  <files>apps/web/src/lib/tiptap/fontSize.tsx, apps/web/src/components/RichTextBlockEditor.tsx, apps/web/src/components/TabsBlockEditor.tsx</files>
  <behavior>
    - Selecting a range of text and choosing a size applies `font-size` to only that selection (a `textStyle` mark span), not the whole block.
    - Choosing "Default"/empty removes the font-size from the selection (unsetMark on the fontSize attribute) without wiping color/spacing on the same textStyle mark.
    - The control reflects the current selection's active font size.
    - Round-trip: editor HTML output contains `<span style="font-size: 20px">…</span>` (or similar) for sized runs and parses it back on reload.
  </behavior>
  <action>
    Create `apps/web/src/lib/tiptap/fontSize.tsx` exporting: (a) a `FontSize` Tiptap v3 `Extension.create` that adds a `fontSize` attribute to the `textStyle` mark — mirror the existing `LetterSpacing` extension in RichTextBlockEditor.tsx (parseHTML from `el.style.fontSize`, renderHTML emitting `style: font-size: <value>` when set) and add `setFontSize(size)` / `unsetFontSize()` commands using `setMark('textStyle', { fontSize })` and `setMark('textStyle', { fontSize: null })` so other textStyle attrs (color, letterSpacing) are preserved; (b) a `FONT_SIZES` options array (e.g. Default '', then 12px,14px,16px,18px,20px,24px,30px,36px,48px); (c) a `FontSizeControl({ editor })` React component rendering a compact `<select>` (match the existing line-height/letter-spacing `<select>` styling in RichTextBlockEditor.tsx, including `onMouseDown` stopPropagation) that reads `editor.getAttributes('textStyle').fontSize` and calls the commands on change. Then register `FontSize` in the extensions array and drop `<FontSizeControl editor={editor} />` into the toolbar of BOTH `RichTextBlockEditor.tsx` (main toolbar, next to the letter-spacing control) and the `InlineLabelEditor` in `TabsBlockEditor.tsx` (add `FontSize` to its extensions list and place the control in its mini toolbar). Do NOT duplicate the extension logic — both surfaces import from `fontSize.tsx`. Since `RichTextBlockEditor` is also used for Tabs *content*, that surface is covered automatically.
  </action>
  <verify>
    <automated>cd apps/web && pnpm run typecheck</automated>
  </verify>
  <done>FontSize extension + control exist in one shared module and are wired into RichTextBlockEditor and TabsBlockEditor's InlineLabelEditor; typecheck passes; sized text produces inline `font-size` spans scoped to the selection.</done>
</task>

<task type="auto">
  <name>Task 2: Rich-text captions for image + carousel (gallery) blocks</name>
  <files>apps/web/src/components/CaptionEditor.tsx, apps/web/src/components/ImageBlockEditor.tsx, apps/web/src/components/GalleryBlockEditor.tsx</files>
  <action>
    Create `apps/web/src/components/CaptionEditor.tsx` — a compact shared Tiptap caption editor (props: `value: string`, `onChange: (html: string) => void`, optional `placeholder`). Configure a trimmed StarterKit (no headings/lists/blockquote/codeBlock/hr) + `Underline` + `TextStyle` + `Color` + the shared `FontSize` from Task 1, with a small toolbar containing Bold, Italic, Color, and `<FontSizeControl editor={editor} />`. Handle backward compatibility EXACTLY like `InlineLabelEditor`: seed content with `value.includes('<') ? value : (value ? '<p>' + value + '</p>' : '')`, and on `onUpdate` strip the outer `<p>…</p>` wrapper so captions save as inline HTML (e.g. `Some <span style="font-size:20px">big</span> caption`). Then replace the plain caption `<input>` in `ImageBlockEditor.tsx` (the caption field ~line 215-224, keeping the `save(storageId, altText, html)` call) with `<CaptionEditor value={caption} onChange={(html) => { setCaption(html); if (storageId) save(storageId, altText, html); }} />`, and replace the per-item caption `<input>` in `GalleryBlockEditor.tsx` (~line 94-95) with `<CaptionEditor value={it.caption} onChange={(html) => update(i, { caption: html })} />`. Keep the stored JSON shape unchanged (caption remains a string field, now holding inline HTML). Existing plain-string captions load unchanged via the `includes('<')` fallback.
  </action>
  <verify>
    <automated>cd apps/web && pnpm run typecheck</automated>
  </verify>
  <done>Image caption and gallery slide captions use CaptionEditor with the font-size control; captions persist as inline HTML; legacy plain-string captions still load; typecheck passes.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Render font-size + rich captions in preview AND SCORM export</name>
  <what-built>
    Rendering fixes so inline font-size spans and rich captions survive into both the authoring preview and the exported SCORM zip. Files changed:
    - `packages/renderer/src/RichTextBlock.tsx`: add `'style'` to `ALLOWED_ATTR` (fixes font-size + pre-existing color/spacing stripping in preview).
    - NEW `packages/renderer/src/sanitizeInline.ts`: export `sanitizeInline(html)` using DOMPurify with ALLOWED_TAGS `['span','strong','em','b','i','u','s','br','a']` and ALLOWED_ATTR `['style','class','href','target','rel']`; if the input contains no `<`, return it as escaped plain text (legacy caption fallback).
    - `packages/renderer/src/ImageBlockRenderer.tsx`: render figcaption via `dangerouslySetInnerHTML={{ __html: sanitizeInline(payload.caption) }}` instead of `{payload.caption}`.
    - `packages/renderer/src/GalleryBlockRenderer.tsx`: render both caption sites (grid figcaption + carousel `<p>`) via `sanitizeInline` the same way.
    - `apps/web/src/lib/scormExport.ts`: in the `image` and `gallery` cases, replace `escapeHtml(caption)` for the caption text with a sanitize call (reuse the same allowlist: inline tags + `style`) so caption HTML survives export; leave alt text on `escapeHtml`. Confirm the `richText` case already includes `'style'` (it does) — no change needed there.
    (Implement all edits above autonomously, THEN pause for this human verification.)
  </what-built>
  <how-to-verify>
    1. Run `cd packages/renderer && pnpm run build` (or repo typecheck) — should pass.
    2. `cd apps/web && pnpm run dev`. In a lesson: add a Text block, select a few letters, change their font size — confirm ONLY those letters resize in the editor and in the live preview pane.
    3. Add an Image block, type a caption, select part of it and change its size + bold — confirm the preview figcaption shows the formatting.
    4. Add a Gallery block in carousel layout with a slide caption; format part of it; confirm the preview slide caption shows the formatting.
    5. Export the module to SCORM, unzip, open a `lesson_*.html` in a browser (or upload to SCORM Cloud): confirm the sized text and formatted captions render, and that the package still validates as SCORM 1.2.
    6. Open an existing module that had plain-text captions from before this change — confirm captions still display (no blank/broken captions).
  </how-to-verify>
  <resume-signal>Type "approved" once per-character sizing + rich captions render in the editor, preview, and exported SCORM (and legacy captions still show), or describe what broke.</resume-signal>
</task>

</tasks>

<verification>
- `pnpm run typecheck` passes in `apps/web` (covers the referenced `@prism/renderer` project via tsc project references).
- `packages/renderer` builds.
- Manual: selection-level font sizing works in the text block, tab label, tab content, image caption, and gallery caption; renders in preview; survives SCORM export; legacy captions still render.
</verification>

<success_criteria>
- A single shared `FontSize` extension + `FontSizeControl` power every Tiptap toolbar (text block, tab label, tab content, and both caption editors) with no per-editor duplication of the extension logic.
- Image and carousel/gallery captions are rich-text with per-character font sizing.
- Inline `font-size` spans and rich captions render in both the authoring preview and the exported SCORM 1.2 HTML.
- Existing plain-string captions render without migration.
</success_criteria>

<output>
Create `.planning/quick/260707-gtl-rich-text-captions-with-per-character-fo/260707-gtl-SUMMARY.md` when done.
</output>

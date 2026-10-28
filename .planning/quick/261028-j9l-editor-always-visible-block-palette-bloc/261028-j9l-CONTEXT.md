# Quick Task 261028-j9l: Editor always-visible block palette + block width/spacing fix - Context

**Gathered:** 2026-10-28
**Status:** Ready for planning

<domain>
## Task Boundary

User feedback on the live redesign (quick 261028-h2k):
1. "I want a static blocks option, not one that is visible on click. It should be visible throughout."
2. "The padding and content width for the blocks aren't working."

(The logo issue was fixed separately in commit c578a7b.)

</domain>

<root_causes>
## Root causes found by the orchestrator
- `apps/web/src/components/editor/CanvasBlock.tsx`: the SELECTED block renders its editor with NO block style
  ("Editors are designed for white backgrounds, so block style is not applied here") — authors change width/spacing in
  the inspector while the block is selected and see nothing happen.
- `packages/renderer/src/blockStyle.ts`: `wide` bleeds only half of `--prism-block-bleed` (28px on the 56px canvas,
  32px in export) — imperceptible. `narrow` = 36rem is close to the export column (652px content).
- Spacing: `none` emits nothing; `s/m/l` only ADD padding on top of each block's built-in vertical margins
  (renderer roots use `my-6`; export block HTML has its own margins), so the gap barely changes and "None" never
  removes it.
</root_causes>

<decisions>
## Implementation Decisions (locked)

### A. Always-visible block palette (right column)
- The editor's right column becomes a permanent **Blocks palette** (~264px): search field at top, then the
  `CATEGORIES` from `components/editor/blockCatalog.tsx` as groups, each a 2-column grid of tiles (icon + label,
  description in `title` tooltip), plus an "Import questions" tile/button (opens existing ImportQuizDialog).
  Style per the studio tokens (white panel, `border-line`, tiles `rounded-[12px]`, hover `bg-brand-soft`).
- Clicking a tile inserts at the current insertion point: after the selected block if one is selected, otherwise
  at the end of the lesson; the new block becomes selected (reuse `handleAddBlock`). A small line at the top of the
  palette states the insertion point ("Adds after: Text" / "Adds at end of lesson"). Disabled when no active lesson.
- Keep the hover "+" inserter between blocks, the quick picks, the BlockLibraryModal and the `/` shortcut as they are.
- The palette is visible at all times — selecting a block must NOT replace or hide it.

### B. Block settings move out of the right column
- The Inspector no longer occupies the right column. Its block content (Layout options for callout/button/divider/
  gallery + Style: width, background, spacing) becomes a **settings popover** opened from a new "Style"
  (sliders icon, label "Style") button on the selected block's floating toolbar in CanvasBlock. Popover ~300px,
  anchored under the toolbar on the right, white, `shadow-xl`, `rounded-[14px]`, closes on outside click, Escape, or
  deselect. Reuse the existing Inspector internals (Segmented, setStyle, setLayout, track) — refactor into a
  `BlockSettings` component rather than duplicating.
- Drop the "nothing selected" lesson-info inspector panel (tips may move to the palette footer, one or two lines).

### C. Style semantics — make them clearly visible (single source: packages/renderer/src/blockStyle.ts)
- Unstyled blocks (no style / all defaults) MUST render exactly as today in canvas, preview and SCORM export
  (SCORM parity snapshot for unstyled modules must stay byte-identical; never run vitest `-u` on it).
- Width:
  - `narrow`: max-width 30rem, centred.
  - `standard`: no change.
  - `wide`: bleed the FULL `--prism-block-bleed` both sides (reaches the lesson card/paper edge), keep radius.
  - `full`: full bleed both sides AND `border-radius: 0`; when it has a background, horizontal padding equals the
    bleed so text stays aligned with the lesson column.
- Spacing controls the real vertical gap. Whenever `spacing` is set (including `none`) OR a background is set,
  the wrapper's child vertical margins are zeroed via a stylesheet rule and the wrapper gets explicit vertical
  padding: none 0, s 16px, m 32px, l 64px (background with no explicit spacing = m).
  Implement with marker attributes on the wrapper (e.g. `data-prism-spacing`) + a CSS rule such as
  `[data-prism-spacing]>*{margin-top:0!important;margin-bottom:0!important}`. Export that base CSS string from the
  renderer (e.g. `BLOCK_STYLE_BASE_CSS`) so the SCORM exporter's `BLOCK_STYLE_CSS` and the web canvas (inject a
  `<style>` in LessonCanvas) use the same rule. Renderer purity stays intact (string constant only).
- Apply the same attributes/styles in `scormExport.ts` `renderBlockWrapper` and in `CanvasBlock` (both views).
- Background padding left/right: 1.5rem (unchanged) except `full` as above.

### D. Selected block shows its style too
- In CanvasBlock's selected state, wrap the editor in a frame that applies the block's width and background/spacing
  (via `blockStyleToCss` + marker attrs) with the editor itself inside a white rounded inner card, so width,
  background and spacing changes are visible immediately while editing. Remove the "style shows when deselected"
  hint copy.

### Quality bar
- `pnpm typecheck`, `pnpm --filter @prism/web test` (parity snapshot unchanged for unstyled; update ONLY the
  styled-block test expectations deliberately), `pnpm build`, and `npx eslint` on touched files must pass.
- Preserve all existing editor behaviours (insert at position, reorder, duplicate, move, delete, saves, presence,
  `/` shortcut, ImportQuizDialog).

### Claude's Discretion
- Exact component split/naming, popover positioning details, palette tile density.
</decisions>

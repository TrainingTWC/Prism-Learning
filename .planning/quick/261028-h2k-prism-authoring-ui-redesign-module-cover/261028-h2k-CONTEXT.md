# Quick Task 261028-h2k: Prism authoring UI redesign + module cover image - Context

**Gathered:** 2026-10-28
**Status:** Ready for planning

<domain>
## Task Boundary

Redesign the module-authoring UI/UX to match the approved design canvas, add a module cover image, then build and deploy.

Approved design (source of truth for look and layout): `design/*.dc.html` in this directory
(also published at https://claude.ai/artifact/VrBS6oCv5khGQCLNM2fbvx). Each `.dc.html` is plain HTML with
inline styles; the `<script type="text/x-dc">` block at the bottom holds the sample data and per-item
styles (`renderVals()`). Read them for exact colours, spacing, radii, copy and structure.

- `Library.dc.html` → ModuleListPage (`/w/$workspaceId/modules`)
- `Outline.dc.html` → NEW module outline page
- `Main.dc.html` → ModuleEditorPage (lesson editor)
- `Inserter.dc.html` → block library modal
- `Publish.dc.html` → NEW publish page (replaces the export dialog in ModuleEditorPage)
- `Learner.dc.html` → PreviewPage device switcher
- `BlocksContent.dc.html`, `BlocksInteractive.dc.html` → how blocks look on the canvas (renderer output, theme driven)
- `System.dc.html` → design tokens

</domain>

<decisions>
## Implementation Decisions (locked — user approved)

### Scope: "Redesign + core"
IN:
1. New light-only design language: brand purple `#8C43D0` (hover/ink `#6D2BAB`, soft `#F3EAFB`, links `#7A36BD`),
   ink `#17171C` / `#4B4B57` / `#6E6E7A`, line `#E6E6EB`, ground `#F6F6F8`, surface `#FFFFFF`.
   Font **Geist** (Google Fonts) for all app UI, replacing JetBrains Mono. Radii 8 controls / 12 cards / 18 panels.
   Remove the dark-mode toggle and `html.light` switching — light only. Keep CSS variable names where practical so
   untouched pages (Analytics, Intelligence, BuildWithAI, Members, SignIn) still render sensibly in light.
2. Module library restyle (cards with cover thumbnails, status pill, filters Drafts/Published, search, "Continue editing" card).
3. Module **cover image** + **description**: new optional fields on `modules`; upload via the existing Convex
   file-storage flow used by ImageBlockEditor/MediaUpload (reuse, convert to WebP like existing `toWebP`).
   Shown on library cards (fallback: brand-purple tile with title), outline page cover, and learner preview sidebar.
   Optional: include cover on the SCORM export's module start/sidebar only if trivial; otherwise skip.
4. NEW module outline page (route e.g. `/w/$workspaceId/m/$moduleId/outline`): cover (change/remove), description
   textarea (debounced save), lesson list with drag reorder (reuse dnd-kit + `api.lessons.reorder`), block-type chips,
   add lesson, readiness card (lite pre-flight checks, see 6), completion summary linking to publish page.
   Library cards open the outline; outline rows open the editor at that lesson.
5. Lesson editor redesign (ModuleEditorPage):
   - Top bar: logo tile (purple) → library, breadcrumb (Modules / module / lesson), saved indicator, presence avatars,
     Preview (link), Publish (→ publish page). Keep module rename.
   - Left outline rail (lessons, rename, delete, reorder, add) restyled per Main.dc.html.
   - Centre canvas: lesson "paper" (max-width ~860) with themed lesson header (workspace theme primary, heading font).
     **WYSIWYG approach**: every NOT-selected block renders through `@prism/renderer` (the same renderer learners and
     SCORM use) in the workspace theme; clicking a block selects it and swaps in its existing editor component
     (restyled to the new tokens) in place. Selected block has a purple outline + label tab + floating toolbar
     (drag handle, duplicate, move-to-lesson, delete). Escape / click outside deselects.
   - Between blocks: hover inserter line with "+" and quick picks (Text, Image, Callout, Question, All blocks).
   - Right **inspector** (when a block is selected): header with block type, tabs **Layout** (existing block-specific
     options where they exist, otherwise a short hint) and **Style** (width Narrow/Standard/Wide/Full, background
     None/Tint/Primary/Accent/Dark, spacing None/S/M/L). No Comments tab (deferred). With nothing selected the inspector
     shows lesson info / tips.
   - Remove the always-visible right block palette; the block library modal replaces it.
6. Block library modal (Inserter.dc.html): search, categories (Text, Media, Interactive, Knowledge check, Scenario,
   Structure, Advanced), tiles for the EXISTING 24 block types only, plus "Import questions" → existing
   ImportQuizDialog. Opened from inserter "All blocks", and by typing `/` in an empty rich-text paragraph or pressing
   `/` when no input is focused. Enter inserts at the chosen insertion point.
7. **Per-block style** persisted: add optional `style` object to `blocks` (`width`, `background`, `spacing`, all optional
   literals). New mutation `blocks.updateStyle`. Renderer: extend block types with optional `style` and have `Module.tsx`
   wrap each block with width/background/padding derived from theme tokens. SCORM export MUST honour it identically
   (scormExport.ts) — missing style = today's exact output (no visual change for existing modules).
8. Publish page (route e.g. `/w/$workspaceId/m/$moduleId/publish`): pre-flight checks lite (lessons have content,
   scored questions have a correct answer, images missing alt text) with "Fix" links to the lesson, completion rule
   cards, pass mark, completion-screen copy (Pass/Fail/No-quiz tabs) with live preview in theme, package card and
   "Download SCORM package" calling the existing `buildScormPackage` + `persistCompletionSettings` logic (move it out of
   ModuleEditorPage into a shared hook/module). Export warnings toast kept. SCORM 2004 NOT shown.
9. Learner preview: device switcher Desktop / Tablet / Phone (frame widths 1180 / 820 / 390), restyled chrome.

OUT (deferred — do not build): comments, team templates, version history, readiness score ring %, new block types
(banner, continue gate, table, conversation), lesson sections, Free/Sequential navigation, AI "Rewrite" button,
Ctrl+K search, per-block presence, SCORM 2004.

### Quality bar
- Bugs that block authoring or break SCORM export are unacceptable. Existing modules must look identical in SCORM
  export when no new fields are set.
- Keep renderer purity (`@prism/renderer` zero I/O).
- `pnpm typecheck`, `pnpm lint`, `pnpm --filter @prism/web test`, and `pnpm build` must pass.
- Follow `convex/_generated/ai/guidelines.md` for Convex code; schema changes must be additive/optional.

### Claude's Discretion
- Component decomposition (split ModuleEditorPage — it is ~1560 lines — into editor/ components).
- Exact WebP/upload reuse, debounce timings, keyboard handling details.
- Whether untouched secondary pages get more than token-level restyling.

</decisions>

<specifics>
## Specific Ideas
- Sample content in the design (privacy module, Priya/Jonas) is illustrative only — use real data.
- Presence avatars use real `api.presence.list` data with stable per-user colours.
- Workspace theme (`workspace.theme`) drives the lesson canvas; the default theme should become purple
  (primary `#7B35C1`, accent `#E8A33D`) where a workspace has no theme set.
</specifics>

<canonical_refs>
## Canonical References
- design/*.dc.html (this directory)
- convex/_generated/ai/guidelines.md
- packages/renderer/src (Module.tsx, tokensToCss.ts, types.ts)
- apps/web/src/lib/scormExport.ts
</canonical_refs>

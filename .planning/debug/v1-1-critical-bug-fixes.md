---
status: resolved
trigger: "5 production bugs: carousel broken in SCORM, Lottie missing in SCORM, LMS completion not tracked, lesson title not inline-editable, Tabs block has no rich text"
created: 2026-06-27
updated: 2026-06-27
slug: v1-1-critical-bug-fixes
---

# Debug Session: v1.1 Critical Bug Fixes

## Symptoms

### Bug 1 — Gallery carousel not working in published SCORM
- **Expected**: Gallery block in carousel mode shows one slide at a time; Prev/Next buttons navigate
- **Actual**: All slides shown simultaneously OR carousel buttons do nothing
- **Reproduction**: Export a module with a gallery block (carousel layout), upload to LMS, open the lesson

### Bug 2 — Lottie animations missing in published SCORM
- **Expected**: Lottie animation plays inline in the exported SCORM package
- **Actual**: Animation container is empty; nothing plays
- **Reproduction**: Export a module with a Lottie block, upload to LMS

### Bug 3 — LMS completion/score not tracked after finishing module
- **Expected**: After learner clicks "Finish" on the last lesson, LMS records `cmi.core.lesson_status = completed` and score
- **Actual**: LMS shows no completion data; status stays "not attempted" or "incomplete"
- **Reproduction**: Upload SCORM zip to SCORM Cloud or real LMS, complete all lessons, click Finish, check LMS gradebook

### Bug 4 — Lesson title in main content area not clickable for rename
- **Expected**: Clicking the `<h2>` lesson title in the main editing area activates inline rename
- **Actual**: Only the small pencil icon button triggers rename; clicking the title text does nothing
- **Reproduction**: Open any module, select a lesson — the `<h2>` title above the blocks is read-only

### Bug 5 — Tabs block content editor has no rich text (bold, colors)
- **Expected**: Tab content editor supports bold, italic, text color, headings, lists (like other rich text blocks)
- **Actual**: Tab content is a plain `<textarea>` — no formatting toolbar, no bold/color support
- **Reproduction**: Open a module, insert a Tabs block, edit the content field of any tab

---

## Current Focus

```
hypothesis: Root causes fully identified via code analysis (no further investigation needed)
test: N/A — root causes confirmed by reading source files
expecting: All 5 fixes can be applied directly
next_action: Apply fixes to source files
reasoning_checkpoint: |
  Bug 1 (carousel): apps/web/src/lib/scormExport.ts line 340 uses
  `document.currentScript.parentElement` inside an inline <script> in the
  gallery block HTML. This is fragile in LMS iframe environments. Fix: move
  gallery JS initialization to buildInteractionJs() using data-prism-gallery
  attribute (same pattern as MCQ/TF blocks at lines 922-971).

  Bug 2 (Lottie): Line 443 dynamically loads lottie-web from
  https://cdnjs.cloudflare.com — blocked by LMS CSP. Also uses `path:` which
  fetches the JSON from the R2 URL (will fail in LMS). Fix: (a) bundle
  lottie.min.js locally in assets folder during zip build, (b) embed Lottie
  JSON inline using `animationData` instead of `path`.

  Bug 3 (SCORM completion): minimalScormShim() at line 1768 defines
  `var API={...no-ops...}` as a GLOBAL variable. The lesson page API
  discovery at line 1308 runs `(typeof API!=='undefined')?API:...` and
  finds the shim's no-op API instead of the real LMS API. Fix: change shim
  to NOT define `var API` globally; improve API discovery to traverse frame
  hierarchy FIRST before checking window scope.

  Bug 4 (lesson title): ModuleEditorPage.tsx line 599 renders the lesson
  title as a static <h2>. Only the separate pencil button at line 600 calls
  setRenamingLessonId. Fix: add onClick to the <h2> that triggers the same
  rename action.

  Bug 5 (Tabs editor): TabsBlockEditor.tsx line 136 uses a plain <textarea>
  for tab content. Fix: replace textarea with RichTextBlockEditor component.
  TabsBlockRenderer.tsx must also render the content as HTML (not plain text).
```

---

## Evidence

- timestamp: 2026-06-27T00:00:00Z
  observation: "scormExport.ts:340 — gallery carousel uses `document.currentScript.parentElement` inline script"
  file: apps/web/src/lib/scormExport.ts
  line: 340

- timestamp: 2026-06-27T00:00:00Z
  observation: "scormExport.ts:443 — Lottie loads from cdnjs CDN; uses path: R2 URL"
  file: apps/web/src/lib/scormExport.ts
  line: 443

- timestamp: 2026-06-27T00:00:00Z
  observation: "minimalScormShim() defines `var API={...}` as global at line 1768"
  file: apps/web/src/lib/scormExport.ts
  line: 1768

- timestamp: 2026-06-27T00:00:00Z
  observation: "Lesson title at line 599 is static <h2>; pencil button at line 600 is only rename trigger"
  file: apps/web/src/pages/ModuleEditorPage.tsx
  line: 599-607

- timestamp: 2026-06-27T00:00:00Z
  observation: "TabsBlockEditor content field is plain <textarea> at line 136"
  file: apps/web/src/components/TabsBlockEditor.tsx
  line: 136-142

---

## Eliminated Hypotheses

(none — root causes confirmed directly from source)

---

## Resolution

root_cause: |
  1. Gallery carousel: inline `document.currentScript` pattern unreliable in LMS iframe
  2. Lottie: CDN dependency + R2 path URL (both blocked/expired in LMS)
  3. SCORM completion: minimalScormShim defines global `var API={}` shadowing real LMS API
  4. Lesson title: static <h2> with no click handler
  5. Tabs content: plain textarea instead of Tiptap rich text editor

fix: |
  1. Gallery: removed inline <script> from carousel HTML; added data-prism-gallery attribute;
     moved carousel init JS into buildInteractionJs() using querySelectorAll('[data-prism-gallery]').
  2. Lottie: removed CDN script-injection from block HTML; added <script src="assets/lottie.min.js">
     to lesson page <head>; bundled lottie.min.js locally during zip creation by fetching from CDN
     at export time. Block init now uses DOMContentLoaded guard without dynamic script insertion.
  3. SCORM completion: changed minimalScormShim() to set window.__prismFallbackAPI instead of
     global var API. Fixed API discovery on welcome, lesson, and goodbye pages to traverse frame
     hierarchy first (up to 7 levels) before falling back to __prismFallbackAPI. Updated
     buildInteractionJs() MCQ/TF SCORM calls to use window.__prismAPI instead of bare API.
  4. Lesson title: added onClick handler to <h2> that calls setRenamingLessonId + setRenameLessonValue,
     plus cursor-pointer and hover:text-[var(--text-secondary)] classes and title="Click to rename".
  5. Tabs editor: imported RichTextBlockEditor; replaced <textarea> with <RichTextBlockEditor>
     (keyed on tab id so editor reinitialises when switching tabs). Updated TabsBlockRenderer to
     render tab content as HTML via dangerouslySetInnerHTML.

verification: TypeScript check passes (npx tsc --noEmit) on both apps/web and packages/renderer.
files_changed:
  - apps/web/src/lib/scormExport.ts
  - apps/web/src/pages/ModuleEditorPage.tsx
  - apps/web/src/components/TabsBlockEditor.tsx
  - packages/renderer/src/TabsBlockRenderer.tsx

# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## new-lesson-titles-not-editable — Newly created lesson titles could not be renamed in the authoring UI
- **Date:** 2026-07-07
- **Error patterns:** lesson title, rename, not editable, new lesson, inline input, autoFocus, blur, focus steal, edit mode closes, ModuleEditorPage
- **Root cause:** 8cea98b added an inline rename input in the canvas header gated on `renamingLessonId === activeLesson._id`, while the sidebar row input remained gated on `renamingLessonId === lesson._id`. Renaming the active lesson mounted BOTH inputs with autoFocus; the second focus() synchronously blurred the first input, whose onBlur committed the rename and set renamingLessonId(null), closing edit mode before the user could type. New lessons are auto-activated by handleAddLesson, so their titles were never editable.
- **Fix:** In ModuleEditorPage.tsx, gate the sidebar row's rename input on the lesson NOT being active — `isRenaming={renamingLessonId === lesson._id && lesson._id !== activeLessonId}` — so at most one autoFocus rename input ever mounts. The canvas header input is the single editor for the active lesson; sidebar inline rename still works for non-active lessons.
- **Files changed:** apps/web/src/pages/ModuleEditorPage.tsx
---

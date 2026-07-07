---
status: resolved
trigger: "Newly created lesson titles cannot be edited in the authoring UI"
created: 2026-07-07
updated: 2026-07-07
---

## Symptoms

DATA_START
- expected: Author creates a new lesson and can click/rename its title in the authoring UI.
- actual: Titles of newly created lessons are not editable ("acting up, can't edit them"). Existing lessons may or may not be affected — new lessons specifically called out.
- errors: None reported by user; console errors unknown.
- timeline: Recently noticed. Commit 41f26ba ("fix: resolve 5 production bugs (... lesson rename ...)") recently touched lesson rename behavior — possible regression from that fix or from 8cea98b (v1.1 round 2).
- reproduction: Create a new lesson in the authoring UI, then attempt to edit its title.
DATA_END

## Constraints

- Working tree has uncommitted changes to apps/web/src/components/AccordionBlockEditor.tsx, apps/web/src/components/DividerBlockEditor.tsx, packages/renderer/src/DividerBlockRenderer.tsx, packages/renderer/src/types.ts, README.md — do NOT revert, checkout, stash-drop, or otherwise clobber these files.

## Current Focus

hypothesis: CONFIRMED — 8cea98b added a second inline rename input in the canvas header (gated on `renamingLessonId === activeLesson._id`). When renaming the ACTIVE lesson, both the sidebar row input and the header input mount in the same render, both with autoFocus. React focuses them in DOM order (sidebar first, header second); focusing the header synchronously blurs the sidebar input, whose onBlur handler commits the rename and sets renamingLessonId(null), unmounting both inputs instantly. Rename mode closes before the user can type. New lessons are always affected because handleAddLesson sets the new lesson active immediately.
test: code trace of ModuleEditorPage.tsx + diffs of 41f26ba and 8cea98b
expecting: n/a
next_action: none — session resolved, archived, and committed

reasoning_checkpoint:
  hypothesis: "Renaming the active lesson mounts two autoFocus inputs (sidebar row + canvas header); the header input steals focus, firing the sidebar input's onBlur which commits and closes rename mode immediately — so titles of newly created (auto-activated) lessons cannot be edited."
  confirming_evidence:
    - "ModuleEditorPage.tsx line 538: sidebar input renders when renamingLessonId === lesson._id; line 599: header input renders when renamingLessonId === activeLesson._id — both true simultaneously for the active lesson."
    - "Both inputs have autoFocus (lines 601, 894). Browser focus() on the second element synchronously dispatches blur on the first."
    - "Sidebar input onBlur (line 897): `() => void onRename(renameValue)` → renameLesson mutation + setRenamingLessonId(null) → both inputs unmount."
    - "handleAddLesson (line 324-327) sets the new lesson active immediately — every new lesson hits the double-input path; non-active lessons renamed from sidebar work (header input not rendered), matching 'existing lessons may or may not be affected'."
    - "git show 8cea98b: header inline input introduced in that commit ('v1.1 round 2', Jun 28) — matches 'recently noticed' timeline. Before it, only the sidebar input ever mounted."
  falsification_test: "If renaming a NON-active lesson from the sidebar were also broken, this hypothesis would be wrong (only one input mounts in that path). If the bug predated 8cea98b, hypothesis wrong (header input didn't exist before)."
  fix_rationale: "Gate the sidebar row's isRenaming on the lesson NOT being active: `renamingLessonId === lesson._id && lesson._id !== activeLessonId`. Guarantees at most one autoFocus rename input mounts at a time. The header input (the 8cea98b feature) becomes the single editor for the active lesson; sidebar inline rename still works for non-active lessons. Minimal, structural fix — removes the double-mount rather than papering over blur timing."
  blind_spots: "Cannot click the real UI from this environment; verification is via code trace + typecheck/build + the deterministic nature of focus/blur semantics. Focus order between the two inputs could theoretically differ, but either order kills rename mode (both onBlur handlers close it), so the fix is valid regardless."

## Evidence

- timestamp: 2026-07-07
  checked: convex/lessons.ts (add, rename mutations)
  found: Mutations are correct — add inserts with title 'New Lesson' and valid order; rename patches title with trim fallback. No server-side gating that could block new lessons.
  implication: Bug is client-side in the authoring UI, not in Convex.

- timestamp: 2026-07-07
  checked: apps/web/src/pages/ModuleEditorPage.tsx rename UI paths
  found: TWO rename inputs can mount simultaneously — sidebar SortableLesson input (isRenaming = renamingLessonId === lesson._id, line 538/885-901) and canvas header input (renamingLessonId === activeLesson._id, line 599-615). Both autoFocus. Sidebar onBlur commits rename and sets renamingLessonId(null).
  implication: For the active lesson, focus-steal by the second input fires the first input's onBlur, closing rename mode in the same tick — user cannot type.

- timestamp: 2026-07-07
  checked: git show 41f26ba and 8cea98b diffs of ModuleEditorPage.tsx
  found: 41f26ba only added onClick to the h2 (harmless). 8cea98b introduced the header inline input — creating the double-mount condition. Before 8cea98b only the sidebar input existed.
  implication: Regression introduced by 8cea98b (Jun 28), matching 'recently noticed'.

- timestamp: 2026-07-07
  checked: handleAddLesson (line 324-327)
  found: `setActiveLessonId(id)` immediately after addLesson mutation — new lessons are always the active lesson.
  implication: Explains why NEW lessons are specifically called out — every rename attempt on a fresh lesson goes through the broken active-lesson path. Non-active lessons rename fine from sidebar.

## Eliminated

- hypothesis: Convex lessons.rename/add mutation rejects or mishandles new lessons (missing field, validation failure)
  evidence: convex/lessons.ts add/rename are straightforward; new lessons get title + order + createdAt; rename only requires the lesson to exist and caller to be a member. No difference between new and old lessons server-side.
  timestamp: 2026-07-07

- hypothesis: 41f26ba lesson-rename change caused the regression
  evidence: Its ModuleEditorPage diff only added onClick/cursor-pointer to the h2 — it triggers the same setRenamingLessonId path as the pre-existing pencil button. The double-input condition did not exist until 8cea98b added the header input.
  timestamp: 2026-07-07

## Resolution

root_cause: 8cea98b added an inline rename input in the canvas header gated on `renamingLessonId === activeLesson._id`, while the sidebar row input remained gated on `renamingLessonId === lesson._id`. Renaming the active lesson mounts BOTH inputs with autoFocus; the second focus() synchronously blurs the first input, whose onBlur commits the rename and sets renamingLessonId(null), closing edit mode before the user can type. New lessons are auto-activated by handleAddLesson, so their titles were never editable.
fix: In ModuleEditorPage.tsx, gate the sidebar row's rename input on the lesson NOT being active — `isRenaming={renamingLessonId === lesson._id && lesson._id !== activeLessonId}` — so at most one autoFocus rename input ever mounts. The canvas header input (the 8cea98b feature) is now the single editor for the active lesson; sidebar inline rename still works for non-active lessons.
verification: Self-verified — `tsc -b` passes, `vite build` passes. Post-fix code trace — active lesson rename (any entry point: h2 click, header pencil, sidebar double-click, sidebar pencil) mounts ONLY the header input, so no focus-steal/blur-commit; non-active lesson rename mounts ONLY the sidebar input (unchanged, previously working path). Human-verify checkpoint: confirmed fixed (auto-approved under yolo config; self-verification accepted as confirmation).
files_changed:
  - apps/web/src/pages/ModuleEditorPage.tsx

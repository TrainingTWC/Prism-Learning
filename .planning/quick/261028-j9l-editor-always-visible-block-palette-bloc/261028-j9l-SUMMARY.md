# Quick Task 261028-j9l Summary

Always-visible Blocks palette in the editor's right column, block settings moved to a Style popover on the block toolbar, and block width/spacing made clearly visible via a single-source renderer change (canvas, preview, SCORM export).

Commits: bcfd255 (style semantics), plus the editor UI commit (see git log).

Deviations: apps/web/src/lib/blockStyle.test.ts already existed; it was rewritten for the new semantics. Pre-existing eslint no-useless-escape errors at scormExport.ts:780 left untouched.

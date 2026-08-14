# Quick Task 260814-ht4: Fix completion screen pass/fail bug and make completion screen text authorable - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning

<domain>
## Task Boundary

Fix the module completion screen bug: title/body always say "You crushed it!" regardless of quiz score. Root cause: `buildLessonPage`'s `showComplete()` (apps/web/src/lib/scormExport.ts:1536) only swaps to pass/fail title+body when `completionCriteria==='passed'`, so 'completed'-criteria modules never show failure copy even at 0%. `buildPreviewHtml`'s completion card (scormExport.ts:1731-1742) has no pass/fail wiring at all — fully hardcoded, so Learner Preview never reflects fail state (this is what the user's screenshot shows). Also make the completion screen's title/body text authorable instead of hardcoded strings.

</domain>

<decisions>
## Implementation Decisions

### Fail-copy trigger scope
- Show fail-state title/body whenever the module has quiz blocks (`quizTotal > 0`) and `score < passingScore` — regardless of `completionCriteria`. Previously gated behind `criteria === 'passed'`; that gate is removed. `completionCriteria` still controls the SCORM `lesson_status` written (`completed` vs `passed`/`incomplete`) — only the on-screen copy trigger changes.

### Editable scope
- Authors can edit three text pairs (title + body): default/celebratory, pass, fail. Plain text, stored on the module, editable in the export dialog (or module settings, wherever `ExportOptions`/module-level settings currently live). Blank/unset falls back to the current hardcoded copy so existing modules are unaffected until an author opts in.

### Claude's Discretion
- Exact UI placement/layout of the new text fields in the export dialog.
- Whether to store these fields as part of `ExportOptions` (export-time) or as a module-level persisted field (so it round-trips without re-exporting) — plan should pick whichever matches how other module-level settings (e.g. passingScore, completionCriteria) are currently persisted, for consistency.
- Rich text vs. plain text for the body fields — default to plain text unless the codebase's existing pattern for similar short copy fields uses rich text.
- Whether the score row (`data-prism-score`, "You scored X% — C of N correct") also becomes editable — out of scope, leave as-is (already dynamic/correct).

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Wire the same title/body swap + authored overrides into BOTH `buildLessonPage` (SCORM export) and `buildPreviewHtml` (Learner Preview) so preview and the real export stay in parity — the bug report screenshot is the preview specifically having zero fail-state wiring.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above. See existing `data-pass-title`/`data-fail-title`/`data-pass-body`/`data-fail-body` attributes already present (but unused for 'completed' criteria and entirely absent from preview) at scormExport.ts:1460-1461 as the starting point.

</canonical_refs>

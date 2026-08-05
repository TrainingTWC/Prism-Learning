---
phase: quick-260730-gzv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - convex/modules.ts
  - apps/web/src/pages/ModuleListPage.tsx
autonomous: true
requirements:
  - QUICK-260730-gzv
must_haves:
  truths:
    - "Any member (owner or editor) of a module's current workspace can move that module to another workspace they also belong to."
    - "A member cannot move a module into a workspace they are not a member of (mutation rejects it server-side, not just hidden in the UI)."
    - "Moving a module to its own current workspace is rejected/no-op, not silently accepted as a wasted write."
    - "After a successful move, the module disappears from the source workspace's module list and appears in the destination workspace's module list (reactive, no manual refresh)."
    - "The dropdown menu on each module row exposes a 'Move to workspace' action alongside Rename/Duplicate/Delete, opening a picker of the user's OTHER workspaces."
  artifacts:
    - path: "convex/modules.ts"
      provides: "move mutation (moduleId, destinationWorkspaceId) - membership-gated on both source and destination, not owner-gated"
      contains: "export const move = mutation"
    - path: "apps/web/src/pages/ModuleListPage.tsx"
      provides: "Move to workspace dropdown item + workspace-picker modal wired to api.modules.move"
      contains: "api.modules.move"
  key_links:
    - from: "apps/web/src/pages/ModuleListPage.tsx"
      to: "convex/modules.ts move mutation"
      via: "useMutation(api.modules.move) called with { moduleId, destinationWorkspaceId }"
      pattern: "useMutation\\(api\\.modules\\.move\\)"
    - from: "apps/web/src/pages/ModuleListPage.tsx workspace picker"
      to: "convex/workspaces.ts listMine query"
      via: "useQuery(api.workspaces.listMine) filtered to exclude the current workspace"
      pattern: "api\\.workspaces\\.listMine"
---

<objective>
Add a "move module to workspace" feature: any member (owner or editor) of a module's current workspace can relocate that module into another workspace they also belong to. This is explicitly NOT an owner-only action - it follows the plain membership-check pattern already used by every other module mutation in `convex/modules.ts` (`requireMember`), not the owner-only pattern used elsewhere for workspace administration (`workspaces.rename`, `members.remove`/`invite`).

Purpose: authors on a small team occasionally build a module in the wrong workspace, or want to relocate a module as team structure shifts. There is currently no way to do this without manual DB surgery.
Output: a new `move` mutation in `convex/modules.ts`, and a "Move to workspace" item + destination picker in the module dropdown menu on `ModuleListPage.tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@convex/_generated/ai/guidelines.md

<interfaces>
convex/modules.ts - local helper reused by the new mutation, EVERY module mutation goes through this:
  async function requireMember(ctx, workspaceId): returns userId or throws 'Forbidden' / 'Unauthenticated'.
  Does NOT check role - 'owner' and 'editor' both pass. Reuse this SAME check for BOTH the source
  and destination workspace. Do NOT introduce an owner-only check (that pattern lives only in
  workspaces.ts/members.ts and is deliberately not used for modules).

convex/modules.ts - existing `rename` mutation is the closest analog to model `move` on:
  export const rename = mutation({
    args: { moduleId: v.id('modules'), title: v.string() },
    handler: async (ctx, { moduleId, title }) => {
      const mod = await ctx.db.get(moduleId);
      if (!mod || mod.deletedAt) throw new Error('Not found');
      const userId = await requireMember(ctx, mod.workspaceId);
      await ctx.db.patch(moduleId, {
        title: title.trim() || 'Untitled Module',
        updatedAt: Date.now(),
        lastEditedBy: userId,
      });
    },
  });

convex/workspaces.ts - reuse this query as-is for the destination picker, do NOT write a new query:
  export const listMine = query({
    args: {},
    handler: async (ctx) => { /* returns Array<Doc<'workspaces'> & { role: 'owner'|'editor' }> for the current user */ },
  });

convex/schema.ts modules table shape relevant here:
  modules: { workspaceId: Id<'workspaces'>, title, status, deletedAt?, updatedAt, lastEditedBy: Id<'users'>, ... }
  The `list` query (apps/web already subscribes via useQuery(api.modules.list, { workspaceId })) filters by
  workspaceId, so after `move` patches module.workspaceId, Convex's reactivity alone removes it from the
  source list and (once that workspace's ModuleListPage is open) adds it to the destination list. No extra
  client-side invalidation needed.

apps/web/src/pages/ModuleListPage.tsx - existing per-row dropdown menu pattern to extend (~lines 203-242):
  Menu is a local absolutely-positioned `<div className="glass ...">` shown when openMenuId === mod._id,
  closed on outside click via a wrapper onClick on the row. Each item is a `<button>` with a lucide icon
  + label, e.g. the existing Duplicate button:
    <button onClick={() => void handleDuplicate(mod._id as Id<'modules'>)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]">
      <Copy className="size-3.5" /> Duplicate
    </button>

apps/web/src/components/ImportQuizDialog.tsx - closest existing full-overlay modal pattern in this codebase
to model the destination-picker modal on (there is no shared Dialog/Modal component - every "dialog" here
is a hand-rolled overlay div):
  Outer: <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
           <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"> ...header with title + X close button... </div>
         </div>
  Error surfacing pattern: catch (e: unknown) block reads (e as { data?: string; message?: string }).data
  ?? message ?? a fallback string, and stores it in an error state variable rendered near the top of the panel.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add membership-gated move mutation to convex/modules.ts</name>
  <files>convex/modules.ts</files>
  <action>
Add a new exported `move` mutation to convex/modules.ts, placed after `rename` (near the other single-field module mutations). Model it directly on `rename`'s structure:

- Args: moduleId (v.id('modules')) and destinationWorkspaceId (v.id('workspaces')).
- Load the module via ctx.db.get(moduleId); throw 'Not found' if missing or soft-deleted (mod.deletedAt set) - same guard `rename` uses.
- Call requireMember(ctx, mod.workspaceId) to authorize the caller against the SOURCE workspace and capture the returned userId. Do not add any mod.ownerId/ws.ownerId check anywhere in this mutation - there is no ownerId on modules, and per the explicit product requirement this is a membership action, not an owner action.
- If destinationWorkspaceId === mod.workspaceId, throw a new Error('Module is already in that workspace') - reject the no-op move rather than silently succeeding.
- Call requireMember(ctx, destinationWorkspaceId) to authorize the caller against the DESTINATION workspace (this is what prevents moving a module into a workspace the caller doesn't belong to - it throws 'Forbidden' via the existing helper if they aren't a member there, regardless of role).
- Patch the module: workspaceId set to destinationWorkspaceId, updatedAt set to Date.now(), lastEditedBy set to userId - same convention `rename` uses.
- No return value needed (matches rename's void return).

Do not touch any other mutation in this file, and do not add a role parameter or role check anywhere.
  </action>
  <verify>
    <automated>grep -q "export const move = mutation" convex/modules.ts && grep -q "destinationWorkspaceId" convex/modules.ts && ! grep -E "mod\.ownerId|ws\.ownerId" convex/modules.ts && npx tsc -p convex --noEmit</automated>
  </verify>
  <done>move mutation exists in convex/modules.ts, checks membership (via requireMember) on BOTH mod.workspaceId and destinationWorkspaceId, rejects a same-workspace move, patches workspaceId/updatedAt/lastEditedBy, contains no owner-only gating, and the Convex functions typecheck.</done>
</task>

<task type="auto">
  <name>Task 2: Add Move to workspace dropdown item and destination picker to ModuleListPage</name>
  <files>apps/web/src/pages/ModuleListPage.tsx</files>
  <action>
Extend ModuleListPage.tsx to expose the move feature end-to-end, following the file's existing state-handling style (local useState, no external form/dialog library):

1. Wire the data/mutation hooks: add `const myWorkspaces = useQuery(api.workspaces.listMine);` (reuse the existing query, do not write a new one) and `const moveModule = useMutation(api.modules.move);`. Add state: movingModuleId (Id<'modules'> | null, default null), moveError (string | null, default null), moving (boolean, default false).

2. In the per-row dropdown menu (~lines 212-241), add a "Move to workspace" button between Duplicate and the hr/Delete section. Import an additional lucide icon for it (e.g. FolderInput) alongside the existing icon imports. On click: set movingModuleId to mod._id, close the menu (setOpenMenuId(null)), clear moveError - same style as the existing Duplicate/Delete handlers.

3. Add a small overlay picker modal rendered once near the bottom of the component's return (sibling to the module list, still inside PrismWorkspaceShell), shown when movingModuleId !== null. Model the overlay markup on ImportQuizDialog's outer wrapper (fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 containing a rounded-2xl bg-white shadow-2xl panel - use a narrower max-width than the 2xl import dialog since this is just a list, e.g. max-w-sm). Contents:
   - Header: "Move module to workspace" plus an X close button that resets movingModuleId and moveError to null (same close pattern as ImportQuizDialog's onClose).
   - Body: compute destinations as myWorkspaces filtered to exclude the workspace whose id equals wsId (every module on this page belongs to wsId, so the exclusion is the same regardless of which module was clicked). Render one row/button per destination workspace showing its name; clicking it calls an async handler with that workspace's id.
   - Handle the loading state (myWorkspaces === undefined) and the empty-destinations state (destinations.length === 0, e.g. "You're not a member of any other workspace yet.").
   - If moveError is set, render it in a small danger-colored text block above or below the list.

4. Add an async handler handleMove(destinationWorkspaceId: Id<'workspaces'>): guard on movingModuleId being non-null, set moving true and moveError null, call moveModule with { moduleId: movingModuleId, destinationWorkspaceId } inside a try block, on success reset movingModuleId to null, on catch extract (e as { data?: string; message?: string }).data ?? message ?? a fallback string into moveError (mirrors the pattern already used in ImportQuizDialog.tsx), and in a finally block set moving back to false. Disable destination buttons while moving is true to prevent double-submit.

Do not add a role hierarchy, do not restrict the destination list to workspaces the user owns, and do not touch the Rename/Duplicate/Delete handlers.
  </action>
  <verify>
    <automated>grep -q "api.modules.move" apps/web/src/pages/ModuleListPage.tsx && grep -q "api.workspaces.listMine" apps/web/src/pages/ModuleListPage.tsx && grep -q "movingModuleId" apps/web/src/pages/ModuleListPage.tsx && grep -q "Move to workspace" apps/web/src/pages/ModuleListPage.tsx && cd apps/web && npx tsc -b --noEmit</automated>
  </verify>
  <done>ModuleListPage.tsx has a "Move to workspace" dropdown item that opens a picker modal listing the user's other workspaces (via api.workspaces.listMine, excluding the current workspace), selecting one calls api.modules.move with the module id and destination, errors surface inline, and the web app typechecks.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|--------------|
| Browser client -> Convex `modules.move` mutation | Untrusted args: `moduleId`, `destinationWorkspaceId`. Caller identity comes from the authenticated Convex session (`getAuthUserId`), not from client-supplied fields. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|--------------|------------------|
| T-260730-01 | Tampering | `modules.move` destinationWorkspaceId arg | mitigate | `requireMember(ctx, destinationWorkspaceId)` rejects the move with `Forbidden` unless the authenticated caller has a membership row for that workspace - a client cannot move a module into a workspace it does not belong to regardless of what id it sends. |
| T-260730-02 | Elevation of Privilege | `modules.move` moduleId arg | mitigate | `requireMember(ctx, mod.workspaceId)` re-derives authorization from the module's actual current workspace (not a client-asserted one) before any patch happens, matching the existing pattern used by every other module mutation in this file. |
| T-260730-03 | Repudiation | `modules.move` patch | accept | `lastEditedBy`/`updatedAt` record who performed the move, same audit trail every other module mutation already provides. No dedicated move-history log; low risk for a small internal team tool. |
| T-260730-04 | Information Disclosure | destination-workspace picker (UI) | accept | The picker only lists workspaces returned by `workspaces.listMine`, which is already scoped server-side to the caller's own memberships - no workspace names/ids the user doesn't already have access to are exposed. |
</threat_model>

<verification>
- `npx tsc -p convex --noEmit` passes (Convex functions typecheck).
- `npx tsc -b --noEmit` passes for apps/web (web app typechecks).
- `convex/modules.ts` contains `export const move = mutation` gated by `requireMember` on both `mod.workspaceId` and `destinationWorkspaceId`, with no `ownerId`-based check.
- `apps/web/src/pages/ModuleListPage.tsx` contains a "Move to workspace" dropdown item and a picker modal wired to `api.modules.move` and `api.workspaces.listMine`.
</verification>

<success_criteria>
- Any member (owner or editor) of a module's workspace can move it to any other workspace they belong to, via the UI.
- The mutation independently re-validates membership on both source and destination workspaces server-side - it does not trust client-side filtering alone.
- Moving to the module's current workspace is rejected with a clear error.
- No owner-only restriction was introduced anywhere in this change.
</success_criteria>

<output>
Create `.planning/quick/260730-gzv-add-move-module-to-workspace-feature-con/260730-gzv-SUMMARY.md` when done
</output>

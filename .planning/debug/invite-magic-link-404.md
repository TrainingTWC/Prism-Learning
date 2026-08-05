---
status: awaiting_human_verify
trigger: "Invite member magic link doesn't work: clicking the invite email's magic link routes to a 404 / page not found instead of joining the workspace"
created: 2026-07-09
updated: 2026-07-09
slug: invite-magic-link-404
---

# Debug Session: Invite Member Magic Link → 404

## Symptoms

- **Expected**: A user invited to a workspace (via the Members panel invite-by-email flow, AUTH-03 per Phase 1) receives an email with a magic link; clicking it signs them in and lands them in the invited workspace as a member.
- **Actual**: Clicking the magic link results in a 404 / page not found.
- **Error messages**: 404 / page not found (browser-level, not an app-rendered error page as far as reported).
- **Timeline**: Not yet established — unknown if this ever worked or is a recent regression.
- **Reproduction**: Invite a new member by email from a workspace's Members panel, open the invite email, click the magic link.

---

## Current Focus

```
hypothesis: |
  TWO independent bugs both contribute to the reported symptom, confirmed by
  a second investigation pass over this same session's evidence:

  (A) CONFIRMED (previous pass) — Cloudflare Pages was not honoring
  apps/web/public/_redirects for the deployed site, so /sign-in (and any
  deep link) 404'd at the edge before the SPA loaded at all. Fixed via a
  404.html fallback build plugin (see Resolution, files_changed).

  (B) NEWLY CONFIRMED (this pass) — Even once (A) is fixed and the SPA shell
  loads for a /sign-in deep link, the workspace-invite email link
  (`/sign-in?inviteId=...&email=...`, built in convex/members.ts) is not a
  real Convex Auth magic link at all — it carries no verification token.
  apps/web/src/pages/SignInPage.tsx only auto-completes sign-in for the real
  `?code=` token produced by convex/auth.ts's Email provider; it had zero
  logic for `inviteId`/`email`. So even with (A) fixed, an invited user would
  land on the plain manual sign-in form (email + EMPID + company code +
  password) with no way to proceed, since acceptPendingInvites (which grants
  membership by email match) only runs after the user is already
  authenticated. Fixed by making SignInPage detect an invite visit and
  auto-trigger a real magic-link send for the invited email.
test: |
  (A) curl -I https://learning.prismintelligence.in/  -> 200 (root, physical index.html)
      curl -I https://learning.prismintelligence.in/sign-in -> 404 (real edge 404, not app 404)
      curl -I https://learning.prismintelligence.in/sign-in?code=abc -> 404
  (B) grep across apps/web/src for "inviteId" -> only match is MembersPage.tsx's
      unrelated handleRevoke; SignInPage.tsx had no reference to inviteId/email
      search params at all before this pass's fix.
      `npx tsc -b` in apps/web after the SignInPage.tsx fix -> passes clean (no output/errors).
expecting: |
  (A) If _redirects were honored, /sign-in would return 200 with index.html body. It did not — root cause A confirmed.
  (B) If inviteId/email were consumed anywhere, grep would show a reference beyond the revoke button. It did not — root cause B confirmed.
next_action: |
  Both fixes applied (see Resolution, files_changed). Awaiting human
  verification: (1) redeploy and confirm https://learning.prismintelligence.in/sign-in
  no longer edge-404s, (2) full end-to-end retest — invite a member, click the
  emailed link, confirm it auto-sends a real magic link, click that link, and
  confirm the user signs in and is added to the workspace.
reasoning_checkpoint_A:
  hypothesis: "Cloudflare Pages is not applying the SPA-fallback _redirects rule for this deployment, so deep-linked routes (including the invite/magic-link email target /sign-in) 404 at the edge before the SPA ever loads."
  (`/* /index.html 200`) for the deployed site, so ANY deep-link URL that
  isn't a physical build artifact (e.g. /sign-in, which is what both the
  invite email and the magic-link email point to) returns a real HTTP 404
  from Cloudflare's edge instead of falling back to index.html so the
  client-side TanStack Router can render it. This is a routing/deploy-config
  bug, not an app-logic bug — the route IS registered correctly in
  router.tsx and the invite/magic-link email templates ARE correct.
test: |
  curl -I https://learning.prismintelligence.in/  -> 200 (root, physical index.html)
  curl -I https://learning.prismintelligence.in/sign-in -> 404 (real edge 404, not app 404)
  curl -I https://learning.prismintelligence.in/sign-in?code=abc -> 404
  Confirmed apps/web/public/_redirects is well-formed ASCII, LF, `/* /index.html 200`,
  and correctly copied into apps/web/dist/_redirects by `vite build` locally.
expecting: |
  If _redirects were honored, /sign-in would return 200 with index.html body
  (same as root). It does not — root cause confirmed.
next_action: Fix applied — see Resolution. Awaiting human verification of live deploy.
reasoning_checkpoint:
  hypothesis: "Cloudflare Pages is not applying the SPA-fallback _redirects rule for this deployment, so deep-linked routes (including the invite/magic-link email target /sign-in) 404 at the edge before the SPA ever loads."
  confirming_evidence:
    - "curl https://learning.prismintelligence.in/ -> HTTP 200, serves built index.html with current asset hashes."
    - "curl https://learning.prismintelligence.in/sign-in -> HTTP 200 expected (same SPA shell) but got real HTTP 404 with empty body and none of the 200 response's caching/X-Robots-Tag headers -- i.e. Cloudflare's own not-found handler, not the app's."
    - "apps/web/public/_redirects contains exactly `/* /index.html 200`, ASCII/LF, and is correctly emitted to apps/web/dist/_redirects by a local `vite build` -- so the source of truth is correct; the deployed edge is not applying it."
    - "router.tsx registers `/sign-in` as a real route (signInRoute), and both auth.ts (magic link `?code=`) and members.ts (invite `?inviteId=&email=`) point to `${SITE_URL}/sign-in?...` -- so the app-side URL construction and routing are correct; only the edge-level fallback is missing/broken."
  falsification_test: "If /sign-in still 404s after redeploying with a 404.html fallback added to the output directory (belt-and-suspenders for _redirects), the root cause would be something else (e.g. Pages project root/output-directory misconfiguration not fixable from repo code) -- would need dashboard-level investigation."
  fix_rationale: "Cloudflare Pages honors a static 404.html at the output root as an SPA fallback independent of whether _redirects is being applied (e.g. due to project root-directory/output-directory settings in the dashboard, caching, or _redirects not being deployed from a stale build). Copying the built index.html to 404.html after every `vite build` gives a fallback that doesn't depend on _redirects parsing at all, since Cloudflare serves 404.html verbatim (200 status doesn't matter for SPA purposes -- JS still executes and TanStack Router renders the right page client-side)."
  blind_spots: "Cannot access the Cloudflare Pages dashboard project settings (root directory / build output directory) directly -- if those are misconfigured such that dist/404.html also doesn't reach the deployed output, this fix won't take effect until a dashboard-level check is also done. Also have not been able to trigger an actual redeploy+re-test in this session; verification requires the next deploy to run and a human/checkpoint re-test of the live URL."
reasoning_checkpoint_B:
  hypothesis: >
    The workspace-invite email link is not a real Convex Auth magic link.
    convex/members.ts's `invite` action builds
    `${siteUrl}/sign-in?inviteId=<pendingInvites id>&email=<email>` — a raw
    pendingInvite document id and email as plain query params — instead of
    reusing Convex Auth's Email provider (convex/auth.ts), which builds real
    working links as `${siteUrl}/sign-in?code=<token>`. SignInPage.tsx only
    recognized `?code=` (auto-completed via ConvexAuthProvider); it had no
    logic for `inviteId`/`email`, so clicking the invite link (once edge-404
    bug A is fixed) would just load the plain manual sign-in form, which an
    externally invited, non-employee user cannot complete, since
    acceptPendingInvites only runs after the user is already authenticated.
  confirming_evidence:
    - "convex/members.ts:121-122 — inviteLink = `${siteUrl}/sign-in?inviteId=${inviteId}&email=${encodeURIComponent(normalizedEmail)}` (no auth token at all)"
    - "convex/auth.ts:24-26 — the ONLY real magic-link mechanism in the app builds `${siteUrl}/sign-in?code=${token}` via Convex Auth's Email provider sendVerificationRequest"
    - "apps/web/src/pages/SignInPage.tsx (pre-fix) line 27 — hasCode only checked for `code=` substring; grep confirmed no code anywhere read `inviteId` or the invite `email` search param"
    - "acceptPendingInvites (convex/members.ts:204) is only invoked from AppLayout.tsx:25 AFTER isAuthenticated is already true — nothing bridged the invite link to producing that authenticated state"
    - "convex/schema.ts memberships + convex/members.ts:204-254 confirm acceptPendingInvites grants membership purely by email match, independent of employeeId/companyCode — so the employee-login gate is not actually required for invited members"
  falsification_test: >
    If inviteId/email params were read anywhere (a route loader, a useEffect
    keyed on search.inviteId) this hypothesis would be false. Grep across
    apps/web/src for "inviteId" found it only in MembersPage.tsx's
    handleRevoke (unrelated — revoking an invite, not consuming one) —
    confirms no consumption path existed before this fix.
  fix_rationale: >
    Root cause is that the invite link carried no real authentication token
    and nothing in the frontend acted on its params. Fix: SignInPage now
    detects the inviteId+email params on load, prefills the email, skips the
    EMPID/company-code gate (irrelevant per the acceptPendingInvites
    evidence above), and immediately calls signIn('email', { email }) to
    trigger Convex Auth's real magic-link send for that address — reusing
    the already-working code=token flow instead of the dead custom one.
  blind_spots: >
    This still requires two email round trips (click invite link -> auto
    trigger -> user must open a SECOND email with the real code= link) since
    there's no way to complete auth synchronously from a GET-style email
    click without a token. This is a UX tradeoff, not a correctness gap: the
    flow now actually completes end-to-end, whereas before it dead-ended.
    Also could not exercise this against a live deployment/real inbox in
    this session — verified via source reading, grep, and typecheck only.
```

---

## Evidence

- timestamp: 2026-07-09T00:10:00Z
  checked: convex/members.ts (invite action, lines 98-168) and convex/auth.ts (Email provider, lines 19-73)
  found: >
    invite action builds `inviteLink = ${siteUrl}/sign-in?inviteId=${inviteId}&email=${encodeURIComponent(normalizedEmail)}`
    (members.ts:121-122) — a raw pendingInvites document id, NOT a Convex Auth
    verification token. The app's only real, working magic-link mechanism is
    auth.ts's Email provider sendVerificationRequest, which builds
    `${siteUrl}/sign-in?code=${token}` (auth.ts:24-26) and is auto-consumed by
    ConvexAuthProvider client-side.
  implication: The invite email link and the real magic-link mechanism were two unrelated, non-interoperable code paths.

- timestamp: 2026-07-09T00:10:01Z
  checked: apps/web/src/pages/SignInPage.tsx (full file, pre-fix) and grep for "inviteId" across apps/web/src
  found: >
    SignInPage only branched on `window.location.search.includes('code=')`
    to short-circuit into the "completing" step. No code anywhere in
    apps/web/src read `inviteId` or acted on the invite email/param pair.
    `acceptPendingInvites` (convex/members.ts:204) — the mutation that
    actually grants membership by matching the signed-in user's email against
    pendingInvites rows — is only invoked from AppLayout.tsx:25, gated on
    `isAuthenticated` already being true.
  implication: >
    Clicking the invite link (even with the edge-404 bug fixed) could not
    authenticate the invited user by itself; it just opened the ordinary
    manual sign-in form (email + EMPID + company code + password), which a
    new external invitee cannot fill in, so they never reached the
    authenticated state that would trigger acceptPendingInvites. The invite
    link was effectively dead even after an edge-404 fix.

- timestamp: 2026-07-09T00:10:02Z
  checked: convex/schema.ts (memberships table) and convex/members.ts (acceptPendingInvites, lines 204-254)
  found: "membership role is granted purely by email match against pendingInvites rows after any successful auth — no employeeId/companyCode check anywhere in this path."
  implication: The EMPID/company-code employee-login gate in SignInPage's manual form is irrelevant/unnecessary for invited members, safe to bypass for the invite-link flow.

- timestamp: 2026-07-09T00:10:03Z
  checked: "`npx tsc -b` in apps/web after editing SignInPage.tsx"
  found: "Clean pass, no type errors."
  implication: The SignInPage.tsx fix (detect invite visit, prefill email, auto-call signIn('email', { email })) compiles correctly and doesn't break existing types.

---

## Eliminated Hypotheses

- hypothesis: The magic link's target route (`/sign-in`) is missing from the TanStack Router route tree.
  evidence: "router.tsx registers `/sign-in` as a top-level route under rootRoute (lines 32-36) — present and correctly configured; the router itself was never the problem."
  timestamp: 2026-07-09T00:10:00Z

---

## Resolution

root_cause: |
  TWO independent, compounding root causes:

  (A) The invite email and magic-link email both correctly point to
  `${SITE_URL}/sign-in?...`, and `/sign-in` is correctly registered in
  router.tsx. However, the deployed Cloudflare Pages site was not honoring
  `apps/web/public/_redirects` (`/* /index.html 200`) — confirmed via curl:
  root `/` returns 200 (physical index.html) but `/sign-in` and
  `/sign-in?code=...` returned a genuine Cloudflare edge 404 (empty body, no
  app-level headers), rather than falling back to index.html so the
  client-side TanStack Router can render the page. This means ANY deep link
  into the SPA — not just invite/magic-link emails — 404'd when opened
  directly (fresh navigation / email client), since only navigations that
  originate from within the already-loaded SPA (client-side routing) worked.

  (B) Independently, even once (A) is fixed, the workspace-invite email link
  (convex/members.ts `invite` action) was never a real Convex Auth magic
  link — it built `${siteUrl}/sign-in?inviteId=<pendingInvites id>&email=<email>`,
  carrying no verification token, only a raw DB row id. SignInPage.tsx had no
  code path reading `inviteId`/`email`; it only auto-completed sign-in for
  the real `?code=` token from convex/auth.ts's Email provider. So an
  invited user clicking the link would land on the plain manual sign-in form
  (email + EMPID + company code + password) with no way to proceed, since
  `acceptPendingInvites` (which grants membership by email match) only runs
  after the user is already authenticated — which this dead link could never
  produce.

fix: |
  (A) Added a Vite build plugin (`spaFallback404` in apps/web/vite.config.ts)
  that copies the built `index.html` to `404.html` in the output directory
  after every `vite build` (via the `closeBundle` hook). Cloudflare Pages
  serves a static `404.html` from the output root as an SPA fallback
  independent of whether `_redirects` is being applied. Kept the existing
  `_redirects` file as well — belt-and-suspenders.

  (B) Updated apps/web/src/pages/SignInPage.tsx to detect an invite visit
  (`inviteId` + `email` search params present, and no `code=`), prefill the
  email field, skip the EMPID/company-code employee-login gate (confirmed
  unnecessary for invited members — acceptPendingInvites grants membership
  purely by email match), and automatically call `signIn('email', { email })`
  on mount to trigger Convex Auth's real magic-link send for the invited
  address. Added a `sending-invite` step ("Preparing your invite…") shown
  while that call is in flight, then transitions to the existing `sent`
  ("Check your email") step. This reuses the already-correct `?code=` flow
  instead of the dead custom `inviteId` link.

verification: |
  (A) Self-verified: `pnpm --filter @prism/web run build` now emits
  `apps/web/dist/404.html` identical to `apps/web/dist/index.html`
  (confirmed via `diff` — byte-identical). Cannot fully verify the live fix
  from this session since it requires a real deploy.

  (B) Self-verified: `npx tsc -b` in apps/web passes clean after the
  SignInPage.tsx change (no type errors). Verified via source reading + grep
  that acceptPendingInvites does not require employeeId/companyCode, so
  bypassing that gate for invite visits is safe. Could not exercise a live
  end-to-end email round trip in this session.

  Both (A) and (B) require a human/checkpoint re-test after the next deploy:
  1. Confirm https://learning.prismintelligence.in/sign-in no longer edge-404s.
  2. Invite a new member by email from a workspace's Members panel.
  3. Open the invite email, click the link — should land on "Preparing your
     invite…" then "Check your email" (NOT the manual EMPID/password form).
  4. Open the SECOND email (the real magic-link `?code=` email) and click it.
  5. Confirm the user is signed in and added to the invited workspace
     (AppLayout's "You've been added to <workspace>" toast should appear).

files_changed:
  - apps/web/vite.config.ts
  - apps/web/src/pages/SignInPage.tsx

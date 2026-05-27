# Pitfalls Research

**Domain:** Rise-360-style block-based learning module authoring tool with SCORM 1.2 export, realtime collab, Cloudflare edge stack, Convex backend
**Researched:** 2026-05-27
**Confidence:** HIGH for SCORM/Tiptap/Cloudflare specifics (well-documented, stable specs); MEDIUM for Convex-specific limits (evolving platform — verify against current docs at plan time)

---

## Critical Pitfalls

### Pitfall 1: SCORM `API` discovery scans the wrong window tree

**What goes wrong:**
The exported package can't find the LMS `API` object, so calls to track progress/score silently no-op. Learners complete the module; the LMS records nothing. Looks fine in preview, fails in production.

**Why it happens:**
SCORM 1.2 spec mandates a specific discovery algorithm: walk `window.parent` up to a configurable depth (commonly 7) looking for `window.API` (note: SCORM 1.2 = `API`; SCORM 2004 = `API_1484_11` — easy to confuse), then walk `window.opener.parent` chain. Naive implementations check `window.parent.API` once and give up. Some LMSs (Moodle, Cornerstone) nest the content iframe 3–5 levels deep.

**How to avoid:**
- Implement the **full pilfer algorithm** verbatim from SCORM 1.2 RTE spec §3.3.6.1 — bidirectional parent + opener walk, depth limit, try/catch around every cross-frame access (same-origin policy will throw).
- Use a reference implementation: pipwerks `SCORM_API_wrapper.js` (BSD, ~1KB minified) — battle-tested across 100+ LMSs. Do not roll your own.
- Log discovery attempts in dev mode so authors can see which `window` level the API was found at.

**Warning signs:**
- Works in SCORM Cloud (which exposes API at `window.parent.API`) but fails in customer LMS.
- `LMSInitialize` returns `"false"` but no console errors (wrapper swallowed them).

**Phase to address:** SCORM Export phase. Add a runtime test that loads the exported zip into SCORM Cloud (free tier, scriptable API) as a verification step.

---

### Pitfall 2: Missing `LMSCommit` / `LMSFinish` calls — progress lost on close

**What goes wrong:**
Learner completes a quiz, closes the tab. LMS shows 0% complete. The data was `LMSSetValue`'d but never persisted because the spec requires an explicit `LMSCommit` and a final `LMSFinish`.

**Why it happens:**
SCORM 1.2 has no auto-commit. `LMSSetValue` only updates the LMS's in-memory buffer. Developers assume "the LMS handles it." Worse: `beforeunload` is unreliable on mobile and inside some LMS iframes that suppress it.

**How to avoid:**
- Call `LMSCommit("")` after every meaningful state change (quiz answered, lesson completed, score updated) — not just on unload.
- Call `LMSFinish("")` on `pagehide` (more reliable than `beforeunload` on iOS/mobile LMSs) AND on `visibilitychange → hidden` as a backup.
- Wrap state mutations in a debounced commit (500ms) to batch rapid changes.
- Never assume `LMSCommit` succeeded — it returns `"true"`/`"false"` as a **string**, not a bool. Check `result === "true"`.

**Warning signs:**
- Score shows in player preview but not LMS gradebook.
- Refreshing mid-lesson loses progress.
- Mobile learners report missing completions more than desktop.

**Phase to address:** SCORM Export phase — include a "lifecycle smoke test" that opens the package, sets a value, closes tab via `pagehide`, reopens, and verifies the value persisted.

---

### Pitfall 3: `cmi.core.lesson_status` enum confusion (passed/failed/completed/incomplete)

**What goes wrong:**
LMS gradebook shows "Incomplete" forever, or marks everyone "Passed" regardless of score, or rejects the value entirely.

**Why it happens:**
SCORM 1.2 has **two independent completion models** and devs mix them:
- **No mastery score declared** in manifest → use `completed` / `incomplete` / `browsed` / `not attempted`. Setting `passed`/`failed` is a spec violation.
- **Mastery score declared** → LMS expects `passed` / `failed` based on `cmi.core.score.raw` vs `cmi.core.score.min/max`. Setting `completed` won't trigger pass logic in many LMSs.

Also: setting `lesson_status = "completed"` does NOT auto-set `cmi.core.exit = ""` — some LMSs require both.

**How to avoid:**
- Pick one model per module type and document it: quiz modules → mastery score + passed/failed; informational modules → completed/incomplete.
- Always set `cmi.core.score.raw`, `score.min` (0), `score.max` (100) **before** setting `lesson_status` (some LMSs evaluate in order).
- Always set `cmi.core.exit = ""` on `LMSFinish` for a "session done, allow resume" semantic, or `"suspend"` for "save state, resume later."
- Validate against SCORM Cloud — it strictly enforces the spec and will flag mismatches.

**Warning signs:**
- "Works in Moodle but not in Cornerstone" type bug reports.
- Gradebook shows score but status is "In Progress."

**Phase to address:** SCORM Export phase. Make `lesson_status` a deliberate choice in the manifest builder, not a string literal in code.

---

### Pitfall 4: Score reported in raw points instead of 0–100

**What goes wrong:**
3-question quiz, learner gets 2 right. Module reports `score.raw = 2`. LMS gradebook shows "2%". Or the mastery score is 80, so the LMS marks it failed.

**Why it happens:**
SCORM 1.2 spec says `score.raw` is "a number between `score.min` and `score.max`." Developers default min=0, max=100, then forget to normalize and pass `correctCount` directly. Or they set max=questionCount and many LMSs ignore min/max and assume 0–100.

**How to avoid:**
- **Always normalize to 0–100** before calling `LMSSetValue("cmi.core.score.raw", value)`. Treat min/max as informational only.
- Encode this in a single helper: `reportScore(correct, total) → LMSSetValue("cmi.core.score.raw", Math.round((correct/total)*100))`.
- Document and test against at least 3 LMSs (SCORM Cloud, Moodle, one commercial) — they disagree on min/max handling.

**Warning signs:**
- Learners report "I got everything right but it says I failed."
- Gradebook values look like raw counts, not percentages.

**Phase to address:** Quiz Block + SCORM Export phase. One score-reporting utility, used everywhere.

---

### Pitfall 5: Invalid `imsmanifest.xml` — package rejected at upload

**What goes wrong:**
LMS upload returns "Invalid package" with no useful error. Or it accepts the package but the launch button does nothing.

**Why it happens:**
SCORM 1.2 manifest requires specific schema (`adlcp_rootv1p2.xsd`, `imscp_rootv1p1p2.xsd`, `imsmd_rootv1p2p1.xsd`) and:
- `<schema>ADL SCORM</schema>` and `<schemaversion>1.2</schemaversion>` must match exactly (case-sensitive).
- `identifier` attributes must be unique XML NCNames (no spaces, can't start with a digit).
- All files referenced in `<resources>` must exist at the declared href, **case-sensitive** (breaks on Linux LMSs even if it works locally on Windows/Mac).
- Manifest must be at zip root, named exactly `imsmanifest.xml`.

**How to avoid:**
- Use a known-good manifest template; mutate only the title, identifier, and resource list.
- Validate every generated package against the official ADL XSDs in CI (use `libxml2` / `xmllint` in a Worker or a Convex action).
- Run packages through SCORM Cloud's free Test Track API as part of export verification.
- Lowercase all file paths in the zip; never rely on case-sensitivity matching.
- Use ASCII-only filenames in zip entries (some LMSs choke on UTF-8 zip headers — use ZIP 2.0, not ZIP64).

**Warning signs:**
- Package opens in one LMS but not another.
- Validator complains about "missing referenced file" but the file exists.

**Phase to address:** SCORM Export phase — validation must be a gate, not a manual step.

---

### Pitfall 6: Tiptap + Convex without Y.js → silent overwrites and cursor jumping

**What goes wrong:**
Author A types "Hello" while Author B types "World" in the same paragraph. Result is "Hello" OR "World" — not a merge. Cursors jump to the start of the doc on every remote update. Undo history rewinds across both users' edits and corrupts state.

**Why it happens:**
Tiptap (ProseMirror) is designed for **operational-transform or CRDT** based collab. Without Y.js (or similar), naive "store doc JSON in Convex, subscribe, replace on change" patterns:
- Replace the entire ProseMirror state, destroying selection + history.
- Last-writer-wins at document granularity, not field granularity.
- Cause feedback loops (your own write triggers a subscribe → re-set → cursor jump).

**How to avoid:**
- **Strongly recommended:** use Y.js with the Tiptap Collaboration extension. Persist Y.js updates as binary blobs in Convex; broadcast via Convex subscriptions. Y.js handles CRDT merge, presence, and undo per-user. This is the path of least resistance — fight it later if needed, not now.
- If avoiding Y.js: scope writes to the smallest possible unit (per-block, not per-lesson) AND use Convex transactions to do read-modify-write on a block-level version counter. Accept that two authors editing the same block will conflict — UX should show "X is editing this block" presence and discourage simultaneous edits.
- Never set the whole editor doc from a remote subscription — apply transactions instead, and skip echoes (don't apply your own writes coming back from the subscription).
- Use a separate undo stack per user (Y.js does this; manual impls usually don't).

**Warning signs:**
- "My text disappeared" reports.
- Cursor jumps to position 0 when collaborator types.
- Undo undoes someone else's edits.
- Lost keystrokes during fast typing.

**Phase to address:** Realtime Collab phase — make the Y.js vs. block-level-LWW decision **before** building blocks. Retrofitting Y.js after the fact is painful.

---

### Pitfall 7: Presence flooding — every keystroke triggers a Convex mutation

**What goes wrong:**
Authoring feels laggy. Convex function call count explodes (free tier exhausted in days). Cursor positions update at 60fps and saturate the websocket.

**Why it happens:**
Naive "broadcast my cursor position on every selectionchange" → 30–60 events/sec/user. Convex mutations are persisted writes — not designed for ephemeral high-frequency signals.

**How to avoid:**
- Throttle cursor/presence updates to ~5–10Hz on the client (`requestAnimationFrame` + last-value gate, or `lodash.throttle`).
- Store presence in a **separate ephemeral table** with short TTL (e.g., a `presence` table with `lastSeenAt` and a periodic cleanup mutation), not on the module document.
- For Y.js: use the y-protocols awareness channel — designed for this, doesn't hit the DB.
- Disable presence updates when the tab is `hidden` (`document.visibilityState`).

**Warning signs:**
- Convex usage dashboard shows mutation count >>  expected.
- Editor feels sluggish when 2+ users are active.

**Phase to address:** Realtime Collab phase — establish presence channel as the first thing built, before anyone wires it to cursor events.

---

### Pitfall 8: Orphaned R2 uploads — pay for blobs nobody references

**What goes wrong:**
Author uploads an image, abandons the block before saving, uploads another. Both blobs sit in R2 forever. Over time R2 fills with unused assets; storage bill grows.

**Why it happens:**
Two common patterns both leak:
1. **Upload-then-link:** client uploads to R2 (signed URL), gets back a key, then writes the key to Convex. If they navigate away before the second write, the blob is orphaned.
2. **Save-then-upload:** Convex has the reference but R2 upload fails partway → broken reference.

**How to avoid:**
- Use a **two-phase upload with reaper**:
  1. Client requests signed upload URL → server creates a row in `pending_uploads` table with `key`, `userId`, `createdAt`, `expectedSize`, `expectedMime`.
  2. Client uploads to R2.
  3. Client calls `commitUpload(key)` mutation → moves row from `pending_uploads` to `assets` and links to the owning block.
  4. **Cron job (Convex scheduled function)** runs hourly: any `pending_uploads` older than 1h → delete from R2 + drop the row.
- Also add a **garbage collector for de-referenced assets**: scheduled function walks `assets` table, deletes any with no incoming references older than N days (with soft-delete grace period for undo).
- Always set R2 object metadata (`userId`, `moduleId`) at upload time so the reaper can audit ownership.

**Warning signs:**
- R2 object count grows faster than module count.
- Audit query "assets with no references" returns >0.

**Phase to address:** Asset Pipeline phase. The reaper is not optional — build it with the upload flow.

---

### Pitfall 9: Missing MIME / size / magic-byte validation on upload

**What goes wrong:**
Author "uploads an image" that's actually a 2GB executable or an HTML file with `<script>` tags. Served back via signed URL, it executes in the LMS iframe context. Or a 500MB Lottie JSON kills the editor.

**Why it happens:**
Trusting `file.type` from the browser (client-controlled), or only checking the extension. Signed-PUT URLs to R2 don't validate content.

**How to avoid:**
- Validate **client AND server**:
  - Client: check file size, extension, and MIME before requesting the signed URL (UX feedback).
  - Server (Convex action or Worker): on `commitUpload`, fetch the first 16 bytes from R2 with a range request, check magic bytes (PNG `89 50 4E 47`, JPEG `FF D8 FF`, JSON `7B`/`5B` for Lottie, etc.) — reject and delete if mismatched.
- Hard size caps **enforced via signed URL constraints**: include `Content-Length` constraint in the presigned PUT policy; R2 will reject oversize uploads at the edge. Suggested caps: images 10MB, Lottie JSON 2MB, no executables ever.
- Use a strict **MIME allowlist**, not blocklist: `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml` (with SVG sanitization!), `application/json` (Lottie).
- **Sanitize SVG** (DOMPurify in a Worker) — SVG can carry `<script>` and event handlers. Or refuse SVG entirely in v1.
- Serve assets from a **dedicated subdomain** (e.g., `assets.learnflow.app`) with `Content-Disposition: attachment` for non-image types so they can't run in the app's origin.

**Warning signs:**
- Any user-upload feature without a server-side magic-byte check.
- R2 bucket accepts files larger than the documented cap.

**Phase to address:** Asset Pipeline phase — validation is part of the MVP, not v2 hardening.

---

### Pitfall 10: Publicly-readable R2 bucket / CORS misconfiguration

**What goes wrong:**
Either (a) R2 bucket is set to public-read so anyone with a URL can scrape every asset across all workspaces, or (b) it's locked down and the SPA can't load images because CORS preflight fails. Or (c) signed URLs leak in logs/analytics.

**Why it happens:**
The "make it work" pressure pushes toward public bucket. Then CORS errors push back to "allow `*` origin." Signed-URL TTLs get set to 7 days "for convenience."

**How to avoid:**
- **Bucket is private.** All reads go through either (a) short-TTL signed GET URLs (15min) or (b) a Worker that checks Convex auth and proxies/redirects to a signed URL.
- For exported SCORM packages: assets are **bundled into the zip**, not referenced from R2. The exported package must be self-contained (per PROJECT.md).
- Configure R2 CORS narrowly: `AllowedOrigins: [https://learnflow.pages.dev, https://<custom-domain>]`, `AllowedMethods: [GET, PUT, HEAD]`, `MaxAgeSeconds: 3600`. Never `*`.
- Sign URLs with the minimum permissions: GET-only for reads, PUT-only with `Content-Length-Range` and `Content-Type` constraints for uploads.
- Never log signed URLs (they contain credentials). Redact `?X-Amz-Signature=` in any logging middleware.

**Warning signs:**
- Bucket policy contains `"Principal": "*"`.
- CORS allows `*` origin.
- Signed URL TTL > 1 hour.

**Phase to address:** Asset Pipeline phase. Foundation phase should provision the bucket with the right policy from the start.

---

### Pitfall 11: Theme tokens flow into preview but not into exported HTML

**What goes wrong:**
Author tweaks workspace theme; preview looks great; SCORM export looks broken (default fonts, wrong colors). This is the user's named differentiator failing — high-impact bug.

**Why it happens:**
Preview uses runtime React + CSS vars injected from Convex query results. Exporter forgets to:
- Inline the resolved CSS variable values into the static HTML.
- Bundle the actual font files (relying on Google Fonts CDN — blocked in many corporate LMS environments).
- Resolve Tailwind/CSS-in-JS classes that depend on theme tokens at build time.

**How to avoid:**
- **Single source of truth**: theme is a `{primary, accent, headingFont, bodyFont}` object, stored once in Convex. Both preview AND exporter consume the same object.
- **Single renderer**: write the lesson renderer as a pure component that takes `{ theme, blocks }` and produces HTML. Use it for in-app preview AND static export (via `renderToStaticMarkup` in the export Worker). If the preview and exporter use different code paths, they will drift.
- Inline a `<style>` block in exported `index.html` with theme tokens as CSS custom properties: `:root { --color-primary: #...; --font-heading: '...'; }`.
- **Self-host fonts in the exported zip**. Bundle `.woff2` files. Reference via relative URL: `url('./assets/fonts/Inter.woff2')`. Never reference `fonts.googleapis.com` in the export.
- Add a visual diff test: render the same module via preview and via export, screenshot both, assert pixel-similarity above threshold.

**Warning signs:**
- Exported package references `fonts.googleapis.com` or any external CDN.
- Preview and export use different React component trees.
- Theme color appears in preview CSS but as a default value in exported CSS.

**Phase to address:** Theming phase AND SCORM Export phase — they must share the renderer. Build the shared renderer in the Theming phase so the exporter inherits it.

---

### Pitfall 12: CSS specificity wars with LMS iframe styles

**What goes wrong:**
LMS injects its own `<style>` into the iframe (or applies styles to the iframe's parent that leak via `inherit`). Heading colors look wrong, fonts revert, spacing breaks. Specifically: Cornerstone, SuccessFactors, and several Moodle themes inject aggressive `* { font-family: ... }` rules.

**Why it happens:**
Authors style with low-specificity selectors (`.heading`, `h1`) that lose to LMS rules. Or they assume `body { font-family: ... }` will cascade — it does, until the LMS injects `body > * { font-family: Arial !important }`.

**How to avoid:**
- Scope all exported styles under a single high-specificity wrapper: `<div class="lf-root" id="lf-root">...</div>` and `#lf-root.lf-root h1 { ... }`.
- Use **CSS reset / normalize** scoped to `#lf-root` to neutralize LMS styles.
- Set explicit `font-family`, `color`, `line-height`, `box-sizing` on every text element — don't rely on inheritance.
- Test exported package against at least: SCORM Cloud, Moodle, one commercial LMS. UI looking right in SCORM Cloud is **not enough** — it has the lightest styling of any LMS.
- Avoid `!important` if possible (it cascades into wars); rely on specificity + scoping instead.

**Warning signs:**
- Exported module looks different across LMSs.
- Fonts revert to Arial/Times in some LMSs but not SCORM Cloud.

**Phase to address:** SCORM Export phase — establish the scoping convention before writing the renderer.

---

### Pitfall 13: Dark-mode CSS leaking into LMS iframe

**What goes wrong:**
Learner has OS dark mode on. SCORM player respects `prefers-color-scheme: dark`. Our exported module has `@media (prefers-color-scheme: dark)` rules from copy-pasted Tailwind defaults. Text becomes white on white because LMS background is light but our text adapted.

**Why it happens:**
Tailwind's default config enables `darkMode: 'media'`, which compiles `@media (prefers-color-scheme: dark)` blocks into the bundle. Author never tested dark mode in the LMS context.

**How to avoid:**
- **Disable dark-mode media queries in exported CSS.** The exported module renders in a fixed visual mode chosen by the workspace theme — not by learner OS preference.
- In the export bundler config: strip `@media (prefers-color-scheme: ...)` blocks or set Tailwind `darkMode: 'class'` and never apply the class in export.
- Test the exported module with OS dark mode toggled on.

**Warning signs:**
- "Some learners say it's unreadable" reports.
- Exported CSS contains `prefers-color-scheme`.

**Phase to address:** Theming + SCORM Export phase.

---

### Pitfall 14: Font loading FOIT/FOUT in offline export

**What goes wrong:**
Exported package loads, learner sees invisible text for 3 seconds (FOIT) or a jarring font swap (FOUT). Worse: the font fails to load (corporate firewall, LMS sandboxes file:// loads weirdly) and falls back to Times.

**Why it happens:**
- `@font-face` without `font-display: swap` → FOIT.
- Font files referenced by absolute paths that don't resolve in the LMS's iframe sandboxing.
- Subset fonts not used; loading a 400KB font when only Latin glyphs are needed.

**How to avoid:**
- All `@font-face` declarations use `font-display: swap`.
- Reference fonts via **relative paths only**: `url('./assets/fonts/Inter-Regular.woff2')` — never `/assets/...` (absolute path breaks if LMS serves from a subpath) and never `//fonts.googleapis.com/...` (external dependency).
- Subset fonts to Latin (or Latin + author-selected scripts) before bundling — drop from 400KB to ~30KB with `glyphhanger` or `subfont`.
- Provide a system-font fallback in the `font-family` stack: `'Inter', -apple-system, system-ui, sans-serif`.
- Verify font licensing permits redistribution in a downloadable package — Google Fonts (OFL) does; many commercial fonts do not. Document this for authors picking custom fonts.

**Warning signs:**
- FOIT visible in exported package.
- Font file >100KB.
- Path to font starts with `/` or `http`.

**Phase to address:** Theming phase (font picker UI must communicate license constraints) + SCORM Export phase (bundling).

---

### Pitfall 15: Convex N+1 in reactive subscriptions

**What goes wrong:**
Module editor subscribes to `module(id)` → for each lesson, subscribes to `lesson(id)` → for each block, subscribes to `block(id)`. 200 blocks → 200 subscriptions → Convex throws "too many subscriptions" or charges per function call. Editor jank.

**Why it happens:**
React + Convex make per-component subscriptions trivially easy, so devs reach for `useQuery` everywhere instead of designing a single aggregate query.

**How to avoid:**
- Design **one aggregate query per editor view**: `getModuleWithLessonsAndBlocks(moduleId)` returns the full tree in one subscription.
- For very large modules: paginate at the lesson level — subscribe to module metadata + current lesson's blocks only. Switch lessons → switch subscriptions.
- Use Convex query memoization — the framework dedupes identical queries, but only if args match exactly. Avoid spreading args from props that change identity.
- Profile with Convex dashboard: subscription count per page should be O(1), not O(blocks).

**Warning signs:**
- Convex dashboard shows query call count per page-load >>10.
- Editor TTI slows linearly with block count.

**Phase to address:** Module/Lesson CRUD phase — query shape decisions here lock in for everything downstream.

---

### Pitfall 16: Hitting Convex document size limit (1MB)

**What goes wrong:**
Author pastes a large image as base64 into a rich-text block, or a module accumulates hundreds of blocks. The module document exceeds 1MB. All future writes to that document fail with a cryptic error. Module becomes uneditable.

**Why it happens:**
Convex enforces a **1MB per-document limit**. Storing block content (Tiptap JSON, especially with embedded base64) inside the module document hits this fast.

**How to avoid:**
- **Never embed binary data in Convex documents.** Images, Lottie JSON, fonts → R2. Document stores only the R2 key + metadata.
- **One document per block**, not one document per module. Module document holds an ordered list of block IDs. Each block is its own row. Even Tiptap content goes in the block document, not the module document.
- Validate document size on write (Convex mutation): if serialized size > 500KB, reject and surface a "block too large" error to the UI.
- Monitor: log document sizes periodically; alert if any approaches 800KB.

**Warning signs:**
- Tiptap JSON in module document contains base64 strings.
- A single block stores arrays of items unbounded by UI.
- Any Convex write returns a size-limit error.

**Phase to address:** Data Model / Module CRUD phase — document schema decisions made here are expensive to change later.

---

### Pitfall 17: Convex action timeout on SCORM zip generation

**What goes wrong:**
Module with 50 images takes 30s+ to zip. Convex action times out (default ~10min, but practical limit shorter for sustained CPU). Export fails. Author retries; fails again.

**Why it happens:**
Generating a SCORM zip requires: fetching all R2 assets, building manifest, zipping, uploading result. Doing this in a Convex action is the obvious choice but Convex actions are not designed for sustained CPU/IO of this scale.

**How to avoid:**
- **Run zip generation in a Cloudflare Worker, not a Convex action.** Workers are closer to R2 (zero-egress), can stream-read from R2, stream-write back, and have a Durable Object for long jobs if needed.
- Use **streaming zip** (`zip.js` or a streaming implementation) so memory usage stays flat regardless of module size.
- Make export **async**: Convex mutation enqueues a job (writes to `export_jobs` table); Worker (triggered via Convex HTTP action → Worker fetch) picks it up; updates `export_jobs.status` and `downloadUrl` when done; UI subscribes to `export_jobs(id)` and shows progress.
- Test with a 200-block module containing 50 images at the upper size cap as part of acceptance.

**Warning signs:**
- Export latency scales linearly with asset count past ~10s.
- Convex action logs show timeout errors on export.

**Phase to address:** SCORM Export phase. The compute split (Convex orchestrates, Worker executes) is an architectural decision to lock in early.

---

### Pitfall 18: Cloudflare Worker CPU limit blows on zip generation

**What goes wrong:**
Worker free tier: 10ms CPU/request. Paid (Workers Standard/Unbound): up to 30s wall-clock with longer CPU budget but still bounded. Large zips OOM or hit CPU limits. User sees "Error 1102" or generic failure.

**Why it happens:**
- Compressing many files synchronously consumes CPU; deflate is expensive.
- Holding the whole zip in memory exceeds the 128MB Worker memory limit.

**How to avoid:**
- **Use the Workers Unbound / Standard usage model** (paid) — required for any non-trivial export. Free tier (10ms) is not viable for export; document this as a hard requirement.
- **Stream**: read from R2 → deflate chunk → write to R2 (or stream to client). Never buffer the full zip in memory. Use `CompressionStream` (native to Workers runtime) where possible, falling back to a streaming zip library.
- For huge modules (rare): split into a **Durable Object workflow** — fan out compression per-file, coordinate, assemble.
- Use **store-only** (no deflate) for already-compressed assets (PNG, JPEG, WebP, woff2) — saves CPU at the cost of slightly larger zips. Only deflate text (HTML, JS, CSS, JSON).
- Monitor Worker CPU time via Cloudflare Analytics; alert if p95 > 80% of limit.

**Warning signs:**
- Worker error rate spikes on large modules.
- Worker memory usage > 100MB.
- Zip generation CPU > 25s.

**Phase to address:** SCORM Export phase.

---

### Pitfall 19: Worker bundle bloat / missing Node API assumption

**What goes wrong:**
Adding an npm dep (e.g., a SCORM manifest library, an XML builder) silently pulls in `Buffer`, `fs`, `path`, `crypto`'s Node-only APIs. Worker deploy fails or runs but crashes on first request. Bundle exceeds 1MB compressed limit.

**Why it happens:**
Most npm libs assume Node. `wrangler` may not error on incompatible imports until runtime. Bundle size grows silently with each dep.

**How to avoid:**
- Set `compatibility_flags = ["nodejs_compat"]` in `wrangler.toml` only if you actually need polyfills — and budget for the bundle cost.
- Prefer **Web Standard APIs**: `crypto.subtle`, `fetch`, `TextEncoder`, `ReadableStream`. They're available in Workers without polyfills.
- For XML generation: use a small dep like `fast-xml-parser` (works in Workers) or template strings. Avoid `xmlbuilder2` (Node-leaning, heavy).
- For zip: use `fflate` (~20KB, browser/worker compatible, streaming) or `client-zip`. Avoid `jszip` for large outputs (memory-heavy).
- Run `wrangler deploy --dry-run --outdir=dist` and check the bundle size on every PR; fail CI if it grows >5%.

**Warning signs:**
- `wrangler deploy` warnings about Node polyfills.
- Bundle size > 500KB.
- Runtime errors like `Buffer is not defined`.

**Phase to address:** Foundation phase (set the CI bundle-size check) + every Worker change touches this.

---

### Pitfall 20: Tiptap schema migration breaks saved content

**What goes wrong:**
v1.2 of the app changes the callout block from `{ type: 'callout', attrs: { variant: 'info' } }` to `{ type: 'callout', attrs: { style: 'info' } }`. Existing modules saved under v1.1 load with the callout silently stripped (ProseMirror discards unknown attrs by default).

**Why it happens:**
Tiptap/ProseMirror requires a strict schema. When the schema changes, content written under the old schema either errors out (strict mode) or gets silently rewritten (default).

**How to avoid:**
- Version the Tiptap content: store `{ schemaVersion: 3, content: {...} }` in Convex, not raw content.
- On load: if `schemaVersion` < current, run a **migration function** (pure JS, idempotent) before passing to Tiptap.
- Keep migrations in a versioned list (`migrations/v1-to-v2.ts`, `v2-to-v3.ts`); apply in sequence.
- **Never** remove a node/mark type from the schema once shipped — deprecate it (keep the node, hide the UI affordance) and migrate content forward.
- Test migrations against a fixture of every block type before shipping.

**Warning signs:**
- Older modules render differently than newly created ones with the same content.
- Tiptap console warns about unknown nodes.

**Phase to address:** Editor / Tiptap phase — establish schemaVersion + migration plumbing from day 1, even though there's only v1.

---

### Pitfall 21: Copy-paste injects unwanted Tiptap marks

**What goes wrong:**
Author pastes from Word/Google Docs/Notion. Tiptap accepts all the inline styles, fonts, colors, classes from the source. The block now contains 20 inline `style="font-family: Calibri; color: #1F3864"` spans that overrride the theme.

**Why it happens:**
Default Tiptap paste handlers accept HTML largely as-is, including unknown attributes/styles via the `Paste` plugin.

**How to avoid:**
- Use the **`@tiptap/extension-paste`** or configure each mark/node with explicit `parseHTML` rules that **drop** all `style` attrs except those mapping to allowed marks (bold, italic, underline, link).
- Add a paste sanitizer: on `paste`, intercept the HTML, run through DOMPurify with a strict allowlist, then convert to ProseMirror via `parseHTMLToProseMirror`.
- Provide a "Paste as plain text" affordance (Cmd+Shift+V) for safety.
- Test paste from: Word, Google Docs, Notion, Confluence, a styled email — all should produce clean output.

**Warning signs:**
- Pasted content overrides theme colors.
- Tiptap JSON contains marks/attrs not in the documented schema.

**Phase to address:** Editor / Tiptap phase.

---

### Pitfall 22: Magic-link token reuse / replay

**What goes wrong:**
A magic link sent to a user's email gets intercepted (email forwarding, screenshot, browser history sync). Attacker uses the link; user uses it too. Both get a session, or worse, attacker locks user out.

**Why it happens:**
Naive implementations: a UUID in the URL, "expires in 24h," reusable. No binding to device/IP/browser.

**How to avoid:**
- **Single-use tokens**: token is consumed on first successful exchange; subsequent attempts fail.
- **Short TTL**: 15 minutes max (per OWASP guidance). Long TTLs are not user-friendliness — they're a vulnerability.
- **Cryptographically random**: minimum 128 bits of entropy from `crypto.getRandomValues` (Web Crypto, available in Workers + browser). Not `Math.random`, not a timestamp-hash.
- Tie the token to the **email address being verified** so even if leaked it can't be used for a different account.
- On token exchange: rotate session ID, issue a new HttpOnly+Secure+SameSite=Lax session cookie. Do not put the token into the session.
- Convex's built-in magic-link auth (`@convex-dev/auth` / Convex Auth) handles most of this — **use it, don't roll your own**. Verify which version you're on and that single-use + short TTL are configured.
- Rate-limit magic-link sends: max 5/email/hour, 10/IP/hour, to prevent inbox flooding and enumeration.

**Warning signs:**
- Token TTL > 1 hour.
- Token works more than once.
- No rate limit on link-send endpoint.

**Phase to address:** Auth phase — non-negotiable.

---

### Pitfall 23: Magic-link deep-link / "wrong browser" UX trap

**What goes wrong:**
User requests link in Chrome on desktop. Email arrives on phone. They tap it; opens in iOS Safari (different browser, no session context). Link consumed. User is now signed in on phone but still locked out on desktop where they wanted to work.

**Why it happens:**
Magic-link UX assumes the user opens the link in the same browser session that requested it. Mobile users break this assumption constantly.

**How to avoid:**
- Show a **"check your email" page** that polls for completion: when the link is consumed from any device, the original browser's polling completes and signs that browser in too. Convex's reactive queries make this trivial — original requesting client subscribes to a "pendingAuth" doc; completed elsewhere updates the doc; both clients sign in.
- Alternative: device-binding — link includes a `deviceId` cookie set when requesting; opening in a different browser shows "this link was sent from a different device, sign in there or request a new one."
- Always provide a **"resend link"** button on the check-your-email page (with rate limit).
- Clearly handle expired-link state with a friendly UI: "This link expired. Send a new one?"

**Warning signs:**
- Support tickets about "I clicked the link on my phone but my laptop didn't sign in."
- Users requesting multiple links per session.

**Phase to address:** Auth phase.

---

### Pitfall 24: Editor lags with 200 blocks

**What goes wrong:**
Module grows past ~100 blocks. Every keystroke triggers re-render of every block. Editor becomes unusable.

**Why it happens:**
- All blocks rendered + mounted simultaneously.
- Each block subscribes independently to Convex (see Pitfall 15).
- Drag-and-drop libraries (react-beautiful-dnd, dnd-kit) often re-render all siblings on drag.

**How to avoid:**
- **Virtualize the block list** with `react-virtual` / `@tanstack/react-virtual`. Only render blocks in the viewport + buffer.
- Memoize blocks aggressively: `React.memo` with shallow-equal on block ID + version stamp. Block content changes bump version; siblings see same version and skip re-render.
- Use **dnd-kit** (better perf than react-beautiful-dnd, supports virtualization). Render drag overlay separately from the list.
- Defer Tiptap editor instantiation to blocks currently in/near viewport. Out-of-viewport blocks render a lightweight read-only preview.
- Profile with React DevTools Profiler at 50, 100, 200 blocks; budget <16ms per keystroke for 95th percentile.

**Warning signs:**
- Keystroke latency > 50ms at 100 blocks.
- React Profiler shows >20 components re-rendering per keystroke.

**Phase to address:** Editor / Block List phase — virtualization is much harder to retrofit than to design in.

---

### Pitfall 25: Lottie autoplay blocks main thread

**What goes wrong:**
Lesson with 5 Lottie animations. All autoplay on mount. Main thread blocked for 200ms+ as `lottie-web` parses + paints simultaneously. First Input Delay (FID) tanks. Editor and exported package both feel sluggish.

**Why it happens:**
`lottie-web` renders to SVG/Canvas on the main thread. Parsing complex Lottie JSON (10k+ keyframes) is CPU-heavy.

**How to avoid:**
- Use **`@lottiefiles/dotlottie-web`** or **`lottie-web` with `renderer: 'canvas'`** — canvas is faster than SVG for complex animations.
- Only autoplay Lottie when it enters viewport (IntersectionObserver). Pause when leaving.
- Cap Lottie file size (e.g., 500KB JSON, validated server-side per Pitfall 9).
- For exported package: lazy-load `lottie-web` only when a Lottie block is encountered. Defer parse to `requestIdleCallback`.
- Provide a "reduced motion" path: respect `prefers-reduced-motion: reduce` → show first frame, don't animate.

**Warning signs:**
- Editor FPS drops in lessons with multiple Lottie blocks.
- Exported package Lighthouse FID > 100ms.

**Phase to address:** Lottie Block phase + SCORM Export phase.

---

### Pitfall 26: Image lazy-loading broken inside LMS iframe

**What goes wrong:**
Authors use `<img loading="lazy">`. Inside the LMS iframe at small dimensions, the viewport calculation is wrong; images below the fold never load. Or they all load eagerly because the iframe is tall.

**Why it happens:**
`loading="lazy"` uses viewport intersection. Inside an iframe, browser support is inconsistent (Safari shipped this late; some LMS players use embedded WebViews that don't honor it).

**How to avoid:**
- For exported packages: use **explicit IntersectionObserver-based lazy loading** with a 200px rootMargin, not the native `loading="lazy"` attribute. More reliable cross-browser, cross-iframe.
- Always include `width` and `height` attributes on `<img>` to avoid layout shift (especially important in scrolling LMS iframes).
- Preload above-the-fold images explicitly with `<link rel="preload" as="image">` in the head.
- Test exported package inside an actual LMS iframe, not just a standalone browser tab.

**Warning signs:**
- Exported module shows empty image placeholders below fold in LMS.
- Cumulative Layout Shift > 0.1 in exported package.

**Phase to address:** SCORM Export phase.

---

### Pitfall 27: Relative-path breakage in some LMS players

**What goes wrong:**
Exported package references `./assets/images/foo.png`. Some LMSs serve content through a content-rewriting proxy that resolves relative URLs against a different base, breaking all asset references.

**Why it happens:**
LMSs serve SCORM content through various mechanisms: direct iframe, proxy with URL rewriting, embedded WebView, file:// (rare). Each handles relative paths differently. The spec is silent on this so implementations vary.

**How to avoid:**
- Use **document-relative paths consistently**: `assets/images/foo.png` (no leading `./`, no leading `/`).
- Set `<base href="./">` in the exported `index.html` head as belt-and-suspenders.
- Never use absolute paths (`/assets/...`) — they break in any LMS that serves from a subpath.
- Test in: SCORM Cloud (standard), Moodle (proxy), one commercial LMS (varied). If two of three work, the third's bug is theirs; document the workaround.

**Warning signs:**
- "Broken image" icons in LMS but not in standalone browser test.
- Exported HTML contains `src="/...` or `href="/...`.

**Phase to address:** SCORM Export phase — bake the path convention into the renderer.

---

### Pitfall 28: Exported package leaks author identity / internal IDs

**What goes wrong:**
SCORM zip ships to LMS. Learners or LMS admins inspect the HTML/JSON. They find: author email addresses in metadata, Convex document IDs, workspace IDs, internal user IDs in commit history of `<script>` source maps. Privacy regulator gets interested.

**Why it happens:**
Convenience leaks: dev-mode source maps shipped in prod, "Last edited by ..." metadata embedded, JWT or session tokens accidentally inlined.

**How to avoid:**
- **Strip all metadata** from exported HTML: no `data-author-email`, no `data-user-id`, no Convex doc IDs in the DOM.
- Use **public-safe identifiers** in exported content: hashed/opaque IDs for any required tracking, not user IDs.
- Disable source maps in the production export bundle (`rollup` / `vite` config). Generate them for app debugging only.
- Strip Tiptap content of any `data-*` attrs not used at runtime.
- **Audit the zip** before download in dev: a Worker function that crawls every text file in the zip and greps for: email patterns, UUIDs, JWT-shape strings, Convex deployment URLs. Fail the export if any are found.
- Document privacy posture: "The exported package contains no PII about authors. Learner data is reported back to the LMS, not stored in the package."

**Warning signs:**
- Exported `index.html` contains an `@` symbol followed by a domain.
- Source maps in the zip.
- Convex deployment URL (`https://...convex.cloud`) in any exported file.

**Phase to address:** SCORM Export phase — add the audit as a verification gate.

---

### Pitfall 29: No way to inspect a corrupted module

**What goes wrong:**
User reports "my module won't open." Module document is in a bad state — orphaned block IDs, circular refs, malformed Tiptap JSON. No way to inspect without running the app. App crashes loading it. Author can't recover.

**Why it happens:**
All editing goes through the UI; there's no admin/debug surface for inspecting raw data. Bugs in writes cascade because there's no read-only inspection path.

**How to avoid:**
- Build a **read-only debug view** (gated by workspace-admin role): URL like `/modules/:id/debug` that shows raw Convex document JSON, asset references, and validation results without instantiating Tiptap.
- Add a **module validator** Convex function: takes a module ID, walks the tree, reports issues (missing blocks, dangling asset refs, schema mismatches). Run on every save (warn, don't block) and on demand from the debug view.
- Provide a **JSON export** of the raw module (independent of SCORM) for backup/restore.
- Convex dashboard direct-table access is the last resort — make sure team members know how to reach it.

**Warning signs:**
- Support requests about "broken module" with no diagnosis path.
- No way to view a module without rendering it.

**Phase to address:** Operations / Hardening phase — could be deferred but at least scaffold the JSON export early.

---

### Pitfall 30: No rollback path for botched theme migrations

**What goes wrong:**
A theme schema change (e.g., adding a new required token) goes out. Existing themes break. All modules now render with default styles. No way to restore previous theme state.

**Why it happens:**
Themes are typically a single row per workspace, overwritten on edit. No history. No backup. No "preview before applying."

**How to avoid:**
- Theme writes are **append-only** with a version pointer: `themes` table stores all versions; `workspace.activeThemeVersionId` points at the current one. Reverting is changing the pointer, not restoring data.
- Theme migrations are **forward + backward**: every schema change includes a migration function and a reverse function. Apply migrations idempotently on read.
- Preview theme changes against a representative module before applying workspace-wide.
- Surface a "revert to previous theme" button in workspace settings.

**Warning signs:**
- Theme schema changes ship without migration code.
- Theme table has only one row per workspace.

**Phase to address:** Theming phase + Operations phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip Y.js; do last-writer-wins per block | Saves days of CRDT integration | Concurrent edits silently overwrite; users blame the app, not the design | Only if presence UI strongly discourages simultaneous block edits AND testing confirms users won't be surprised |
| Embed assets as base64 in Convex docs | No R2 plumbing needed | Hits 1MB doc limit fast; reactive queries balloon | Never — even in prototypes, R2 setup is a few hours |
| Skip SCORM Cloud validation in CI | Faster iteration | Production-breaking manifest bugs ship to authors | Only during initial spike; **must** be in CI before first author uses export |
| Use Google Fonts CDN in exported package | One-line theme integration | Breaks in offline LMS / corporate firewalls; privacy issue (GDPR — Google Fonts via CDN was ruled unlawful in DE 2022) | Never for exported packages; acceptable for in-app preview |
| Single Convex query per component (no aggregation) | Quick to write | Subscription count explodes; rate limits hit | Never past prototype phase |
| Skip presence throttling | Cursor feels instant | Convex usage explodes; editor lags | Never — throttle from day 1 |
| One zip-in-memory in Worker (no streaming) | Simpler code | OOM/CPU limit on real-world modules | Only for proof-of-concept with <10 small files |
| Public R2 bucket | No signed-URL plumbing | Privacy violation; cross-workspace data leak | Never |
| Magic link TTL 24h | Friendlier for users on slow email | Direct OWASP violation; replay window huge | Never — 15min max |
| Manual SCORM API discovery (not pipwerks) | "Understand what we ship" | Subtle bugs on uncommon LMSs; weeks of debugging per bug | Only if pipwerks license is unacceptable (it's BSD — it isn't) |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| SCORM 1.2 LMS (any) | Assume `window.parent.API` exists | Full bidirectional discovery (pipwerks); depth 7; opener chain |
| SCORM 1.2 LMS (any) | `LMSSetValue` without `LMSCommit` | Debounced commit after state changes; final commit on `pagehide` |
| SCORM 1.2 LMS (any) | Pass raw point score | Always normalize to 0–100 |
| Cloudflare R2 | Use Convex storage for everything | R2 for media/zips; Convex storage only for tiny metadata blobs (or skip Convex storage entirely) |
| Cloudflare R2 | Public bucket policy | Private bucket + signed URLs (15min TTL) or Worker proxy with auth |
| Cloudflare Workers | Pull in Node-only npm deps | Audit deps for Web Standards compatibility; use `fflate`, `fast-xml-parser`, native `crypto.subtle` |
| Cloudflare Workers | Buffer full zip in memory | Stream R2 → deflate → R2 with `CompressionStream` |
| Convex | One subscription per nested component | Aggregate query at the route level |
| Convex | Per-keystroke mutation for presence | Throttled ephemeral table OR Y.js awareness over a single channel |
| Convex | Magic-link auth rolled by hand | Use `@convex-dev/auth` magic-link provider |
| Tiptap | Single doc field in module document | One block per Convex document; module holds ordered block IDs |
| Tiptap | Accept paste HTML as-is | Sanitize via DOMPurify + restrict `parseHTML` per node/mark |
| Lottie | Autoplay all on mount | IntersectionObserver gate + canvas renderer |
| Google Fonts | Link `fonts.googleapis.com` from exported package | Self-host woff2 in zip; subset to needed glyphs |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-block Convex subscription | Editor TTI grows linearly with block count | Single aggregate query per editor view | ~30 blocks |
| Non-virtualized block list | Keystroke lag, FPS drops | `@tanstack/react-virtual` + memoized blocks | ~100 blocks |
| Lottie autoplay everywhere | Main-thread blocked, low FID score | IntersectionObserver-gated play | 3+ Lotties per lesson |
| Presence updates on every selectionchange | Convex mutation count explodes | Throttle to 5–10Hz + ephemeral table | 2+ active editors |
| In-memory zip generation | Worker OOM/CPU limit | Streaming zip (`fflate` streaming API) | ~10MB exports |
| Unsubsetted custom fonts | Slow first paint in exported package | Subset to Latin (or chosen scripts) before bundling | Any custom font in the export |
| Synchronous Tiptap mount of every block | Editor freeze on module load | Lazy-mount Tiptap; render read-only preview for off-screen | ~50 rich-text blocks |
| Full-doc replace on Convex subscription update | Cursor jumps; lost keystrokes | Apply transactions, not whole-doc set; skip echoes | 1+ concurrent editor (always) |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Public R2 bucket | Cross-workspace asset leak; abuse for hosting | Private bucket + signed URLs (15min) or Worker proxy with Convex auth check |
| Long-TTL magic links | Token replay; account takeover | 15min TTL; single-use; rate-limited send |
| Trusting client-reported MIME on upload | Stored XSS via HTML disguised as image; RCE risk in LMS context | Server-side magic-byte check; allowlist MIMEs; sanitize SVG or refuse it |
| Inlining session tokens / Convex URLs in exported zip | Credential leak to learners | Audit exported zip for JWT-shape strings, Convex URLs, emails before release |
| Author email in SCORM package metadata | PII leak to learners and LMS admins | Strip all author identity from exports |
| No CSRF on Worker upload endpoints | Cross-site upload to victim's account | Signed-URL approach (no cookie auth) — already CSRF-safe; ensure Worker proxy endpoints check `Origin` |
| Magic link in URL fragment vs body | Token visible in browser history / referer | Token in path or query; consume immediately on landing; clean URL after exchange (`history.replaceState`) |
| Loose CORS (`*`) on R2 / Workers | Any site can read/write | Explicit origin allowlist |
| SVG upload without sanitization | Stored XSS (SVG can carry `<script>`) | DOMPurify with `USE_PROFILES: { svg: true }`; serve with `Content-Security-Policy` |
| Source maps shipped in production export | Source code disclosure | Strip source maps from prod bundle; emit only for dev |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No indication when another author is editing the same block | "Did my edit go through?"; lost work | Per-block presence avatars + soft-lock UI affordance |
| Magic link "check your email" with no polling | User stuck wondering if it worked | Reactive polling page that signs in automatically when link is consumed (anywhere) |
| Export progress as a modal that blocks the UI | Author can't keep working during 30s export | Toast with progress + async download link; export jobs are subscribable |
| Theme picker without live preview | Authors make bad choices; iterate slowly | Real preview pane that updates as tokens change |
| "Looks great in preview, broken in LMS" | Lost author trust | In-app "Preview in LMS sandbox" button that opens SCORM Cloud test |
| Validation errors as toast that disappears | Author misses them | Persistent in-context error pin on offending block |
| No way to duplicate / template a module | Repetitive authoring | First-class "duplicate" + "save as template" |
| Lottie blocks without poster frame | Empty space while loading | Show first frame as poster; play on visible |
| Drag-handle that grabs the whole block | Accidental drags during editing | Dedicated drag handle (grip icon) on hover only |
| Undo across collaborators | "Why did my work disappear?" | Per-user undo stack (Y.js gives this) |

---

## "Looks Done But Isn't" Checklist

- [ ] **SCORM export:** Runs in SCORM Cloud — verify it also runs in Moodle and at least one commercial LMS. SCORM Cloud is the most permissive.
- [ ] **SCORM scoring:** Score appears in LMS — verify `passed`/`failed` triggers correctly with a mastery score, and `completed` works without one. Test both code paths.
- [ ] **SCORM lifecycle:** Module reports complete — verify it still does after closing the tab mid-lesson and reopening, and on mobile (`pagehide` not `beforeunload`).
- [ ] **Theme in export:** Looks themed in preview — open the exported `index.html` directly in a browser and confirm fonts/colors render without internet (offline test).
- [ ] **Asset bundling:** Module renders — search the exported HTML/CSS for `http://`, `https://`, `//` to confirm no external resources.
- [ ] **Realtime collab:** Two users see each other's edits — open three tabs across two browsers and rapidly type into the same block; no lost keystrokes, no cursor jumps, no doubled characters.
- [ ] **Asset reaper:** Uploads work — check R2 bucket; orphaned blobs should be auto-deleted within an hour.
- [ ] **Magic link:** Sign-in works — try clicking the link in a different browser than where it was requested; confirm graceful UX.
- [ ] **Magic link:** Single sign-in — click the link twice; second click must fail.
- [ ] **Convex doc size:** Module saves — add 100+ blocks with realistic content; module doc size stays well under 1MB.
- [ ] **Editor perf:** Editor feels fast — load a module with 100 blocks; keystroke latency should remain <50ms p95.
- [ ] **Worker bundle:** Worker deploys — check bundle size; should be well under 1MB compressed and under 500KB uncompressed.
- [ ] **Export privacy:** Exported package is shareable — grep the zip for `@` symbols (emails), Convex URLs, UUIDs not strictly needed for runtime.
- [ ] **Fonts:** Fonts look right — disable internet; open exported package; fonts must still load (self-hosted, not Google CDN).
- [ ] **CORS:** Uploads work in dev — try from a deployed origin too; CORS must be explicit per origin, not `*`.
- [ ] **Tiptap paste:** Rich text works — paste from Word/Google Docs/Notion; output should be clean, theme-conformant, no inline styles.
- [ ] **Lottie:** Animations play — test with a 1MB+ Lottie and 5 Lottie blocks in one lesson; FID should stay under 100ms.
- [ ] **Mobile learner:** Module works on phone — exported package must be responsive AND not depend on `beforeunload` (use `pagehide`).

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SCORM API discovery wrong | LOW | Swap in pipwerks wrapper; re-export packages |
| Score reported as raw points | LOW | Fix normalization; re-export. LMS data from past runs not recoverable. |
| Invalid manifest XML | LOW | Fix template; re-export. Already-uploaded packages unusable. |
| Orphaned R2 uploads | MEDIUM | Write one-off audit query: `assets` not referenced anywhere → delete from R2; verify reaper runs going forward |
| Convex doc exceeds 1MB | HIGH | Document is stuck — can't write to remove content. Workaround: manual Convex dashboard intervention or restore from backup. Migration to per-block documents is forced. |
| Realtime overwrites lost data | HIGH | No automatic recovery. Soft mitigation: enable Convex point-in-time recovery (paid feature); communicate with affected user. Mandatory: switch to Y.js. |
| Magic-link replay compromise | HIGH | Revoke all sessions for affected accounts; rotate all magic-link signing secrets; notify users; review logs for affected timeframe. |
| Theme migration broke all modules | MEDIUM | Revert workspace `activeThemeVersionId` pointer to previous version (if the append-only theme design was followed). If not: restore from Convex backup. |
| Exported zip contains PII | MEDIUM | Re-export all modules with audit gate enabled; communicate to LMS admins to replace uploaded packages. Cannot recall already-distributed zips. |
| Worker timeout on export | LOW | Switch to async job pattern + streaming zip; existing user just retries |
| Lottie/asset killing perf | LOW | Add IntersectionObserver gate; re-export. |
| Tiptap schema migration corrupted content | HIGH | If no schemaVersion was stored: manual data fixup per-module. If schemaVersion exists: write a one-shot migration and apply. |

---

## Pitfall-to-Phase Mapping

Phase names are illustrative; map to actual roadmap phase IDs when the roadmap is built.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| #1 SCORM API discovery | SCORM Export | Use pipwerks; test in 3+ LMSs |
| #2 Missing LMSCommit/Finish | SCORM Export | Lifecycle test: set value, close tab, reopen, verify persistence |
| #3 lesson_status enum confusion | SCORM Export | Manifest builder forces explicit completion-model choice |
| #4 Raw score vs 0–100 | Quiz Block + SCORM Export | Single `reportScore` utility; unit test |
| #5 Invalid manifest | SCORM Export | XSD validation + SCORM Cloud Test Track in CI |
| #6 Tiptap+Convex without Y.js | Realtime Collab | Decision made before block work begins; 3-tab test |
| #7 Presence flooding | Realtime Collab | Throttle in awareness channel; Convex usage budget |
| #8 Orphaned R2 uploads | Asset Pipeline | Two-phase upload + scheduled reaper |
| #9 Missing MIME/size validation | Asset Pipeline | Server-side magic-byte check; signed-URL size constraint |
| #10 Public R2 / loose CORS | Foundation + Asset Pipeline | Bucket policy review at provisioning |
| #11 Theme tokens don't flow to export | Theming + SCORM Export | Single shared renderer for preview + export; visual diff test |
| #12 CSS specificity wars in LMS | SCORM Export | `#lf-root` scoped reset; multi-LMS test |
| #13 Dark-mode leaks into LMS | Theming + SCORM Export | Strip `prefers-color-scheme` from export CSS |
| #14 Font FOIT/FOUT offline | Theming + SCORM Export | `font-display: swap` + self-hosted subsets; offline test |
| #15 Convex N+1 | Module CRUD | One aggregate query per editor view |
| #16 Convex 1MB doc limit | Module CRUD (data model) | One block per document; size monitor on writes |
| #17 Action timeout on export | SCORM Export | Move zip generation to Worker; async job pattern |
| #18 Worker CPU/memory limit | SCORM Export | Streaming zip + Workers Standard plan |
| #19 Worker bundle bloat | Foundation (CI) | Bundle-size gate in CI; Web-standard libs only |
| #20 Tiptap schema migrations | Editor | `schemaVersion` + migration registry from v1 |
| #21 Paste injects unwanted marks | Editor | Sanitize on paste; restrict `parseHTML` |
| #22 Magic-link replay | Auth | Use `@convex-dev/auth`; 15min TTL; single-use; rate limit |
| #23 Wrong-browser deep-link UX | Auth | Reactive "check your email" page polling for sign-in |
| #24 Editor lag at 200 blocks | Editor / Block List | Virtualization from day 1; perf budget test |
| #25 Lottie blocks main thread | Lottie Block + SCORM Export | IntersectionObserver gate; canvas renderer |
| #26 Lazy-loading broken in LMS | SCORM Export | Explicit IntersectionObserver, not native `loading="lazy"` |
| #27 Relative-path breakage | SCORM Export | `<base href="./">`; document-relative paths only |
| #28 Identity leak in export | SCORM Export | Pre-download audit: grep zip for emails/UUIDs/URLs |
| #29 Cannot inspect corrupted module | Operations / Hardening | Read-only debug view + JSON export |
| #30 No theme rollback | Theming + Operations | Append-only theme versions; pointer revert |

---

## Sources

- **SCORM 1.2 Runtime Environment specification (ADL):** authoritative for API discovery, data model, `lesson_status` semantics, score normalization. https://adlnet.gov/projects/scorm/ (HIGH confidence).
- **pipwerks SCORM API wrapper** (BSD-licensed, ~10 years of production hardening): https://github.com/pipwerks/scorm-api-wrapper (HIGH).
- **SCORM Cloud Test Track API** — automated validation harness: https://cloud.scorm.com (HIGH for validation gate).
- **Convex documentation** — limits (1MB doc size, action timeouts), best practices for reactive queries, auth provider: https://docs.convex.dev (MEDIUM — limits evolve; verify at plan time).
- **Cloudflare Workers documentation** — CPU/memory limits per plan tier, Web Standards APIs available, R2 binding: https://developers.cloudflare.com/workers/platform/limits/ (HIGH).
- **Cloudflare R2 documentation** — CORS, signed URLs, bucket policies: https://developers.cloudflare.com/r2/ (HIGH).
- **Y.js + Tiptap Collaboration extension** — CRDT collaborative editing patterns: https://tiptap.dev/api/extensions/collaboration (HIGH).
- **ProseMirror documentation** — schema, transactions, paste handling: https://prosemirror.net/docs/guide/ (HIGH).
- **OWASP Authentication Cheat Sheet** — magic-link TTL, single-use tokens, rate limiting: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html (HIGH).
- **OWASP File Upload Cheat Sheet** — MIME validation, magic-byte checks, SVG sanitization: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html (HIGH).
- **DOMPurify** — SVG/HTML sanitization library: https://github.com/cure53/DOMPurify (HIGH).
- **fflate** — streaming zip for Workers: https://github.com/101arrows/fflate (HIGH).
- **lottie-web performance guidance** — renderer choice, IntersectionObserver patterns: LottieFiles docs (MEDIUM).
- **Google Fonts GDPR ruling (DE, Jan 2022)** — basis for "self-host fonts in export" recommendation (MEDIUM, jurisdiction-specific but informative).
- **Community knowledge / known issues** — LMS-specific quirks (Moodle proxy paths, Cornerstone iframe nesting, SuccessFactors font overrides) drawn from SCORM developer community reports (LOW–MEDIUM; verify per customer LMS).

---
*Pitfalls research for: Rise-360-style learning module authoring tool on Cloudflare + Convex stack*
*Researched: 2026-05-27*

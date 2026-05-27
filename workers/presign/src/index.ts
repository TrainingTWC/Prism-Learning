/**
 * Prism Learning — presign Worker (skeleton).
 *
 * Phase 4 will implement:
 *   - POST /presign  → verify Convex session → return scoped R2 PUT URL
 *   - GET  /asset/:id → verify membership → return scoped R2 GET URL
 *
 * For now this is a health-check stub so `wrangler dev` is runnable.
 */

export interface Env {
  // ASSETS: R2Bucket; // wired in Phase 4
  // CONVEX_DEPLOYMENT_URL: string;
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(
        JSON.stringify({ ok: true, service: 'prism-presign', version: '0.0.0' }),
        { headers: { 'content-type': 'application/json' } },
      );
    }

    return new Response('Not implemented yet — see Phase 4.', { status: 501 });
  },
};

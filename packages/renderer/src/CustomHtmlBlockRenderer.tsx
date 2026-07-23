import DOMPurify, { type Config as DOMPurifyConfig } from 'dompurify';
import { useEffect, useRef } from 'react';
import type { CustomHtmlBlock } from './types';

interface Payload {
  html?: string;
  notes?: string;
}

interface Props {
  block: CustomHtmlBlock;
}

// Permissive config for author-controlled content — still sanitizes scripts + event handlers
const PURIFY_CONFIG: DOMPurifyConfig = {
  ADD_TAGS: ['iframe', 'video', 'audio', 'source', 'track'],
  ADD_ATTR: [
    'allowfullscreen',
    'frameborder',
    'allow',
    'controls',
    'autoplay',
    'loop',
    'muted',
    'playsinline',
    'srcdoc',
    'referrerpolicy',
  ],
  FORCE_BODY: false,
};

export function CustomHtmlBlockRenderer({ block }: Props) {
  let payload: Payload = {};
  try { payload = JSON.parse(block.content) as Payload; } catch { /* empty */ }

  const hostRef = useRef<HTMLDivElement>(null);
  const safe = payload.html ? DOMPurify.sanitize(payload.html, PURIFY_CONFIG) : '';

  // Mount sanitized author HTML inside an open Shadow DOM root instead of the
  // light DOM. DOMPurify still strips scripts/event handlers, but it does NOT
  // strip <style>/<link> (author widgets legitimately need scoped CSS) — those
  // tags previously landed in the page's light DOM and became a GLOBAL
  // stylesheet, letting pasted CSS (e.g. `body{...}` or `:root{--var:...}`)
  // leak out and change the rest of the lesson, while the app's own CSS could
  // bleed into the author's widget. Shadow DOM gives the content its own
  // scoping root: pasted <style> only affects nodes inside the shadow root,
  // and the app's stylesheet doesn't cross the shadow boundary either.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // React may re-run this effect against the same element (e.g. StrictMode
    // double-invoke) — attachShadow() throws if called twice on one element,
    // so reuse an existing shadow root rather than re-attaching.
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    root.innerHTML = safe;
  }, [safe]);

  if (!payload.html) return null;

  return <div ref={hostRef} className="prism-custom-html my-6" />;
}

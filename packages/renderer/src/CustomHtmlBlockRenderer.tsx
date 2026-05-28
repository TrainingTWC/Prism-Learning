import DOMPurify, { type Config as DOMPurifyConfig } from 'dompurify';
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
  if (!payload.html) return null;

  const safe = DOMPurify.sanitize(payload.html, PURIFY_CONFIG);

  return (
    <div
      className="prism-custom-html my-6"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by DOMPurify
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

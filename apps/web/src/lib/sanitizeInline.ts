import DOMPurify from 'dompurify';

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

/**
 * Sanitize inline/block rich-text HTML for in-editor live previews
 * (Callout/Quote/Flashcard block editors). Mirrors
 * `packages/renderer/src/sanitizeInline.ts` — kept as a local copy in
 * apps/web following the precedent set by ImageBlockEditor (editor-side
 * previews sanitize locally rather than importing the renderer package).
 *
 * - Rich content (contains HTML): DOMPurify-sanitized down to a small
 *   inline + paragraph allowlist. `style` is allowed so font-size/color
 *   spans survive.
 * - Legacy plain-string content (no `<`): returned as escaped plain text so
 *   existing modules render unchanged, with no data migration.
 */
export function sanitizeInline(html: string): string {
  if (!html.includes('<')) {
    return html.replace(/[&<>"]/g, (ch) => ESCAPE[ch]!);
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'span', 'strong', 'em', 'b', 'i', 'u', 's', 'br', 'a'],
    ALLOWED_ATTR: ['style', 'class', 'href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

/** Strip all HTML tags, returning plain text (for aria-labels / truncated previews). */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

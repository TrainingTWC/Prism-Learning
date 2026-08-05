import DOMPurify from 'dompurify';

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

/**
 * Sanitize inline/block rich-text HTML (image / gallery captions, and — as of
 * the remaining-text-surfaces conversion — accordion/callout/quote/flashcard/
 * process/quiz fields authored via `InlineRichText`).
 *
 * - Rich content (contains HTML): DOMPurify-sanitized down to a small inline
 *   + paragraph allowlist. `style` is allowed so font-size / color spans
 *   survive. `p` is allowed so multiline fields keep paragraph breaks.
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

/** Strip all HTML tags, returning plain text (for aria-labels / non-HTML sinks). */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

import DOMPurify from 'dompurify';

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

/**
 * Sanitize inline caption HTML (image / gallery captions).
 *
 * - Rich captions (contain HTML): DOMPurify-sanitized down to a small inline
 *   allowlist. `style` is allowed so font-size / color spans survive.
 * - Legacy plain-string captions (no `<`): returned as escaped plain text so
 *   existing modules render unchanged, with no data migration.
 */
export function sanitizeInline(html: string): string {
  if (!html.includes('<')) {
    return html.replace(/[&<>"]/g, (ch) => ESCAPE[ch]!);
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['span', 'strong', 'em', 'b', 'i', 'u', 's', 'br', 'a'],
    ALLOWED_ATTR: ['style', 'class', 'href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

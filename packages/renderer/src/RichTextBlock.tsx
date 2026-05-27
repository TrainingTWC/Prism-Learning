import DOMPurify from 'dompurify';
import type { RichTextBlock as RichTextBlockType } from './types';

interface Props {
  block: RichTextBlockType;
}

/**
 * Read-only rich-text renderer.
 * Content is sanitized through DOMPurify before being injected to prevent XSS.
 */
export function RichTextBlock({ block }: Props) {
  const clean = DOMPurify.sanitize(block.content, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'a',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'span', 'div', 'figure', 'figcaption', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'width', 'height'],
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: false,
  });
  return (
    <div
      className="prism-rich-text"
      // eslint-disable-next-line react/no-danger -- content is DOMPurify-sanitized
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

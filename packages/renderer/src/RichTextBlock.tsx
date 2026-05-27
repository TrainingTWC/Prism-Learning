import type { RichTextBlock as RichTextBlockType } from './types';

interface Props {
  block: RichTextBlockType;
}

/**
 * Read-only rich-text renderer.
 * Authoring uses Tiptap; on save, Tiptap's JSON is rendered to trusted HTML
 * (server-side, via @tiptap/html) and stored on the block. This component
 * just injects that HTML — no editing, no I/O.
 */
export function RichTextBlock({ block }: Props) {
  return (
    <div
      className="prism-rich-text"
      // eslint-disable-next-line react/no-danger -- content is server-sanitized Tiptap HTML
      dangerouslySetInnerHTML={{ __html: block.content }}
    />
  );
}

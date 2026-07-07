import { InlineRichText } from './InlineRichText';

/**
 * Compact shared rich-text caption editor (image + gallery captions).
 *
 * Thin wrapper over the generalized `InlineRichText` in single-line mode —
 * kept as a named export so existing caption call sites are unaffected.
 * Backward compatible with legacy plain-string captions (see InlineRichText).
 */
export function CaptionEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  return (
    <InlineRichText value={value} onChange={onChange} placeholder={placeholder ?? 'Caption…'} />
  );
}

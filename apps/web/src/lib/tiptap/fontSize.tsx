import { Extension, type Editor } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      /** Apply an inline font-size (e.g. '20px') to the current selection. */
      setFontSize: (size: string) => ReturnType;
      /** Remove the inline font-size from the current selection, keeping other textStyle attrs. */
      unsetFontSize: () => ReturnType;
    };
  }
}

/**
 * Inline font-size via the shared `textStyle` mark.
 * Mirrors the LetterSpacing pattern in RichTextBlockEditor: the attribute is
 * added to `textStyle` so color / letter-spacing / font-size coexist on one span.
 */
export const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontSize || null,
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs.fontSize ? { style: `font-size: ${attrs.fontSize as string}` } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).run(),
    };
  },
});

export const FONT_SIZES: { label: string; value: string }[] = [
  { label: 'Default', value: '' },
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
  { label: '30', value: '30px' },
  { label: '36', value: '36px' },
  { label: '48', value: '48px' },
];

/** Compact font-size `<select>` for Tiptap toolbars. */
export function FontSizeControl({ editor }: { editor: Editor }) {
  const active = (editor.getAttributes('textStyle') as { fontSize?: string }).fontSize ?? '';
  return (
    <>
      <label className="text-[10px] text-slate-400 mr-0.5 select-none" title="Font size">
        A<span className="text-[8px]">A</span>
      </label>
      <select
        title="Font size"
        value={active}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const v = e.target.value;
          if (v) {
            editor.chain().focus().setFontSize(v).run();
          } else {
            editor.chain().focus().unsetFontSize().run();
          }
        }}
        className="h-6 rounded border border-slate-200 bg-white px-0.5 text-[10px] text-slate-600 hover:border-slate-300 cursor-pointer"
      >
        {FONT_SIZES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </>
  );
}

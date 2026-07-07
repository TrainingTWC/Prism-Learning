import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Bold, Italic } from 'lucide-react';
import { FontSize, FontSizeControl } from '~/lib/tiptap/fontSize';

/**
 * Compact shared rich-text caption editor (image + gallery captions).
 *
 * Backward compatible with legacy plain-string captions: seeds Tiptap with a
 * `<p>` wrapper when the value contains no HTML, and strips the outer `<p>`
 * on save so captions persist as inline HTML (same pattern as the Tabs
 * InlineLabelEditor).
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
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        horizontalRule: false,
        hardBreak: false,
      }),
      Placeholder.configure({ placeholder: placeholder ?? 'Caption…' }),
      Underline,
      TextStyle,
      Color,
      FontSize,
    ],
    content: value.includes('<') ? value : value ? `<p>${value}</p>` : '',
    onUpdate: ({ editor }) => {
      // Strip outer <p> wrapper so the caption stays inline HTML
      const raw = editor.getHTML();
      const stripped = raw.replace(/^<p>([\s\S]*)<\/p>$/, '$1');
      onChange(stripped);
    },
    editorProps: {
      attributes: { class: 'outline-none text-xs text-[var(--text-primary,#334155)] min-h-[20px]' },
    },
  });

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-0.5 border-b border-slate-100 bg-slate-50 px-1.5 py-0.5">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
          className={`rounded p-1 ${editor.isActive('bold') ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-200'}`}
          title="Bold"
        >
          <Bold className="size-3" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
          className={`rounded p-1 ${editor.isActive('italic') ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-200'}`}
          title="Italic"
        >
          <Italic className="size-3" />
        </button>
        <input
          type="color"
          defaultValue="#000000"
          className="h-4 w-4 cursor-pointer rounded border border-slate-200 bg-transparent p-0"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          title="Text color"
        />
        <div className="ml-0.5 flex items-center gap-0.5">
          <FontSizeControl editor={editor} />
        </div>
      </div>
      <div className="px-2 py-1.5">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

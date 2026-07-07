import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Bold, Italic } from 'lucide-react';
import { FontSize, FontSizeControl } from '~/lib/tiptap/fontSize';

/**
 * Generalized compact rich-text field shared by every authorable text surface
 * that needs bold/italic/color/font-size formatting: captions, accordion
 * bodies, callout copy, quote text, flashcard faces, process steps, and quiz
 * question/option/feedback text.
 *
 * Backward compatible with legacy plain-string content: seeds Tiptap with a
 * `<p>` wrapper when the value contains no HTML tags (same pattern as the
 * original CaptionEditor / Tabs InlineLabelEditor).
 *
 * - `multiline=false` (default): a single logical line. Paragraph splitting
 *   and hard breaks are disabled and the outer `<p>` wrapper is stripped on
 *   save, so the field stores bare inline HTML (spans/marks only) — matches
 *   the original CaptionEditor behavior (titles, attribution, option text,
 *   feedback).
 * - `multiline=true`: paragraphs + hard breaks (Shift+Enter) are allowed and
 *   the full HTML (including `<p>`/`<br>`) is stored as-is (accordion/callout
 *   bodies, quote text, flashcard faces, process step bodies, MCQ question,
 *   TrueFalse statement).
 */
export function InlineRichText({
  value,
  onChange,
  placeholder,
  multiline = false,
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
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
        hardBreak: multiline ? {} : false,
      }),
      Placeholder.configure({ placeholder: placeholder ?? (multiline ? 'Enter text…' : 'Text…') }),
      Underline,
      TextStyle,
      Color,
      FontSize,
    ],
    content: value.includes('<') ? value : value ? `<p>${value}</p>` : '',
    onUpdate: ({ editor }) => {
      if (editor.isEmpty) {
        onChange('');
        return;
      }
      const raw = editor.getHTML();
      if (multiline) {
        onChange(raw);
        return;
      }
      // Strip outer <p> wrapper so single-line fields stay inline HTML
      const stripped = raw.replace(/^<p>([\s\S]*)<\/p>$/, '$1');
      onChange(stripped);
    },
    editorProps: {
      attributes: {
        class: `outline-none text-[var(--text-primary,#334155)] ${multiline ? 'text-sm min-h-[48px]' : 'text-xs min-h-[20px]'}`,
      },
    },
  });

  if (!editor) return null;

  return (
    <div className={`rounded-lg border border-slate-200 bg-white overflow-hidden ${className ?? ''}`}>
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
      <div className={multiline ? 'px-3 py-2' : 'px-2 py-1.5'}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

import { useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { FontSize, FontSizeControl } from '~/lib/tiptap/fontSize';
import {
  Bold,
  Italic,
  UnderlineIcon,
  List,
  ListOrdered,
  Link2,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Baseline,
} from 'lucide-react';

// ── Custom line-height extension (block-level) ─────────────────────────────
const LineHeight = Extension.create({
  name: 'lineHeight',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (el: HTMLElement) => (el as HTMLElement).style.lineHeight || null,
          renderHTML: (attrs: Record<string, unknown>) =>
            attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight as string}` } : {},
        },
      },
    }];
  },
});

// ── Custom letter-spacing extension (inline via TextStyle) ─────────────────
const LetterSpacing = Extension.create({
  name: 'letterSpacing',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        letterSpacing: {
          default: null,
          parseHTML: (el: HTMLElement) => (el as HTMLElement).style.letterSpacing || null,
          renderHTML: (attrs: Record<string, unknown>) =>
            attrs.letterSpacing ? { style: `letter-spacing: ${attrs.letterSpacing as string}` } : {},
        },
      },
    }];
  },
});

// ── LINE_HEIGHTS / LETTER_SPACINGS options ─────────────────────────────────
const LINE_HEIGHTS = [
  { label: 'Normal', value: '' },
  { label: '1.0', value: '1' },
  { label: '1.25', value: '1.25' },
  { label: '1.5', value: '1.5' },
  { label: '1.75', value: '1.75' },
  { label: '2.0', value: '2' },
  { label: '2.5', value: '2.5' },
];

const LETTER_SPACINGS = [
  { label: 'Normal', value: '' },
  { label: 'Tight', value: '-0.02em' },
  { label: 'Wide', value: '0.05em' },
  { label: 'Wider', value: '0.1em' },
  { label: 'Widest', value: '0.2em' },
];

interface RichTextBlockEditorProps {
  blockId: string;
  initialContent: string;
  onSave: (html: string) => void;
  autoFocus?: boolean;
}

export function RichTextBlockEditor({
  blockId,
  initialContent,
  onSave,
  autoFocus,
}: RichTextBlockEditorProps) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing…' }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Subscript,
      Superscript,
      LineHeight,
      LetterSpacing,
      FontSize,
    ],
    content: initialContent,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[3rem] focus:outline-none px-4 py-3 text-slate-800',
      },
    },
    onUpdate: ({ editor }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        onSave(editor.getHTML());
      }, 800);
    },
  });

  const prevBlockId = useRef(blockId);
  useEffect(() => {
    if (!editor) return;
    if (prevBlockId.current !== blockId) {
      editor.commands.setContent(initialContent);
      prevBlockId.current = blockId;
    }
  }, [blockId, editor, initialContent]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        if (editor) onSave(editor.getHTML());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = useCallback(
    (command: () => boolean) => {
      command();
      editor?.commands.focus();
    },
    [editor],
  );

  if (!editor) return null;

  // Derived state helpers
  const paraLineHeight = (editor.getAttributes('paragraph').lineHeight as string | null) ?? '';
  const headLineHeight = (editor.getAttributes('heading').lineHeight as string | null) ?? '';
  const activeLineHeight = paraLineHeight || headLineHeight;
  const activeLetterSpacing = (editor.getAttributes('textStyle') as { letterSpacing?: string }).letterSpacing ?? '';

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm focus-within:border-indigo-300 focus-within:shadow-md transition-shadow">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 px-2 py-1.5">
        {/* Headings */}
        <ToolbarBtn
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => handleToggle(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
          title="Heading 1"
        ><Heading1 className="size-3.5" /></ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => handleToggle(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
          title="Heading 2"
        ><Heading2 className="size-3.5" /></ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => handleToggle(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
          title="Heading 3"
        ><Heading3 className="size-3.5" /></ToolbarBtn>
        <Divider />
        {/* Inline formatting */}
        <ToolbarBtn active={editor.isActive('bold')} onClick={() => handleToggle(() => editor.chain().focus().toggleBold().run())} title="Bold (⌘B)">
          <Bold className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('italic')} onClick={() => handleToggle(() => editor.chain().focus().toggleItalic().run())} title="Italic (⌘I)">
          <Italic className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('underline')} onClick={() => handleToggle(() => editor.chain().focus().toggleUnderline().run())} title="Underline (⌘U)">
          <UnderlineIcon className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('subscript')} onClick={() => handleToggle(() => editor.chain().focus().toggleSubscript().run())} title="Subscript">
          <span className="text-[11px] font-medium leading-none">X<sub>2</sub></span>
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('superscript')} onClick={() => handleToggle(() => editor.chain().focus().toggleSuperscript().run())} title="Superscript">
          <span className="text-[11px] font-medium leading-none">X<sup>2</sup></span>
        </ToolbarBtn>
        <Divider />
        {/* Lists */}
        <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => handleToggle(() => editor.chain().focus().toggleBulletList().run())} title="Bullet list">
          <List className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => handleToggle(() => editor.chain().focus().toggleOrderedList().run())} title="Ordered list">
          <ListOrdered className="size-3.5" />
        </ToolbarBtn>
        <Divider />
        {/* Link */}
        <ToolbarBtn
          active={editor.isActive('link')}
          onClick={() => {
            const url = window.prompt('URL:');
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          title="Link"
        ><Link2 className="size-3.5" /></ToolbarBtn>
        <Divider />
        {/* Alignment */}
        <ToolbarBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => handleToggle(() => editor.chain().focus().setTextAlign('left').run())} title="Align left">
          <AlignLeft className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => handleToggle(() => editor.chain().focus().setTextAlign('center').run())} title="Align center">
          <AlignCenter className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => handleToggle(() => editor.chain().focus().setTextAlign('right').run())} title="Align right">
          <AlignRight className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive({ textAlign: 'justify' })} onClick={() => handleToggle(() => editor.chain().focus().setTextAlign('justify').run())} title="Justify">
          <AlignJustify className="size-3.5" />
        </ToolbarBtn>
        <Divider />
        {/* Color */}
        <ColorPickerBtn
          color={(editor.getAttributes('textStyle') as { color?: string }).color ?? '#000000'}
          onChange={(color) => editor.chain().focus().setColor(color).run()}
          onClear={() => editor.chain().focus().unsetColor().run()}
        />
        <Divider />
        {/* Line height */}
        <label className="text-[10px] text-slate-400 mr-0.5 select-none" title="Line spacing">↕</label>
        <select
          title="Line height"
          value={activeLineHeight}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            const v = e.target.value;
            if (v) {
              editor.chain().focus().updateAttributes('paragraph', { lineHeight: v }).updateAttributes('heading', { lineHeight: v }).run();
            } else {
              editor.chain().focus().updateAttributes('paragraph', { lineHeight: null }).updateAttributes('heading', { lineHeight: null }).run();
            }
          }}
          className="h-6 rounded border border-slate-200 bg-white px-0.5 text-[10px] text-slate-600 hover:border-slate-300 cursor-pointer"
        >
          {LINE_HEIGHTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <Divider />
        {/* Letter spacing */}
        <label className="text-[10px] text-slate-400 mr-0.5 select-none" title="Letter spacing">AV</label>
        <select
          title="Letter spacing"
          value={activeLetterSpacing}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            const v = e.target.value;
            editor.chain().focus().setMark('textStyle', { letterSpacing: v || null }).run();
          }}
          className="h-6 rounded border border-slate-200 bg-white px-0.5 text-[10px] text-slate-600 hover:border-slate-300 cursor-pointer"
        >
          {LETTER_SPACINGS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <Divider />
        {/* Font size */}
        <FontSizeControl editor={editor} />
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarBtn({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`rounded p-1.5 transition-colors ${
        active
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-slate-200" />;
}

function ColorPickerBtn({
  color,
  onChange,
  onClear,
}: {
  color: string;
  onChange: (color: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="relative flex items-center">
      <label
        title="Text color"
        className="relative flex cursor-pointer items-center gap-0.5 rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
      >
        <Baseline className="size-3.5" />
        <span
          className="absolute bottom-1 left-1.5 right-1.5 h-0.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          title="Pick text color"
        />
      </label>
      <button
        type="button"
        title="Clear color"
        onMouseDown={(e) => {
          e.preventDefault();
          onClear();
        }}
        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 text-[10px] leading-none transition-colors"
      >
        ✕
      </button>
    </div>
  );
}


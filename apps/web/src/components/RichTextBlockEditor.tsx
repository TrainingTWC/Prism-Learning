import { useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
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

  // Sync external content changes (e.g. from another author) without clobbering local edits.
  // We only sync if the block ID changed (lesson switch) or if the editor is not focused.
  const prevBlockId = useRef(blockId);
  useEffect(() => {
    if (!editor) return;
    if (prevBlockId.current !== blockId) {
      editor.commands.setContent(initialContent);
      prevBlockId.current = blockId;
    }
  }, [blockId, editor, initialContent]);

  // Flush unsaved changes on unmount
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

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm focus-within:border-indigo-300 focus-within:shadow-md transition-shadow">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 px-2 py-1.5">
        <ToolbarBtn
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => handleToggle(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
          title="Heading 1"
        >
          <Heading1 className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => handleToggle(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
          title="Heading 2"
        >
          <Heading2 className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => handleToggle(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
          title="Heading 3"
        >
          <Heading3 className="size-3.5" />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn
          active={editor.isActive('bold')}
          onClick={() => handleToggle(() => editor.chain().focus().toggleBold().run())}
          title="Bold (⌘B)"
        >
          <Bold className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('italic')}
          onClick={() => handleToggle(() => editor.chain().focus().toggleItalic().run())}
          title="Italic (⌘I)"
        >
          <Italic className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('underline')}
          onClick={() => handleToggle(() => editor.chain().focus().toggleUnderline().run())}
          title="Underline (⌘U)"
        >
          <UnderlineIcon className="size-3.5" />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn
          active={editor.isActive('bulletList')}
          onClick={() => handleToggle(() => editor.chain().focus().toggleBulletList().run())}
          title="Bullet list"
        >
          <List className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('orderedList')}
          onClick={() => handleToggle(() => editor.chain().focus().toggleOrderedList().run())}
          title="Ordered list"
        >
          <ListOrdered className="size-3.5" />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn
          active={editor.isActive('link')}
          onClick={() => {
            const url = window.prompt('URL:');
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          title="Link"
        >
          <Link2 className="size-3.5" />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => handleToggle(() => editor.chain().focus().setTextAlign('left').run())}
          title="Align left"
        >
          <AlignLeft className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => handleToggle(() => editor.chain().focus().setTextAlign('center').run())}
          title="Align center"
        >
          <AlignCenter className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => handleToggle(() => editor.chain().focus().setTextAlign('right').run())}
          title="Align right"
        >
          <AlignRight className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive({ textAlign: 'justify' })}
          onClick={() => handleToggle(() => editor.chain().focus().setTextAlign('justify').run())}
          title="Justify"
        >
          <AlignJustify className="size-3.5" />
        </ToolbarBtn>
        <Divider />
        {/* Text color */}
        <ColorPickerBtn
          color={(editor.getAttributes('textStyle') as { color?: string }).color ?? '#000000'}
          onChange={(color) => editor.chain().focus().setColor(color).run()}
          onClear={() => editor.chain().focus().unsetColor().run()}
        />
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
        e.preventDefault(); // Don't blur editor
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

import { useState, useCallback, useEffect } from 'react';
import type { Id } from '~convex/_generated/dataModel';
import { PanelTop, Plus, Trash2, Bold, Italic, UnderlineIcon } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { MediaUpload } from './MediaUpload';
import { RichTextBlockEditor } from './RichTextBlockEditor';
import { FontSize, FontSizeControl } from '~/lib/tiptap/fontSize';

export type TabItem = {
  id: string;
  title: string;
  content: string;
  imageStorageId?: string;
  audioStorageId?: string;
};

export type TabsPayload = {
  tabs: TabItem[];
};

function uid() { return Math.random().toString(36).slice(2, 7); }

function parse(content?: string): TabsPayload {
  if (!content) return { tabs: [{ id: uid(), title: 'Tab 1', content: '' }, { id: uid(), title: 'Tab 2', content: '' }] };
  try { return JSON.parse(content) as TabsPayload; } catch {
    return { tabs: [{ id: uid(), title: 'Tab 1', content: '' }, { id: uid(), title: 'Tab 2', content: '' }] };
  }
}

// ── Mini inline label editor with Bold/Italic/Underline/Color ─────────────
function InlineLabelEditor({ value, onChange, tabId }: { value: string; onChange: (html: string) => void; tabId: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, blockquote: false, codeBlock: false,
        bulletList: false, orderedList: false, horizontalRule: false, hardBreak: false,
      }),
      Underline,
      TextStyle,
      Color,
      FontSize,
    ],
    content: value.includes('<') ? value : `<p>${value}</p>`,
    onUpdate: ({ editor }) => {
      // Strip outer <p> wrapper so label stays as inline HTML
      const raw = editor.getHTML();
      const stripped = raw.replace(/^<p>([\s\S]*)<\/p>$/, '$1');
      onChange(stripped);
    },
    editorProps: {
      attributes: { class: 'outline-none text-sm text-slate-700 min-h-[24px]' },
    },
  });

  // Reset editor when switching tabs
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const content = value.includes('<') ? value : `<p>${value}</p>`;
    editor.commands.setContent(content);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-0.5 border-b border-slate-100 bg-slate-50 px-2 py-1">
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
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
          className={`rounded p-1 ${editor.isActive('underline') ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-200'}`}
          title="Underline"
        >
          <UnderlineIcon className="size-3" />
        </button>
        <div className="ml-1 flex items-center gap-1">
          <span className="text-[10px] text-slate-400">Color:</span>
          <input
            type="color"
            defaultValue="#000000"
            className="h-5 w-5 cursor-pointer rounded border border-slate-200 bg-transparent p-0"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            title="Text color"
          />
        </div>
        <div className="ml-1 flex items-center gap-0.5">
          <FontSizeControl editor={editor} />
        </div>
      </div>
      <div className="px-3 py-2">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export function TabsBlockEditor({
  blockId: _blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const [payload, setPayload] = useState<TabsPayload>(() => parse(initialContent));
  const [activeIdx, setActiveIdx] = useState(0);

  const commit = useCallback((next: TabsPayload) => {
    setPayload(next);
    onSave(JSON.stringify(next));
  }, [onSave]);

  function updateTitle(id: string, title: string) {
    commit({ tabs: payload.tabs.map((t) => (t.id === id ? { ...t, title } : t)) });
  }

  function updateContent(id: string, content: string) {
    commit({ tabs: payload.tabs.map((t) => (t.id === id ? { ...t, content } : t)) });
  }

  function setMedia(id: string, field: 'imageStorageId' | 'audioStorageId', value: string | null) {
    commit({
      tabs: payload.tabs.map((t) =>
        t.id === id ? { ...t, [field]: value ?? undefined } : t,
      ),
    });
  }

  function addTab() {
    if (payload.tabs.length >= 8) return;
    const newIdx = payload.tabs.length;
    commit({ tabs: [...payload.tabs, { id: uid(), title: `Tab ${newIdx + 1}`, content: '' }] });
    setActiveIdx(newIdx);
  }

  function removeTab(id: string) {
    if (payload.tabs.length <= 1) return;
    const idx = payload.tabs.findIndex((t) => t.id === id);
    const remaining = payload.tabs.filter((t) => t.id !== id);
    commit({ tabs: remaining });
    setActiveIdx(Math.min(idx, remaining.length - 1));
  }

  const activeTab = payload.tabs[activeIdx];

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-violet-50/60 px-4 py-2.5">
        <PanelTop className="size-4 text-violet-500 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide text-violet-600">Tabs</span>
        <span className="ml-auto text-[11px] text-slate-400">{payload.tabs.length}/8 tabs</span>
      </div>

      {/* Tab selector */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50 px-3 py-2">
        {payload.tabs.map((tab, i) => (
          <div key={tab.id} className="group flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                activeIdx === i ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-200'
              }`}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: tab.title || `Tab ${i + 1}` }}
            />
            {payload.tabs.length > 1 && (
              <button
                type="button"
                onClick={() => removeTab(tab.id)}
                className="rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-400 opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="size-2.5" />
              </button>
            )}
          </div>
        ))}
        {payload.tabs.length < 8 && (
          <button
            type="button"
            onClick={addTab}
            className="ml-1 rounded p-1 text-slate-400 hover:bg-slate-200"
            title="Add tab"
          >
            <Plus className="size-3" />
          </button>
        )}
      </div>

      {/* Active tab editor */}
      {activeTab && (
        <div className="p-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Tab label</label>
            <InlineLabelEditor
              key={activeTab.id}
              tabId={activeTab.id}
              value={activeTab.title}
              onChange={(html) => updateTitle(activeTab.id, html)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Content</label>
            <RichTextBlockEditor
              key={activeTab.id}
              blockId={`tab-${_blockId}-${activeTab.id}`}
              initialContent={activeTab.content}
              onSave={(html) => updateContent(activeTab.id, html)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <MediaUpload
              accept="image/*"
              storageId={activeTab.imageStorageId ?? null}
              onChange={(id) => setMedia(activeTab.id, 'imageStorageId', id)}
              onClear={() => setMedia(activeTab.id, 'imageStorageId', null)}
            />
            <MediaUpload
              accept="audio/*"
              storageId={activeTab.audioStorageId ?? null}
              onChange={(id) => setMedia(activeTab.id, 'audioStorageId', id)}
              onClear={() => setMedia(activeTab.id, 'audioStorageId', null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useCallback } from 'react';
import type { Id } from '~convex/_generated/dataModel';
import { PanelTop, Plus, Trash2 } from 'lucide-react';

export type TabItem = {
  id: string;
  title: string;
  content: string;
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
            >
              {tab.title || `Tab ${i + 1}`}
            </button>
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
            <input
              type="text"
              value={activeTab.title}
              onChange={(e) => updateTitle(activeTab.id, e.target.value)}
              placeholder="Tab title"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Content</label>
            <textarea
              value={activeTab.content}
              onChange={(e) => updateContent(activeTab.id, e.target.value)}
              placeholder="Tab content…"
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

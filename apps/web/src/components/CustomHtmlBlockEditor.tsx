import { useState, useCallback } from 'react';
import type { Id } from '~convex/_generated/dataModel';
import { Code2 } from 'lucide-react';

export type CustomHtmlPayload = {
  html: string;
  notes: string;
};

function parse(content?: string): CustomHtmlPayload {
  if (!content) return { html: '', notes: '' };
  try { return JSON.parse(content) as CustomHtmlPayload; } catch { return { html: '', notes: '' }; }
}

export function CustomHtmlBlockEditor({
  blockId: _blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const [payload, setPayload] = useState<CustomHtmlPayload>(() => parse(initialContent));
  const [tab, setTab] = useState<'code' | 'notes'>('code');

  const commit = useCallback((next: CustomHtmlPayload) => {
    setPayload(next);
    onSave(JSON.stringify(next));
  }, [onSave]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-900 px-4 py-2.5">
        <Code2 className="size-4 text-slate-300 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Custom HTML</span>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => setTab('code')}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              tab === 'code' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            HTML
          </button>
          <button
            type="button"
            onClick={() => setTab('notes')}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              tab === 'notes' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Notes
          </button>
        </div>
      </div>

      {tab === 'code' ? (
        <>
          <textarea
            value={payload.html}
            onChange={(e) => commit({ ...payload, html: e.target.value })}
            placeholder={'<div class="my-custom-block">\n  <!-- Your HTML here -->\n</div>'}
            rows={10}
            spellCheck={false}
            className="w-full resize-y bg-slate-950 px-4 py-3 font-mono text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
            style={{ minHeight: '10rem' }}
          />
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2">
            <p className="text-[11px] text-slate-400">
              Raw HTML — runs unsanitized, scripts included, in both preview and the SCORM export.
            </p>
          </div>
        </>
      ) : (
        <div className="p-4">
          <label className="mb-1 block text-xs font-medium text-slate-500">Author notes</label>
          <textarea
            value={payload.notes}
            onChange={(e) => commit({ ...payload, notes: e.target.value })}
            placeholder="Describe what this block does, dependencies, etc…"
            rows={4}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        </div>
      )}
    </div>
  );
}

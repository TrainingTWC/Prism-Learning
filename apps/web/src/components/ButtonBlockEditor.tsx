import { useState, useCallback } from 'react';
import type { Id } from '~convex/_generated/dataModel';
import { MousePointerClick } from 'lucide-react';

type ButtonStyle = 'primary' | 'outline' | 'ghost';
type ButtonAlign = 'left' | 'center' | 'right';

export type ButtonPayload = {
  label: string;
  url: string;
  style: ButtonStyle;
  align: ButtonAlign;
};

function parse(content?: string): ButtonPayload {
  if (!content) return { label: '', url: '', style: 'primary', align: 'left' };
  try { return JSON.parse(content) as ButtonPayload; } catch { return { label: '', url: '', style: 'primary', align: 'left' }; }
}

const STYLE_OPTIONS: { value: ButtonStyle; label: string }[] = [
  { value: 'primary', label: 'Filled' },
  { value: 'outline', label: 'Outline' },
  { value: 'ghost',   label: 'Ghost' },
];

const ALIGN_OPTIONS: { value: ButtonAlign; label: string }[] = [
  { value: 'left',   label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right',  label: 'Right' },
];

export function ButtonBlockEditor({
  blockId: _blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const [payload, setPayload] = useState<ButtonPayload>(() => parse(initialContent));

  const commit = useCallback((next: ButtonPayload) => {
    setPayload(next);
    onSave(JSON.stringify(next));
  }, [onSave]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-emerald-50/60 px-4 py-2.5">
        <MousePointerClick className="size-4 text-emerald-500 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Button</span>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Label</label>
          <input
            type="text"
            value={payload.label}
            onChange={(e) => commit({ ...payload, label: e.target.value })}
            placeholder="Button text"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">URL (optional)</label>
          <input
            type="url"
            value={payload.url}
            onChange={(e) => commit({ ...payload, url: e.target.value })}
            placeholder="https://example.com"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div className="flex gap-4">
          {/* Style */}
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Style</label>
            <div className="flex gap-1.5">
              {STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => commit({ ...payload, style: opt.value })}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all ${
                    payload.style === opt.value
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Align */}
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Alignment</label>
            <div className="flex gap-1.5">
              {ALIGN_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => commit({ ...payload, align: opt.value })}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all ${
                    payload.align === opt.value
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        {payload.label && (
          <div className={`pt-2 ${payload.align === 'center' ? 'text-center' : payload.align === 'right' ? 'text-right' : 'text-left'}`}>
            <span
              className={`inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold ${
                payload.style === 'primary'
                  ? 'bg-indigo-600 text-white'
                  : payload.style === 'outline'
                    ? 'border-2 border-indigo-600 text-indigo-600'
                    : 'text-indigo-600 underline'
              }`}
            >
              {payload.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

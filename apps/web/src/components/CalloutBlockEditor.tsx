import { useState, useCallback } from 'react';
import type { Id } from '~convex/_generated/dataModel';
import { AlertCircle, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';

type Variant = 'info' | 'warning' | 'success' | 'tip';

export type CalloutPayload = {
  variant: Variant;
  title: string;
  body: string;
};

const VARIANT_OPTIONS: { value: Variant; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'info',    label: 'Info',    icon: <AlertCircle className="size-3.5" />,    color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { value: 'warning', label: 'Warning', icon: <AlertTriangle className="size-3.5" />,  color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { value: 'success', label: 'Success', icon: <CheckCircle className="size-3.5" />,    color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { value: 'tip',     label: 'Tip',     icon: <Lightbulb className="size-3.5" />,      color: 'text-purple-700 bg-purple-50 border-purple-200' },
];

function parse(content?: string): CalloutPayload {
  if (!content) return { variant: 'info', title: '', body: '' };
  try { return JSON.parse(content) as CalloutPayload; } catch { return { variant: 'info', title: '', body: '' }; }
}

export function CalloutBlockEditor({
  blockId: _blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const [payload, setPayload] = useState<CalloutPayload>(() => parse(initialContent));

  const commit = useCallback((next: CalloutPayload) => {
    setPayload(next);
    onSave(JSON.stringify(next));
  }, [onSave]);

  const currentVariant = VARIANT_OPTIONS.find((v) => v.value === payload.variant) ?? VARIANT_OPTIONS[0]!;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-amber-50/60 px-4 py-2.5">
        <AlertCircle className="size-4 text-amber-500 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-600">Callout</span>
      </div>
      <div className="p-4 space-y-3">
        {/* Variant selector */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Style</label>
          <div className="flex gap-2 flex-wrap">
            {VARIANT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => commit({ ...payload, variant: opt.value })}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                  payload.variant === opt.value ? opt.color : 'text-slate-500 bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Title (optional)</label>
          <input
            type="text"
            value={payload.title}
            onChange={(e) => commit({ ...payload, title: e.target.value })}
            placeholder="Callout heading"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Body</label>
          <textarea
            value={payload.body}
            onChange={(e) => commit({ ...payload, body: e.target.value })}
            placeholder="Callout body text…"
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        </div>

        {/* Live preview */}
        {(payload.title || payload.body) && (
          <div className={`flex gap-2.5 rounded-xl border px-4 py-3 ${currentVariant.color}`}>
            <span className="mt-0.5 shrink-0">{currentVariant.icon}</span>
            <div>
              {payload.title && <p className="font-semibold text-xs mb-0.5">{payload.title}</p>}
              {payload.body && <p className="text-xs leading-relaxed opacity-85">{payload.body}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

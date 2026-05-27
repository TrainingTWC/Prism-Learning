import { useState, useCallback } from 'react';
import type { Id } from '~convex/_generated/dataModel';
import { ToggleLeft } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
export type TrueFalsePayload = {
  statement: string;
  correctAnswer: boolean;
  trueFeedback: string;
  falseFeedback: string;
};

function defaultPayload(): TrueFalsePayload {
  return {
    statement: '',
    correctAnswer: true,
    trueFeedback: '',
    falseFeedback: '',
  };
}

function parse(content?: string): TrueFalsePayload {
  if (!content) return defaultPayload();
  try {
    return JSON.parse(content) as TrueFalsePayload;
  } catch {
    return defaultPayload();
  }
}

// ── Component ──────────────────────────────────────────────────────────────
export function TrueFalseBlockEditor({
  blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const [payload, setPayload] = useState<TrueFalsePayload>(() => parse(initialContent));

  const commit = useCallback(
    (next: TrueFalsePayload) => {
      setPayload(next);
      onSave(JSON.stringify(next));
    },
    [onSave],
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-violet-50/60 px-4 py-2.5">
        <ToggleLeft className="size-4 text-violet-500 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide text-violet-600">
          True / False
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Statement */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Statement
          </label>
          <textarea
            rows={2}
            value={payload.statement}
            onChange={(e) => commit({ ...payload, statement: e.target.value })}
            placeholder="Enter a true or false statement…"
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-200"
          />
        </div>

        {/* Correct answer selector */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Correct answer
          </label>
          <div className="flex gap-3">
            {([true, false] as const).map((val) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => commit({ ...payload, correctAnswer: val })}
                className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-semibold transition-colors ${
                  payload.correctAnswer === val
                    ? val
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : 'border-red-400 bg-red-50 text-red-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                {val ? 'True ✓' : 'False ✗'}
              </button>
            ))}
          </div>
        </div>

        {/* Feedback */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
              "True" feedback
            </label>
            <input
              type="text"
              value={payload.trueFeedback}
              onChange={(e) => commit({ ...payload, trueFeedback: e.target.value })}
              placeholder={`Shown when learner picks True…`}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-200"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
              "False" feedback
            </label>
            <input
              type="text"
              value={payload.falseFeedback}
              onChange={(e) => commit({ ...payload, falseFeedback: e.target.value })}
              placeholder={`Shown when learner picks False…`}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-200"
            />
          </div>
        </div>

        {/* Preview pill */}
        <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-500">
          Learner sees two buttons — <strong className="text-slate-700">True</strong> and{' '}
          <strong className="text-slate-700">False</strong> — then receives the matching feedback.
          Correct answer:{' '}
          <strong className={payload.correctAnswer ? 'text-emerald-600' : 'text-red-600'}>
            {payload.correctAnswer ? 'True' : 'False'}
          </strong>
        </div>
      </div>
    </div>
  );
}

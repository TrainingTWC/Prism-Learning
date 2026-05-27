import { useState, useCallback } from 'react';
import type { Id } from '~convex/_generated/dataModel';
import { Plus, Trash2, CheckCircle2, Circle, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
export type MCQOption = {
  id: string;
  text: string;
  isCorrect: boolean;
  feedback: string;
};

export type MCQPayload = {
  question: string;
  options: MCQOption[];
  multiSelect: boolean;
  /** Show per-option feedback in preview/export */
  showFeedback: boolean;
};

function emptyOption(id: string): MCQOption {
  return { id, text: '', isCorrect: false, feedback: '' };
}

function defaultPayload(): MCQPayload {
  return {
    question: '',
    options: [emptyOption('a'), emptyOption('b'), emptyOption('c')],
    multiSelect: false,
    showFeedback: true,
  };
}

function parse(content?: string): MCQPayload {
  if (!content) return defaultPayload();
  try {
    return JSON.parse(content) as MCQPayload;
  } catch {
    return defaultPayload();
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 7);
}

// ── Component ──────────────────────────────────────────────────────────────
export function MCQBlockEditor({
  blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const [payload, setPayload] = useState<MCQPayload>(() => parse(initialContent));
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null);

  const commit = useCallback(
    (next: MCQPayload) => {
      setPayload(next);
      onSave(JSON.stringify(next));
    },
    [onSave],
  );

  function setQuestion(q: string) {
    commit({ ...payload, question: q });
  }

  function toggleMultiSelect() {
    // If switching to single, ensure at most one correct answer
    const next = !payload.multiSelect;
    let options = payload.options;
    if (!next) {
      const firstCorrect = options.findIndex((o) => o.isCorrect);
      options = options.map((o, i) => ({ ...o, isCorrect: i === firstCorrect }));
    }
    commit({ ...payload, multiSelect: next, options });
  }

  function setOptionText(id: string, text: string) {
    commit({ ...payload, options: payload.options.map((o) => (o.id === id ? { ...o, text } : o)) });
  }

  function setOptionFeedback(id: string, feedback: string) {
    commit({ ...payload, options: payload.options.map((o) => (o.id === id ? { ...o, feedback } : o)) });
  }

  function toggleCorrect(id: string) {
    let options: MCQOption[];
    if (payload.multiSelect) {
      options = payload.options.map((o) => (o.id === id ? { ...o, isCorrect: !o.isCorrect } : o));
    } else {
      options = payload.options.map((o) => ({ ...o, isCorrect: o.id === id }));
    }
    commit({ ...payload, options });
  }

  function addOption() {
    if (payload.options.length >= 6) return;
    commit({ ...payload, options: [...payload.options, emptyOption(uid())] });
  }

  function removeOption(id: string) {
    if (payload.options.length <= 2) return;
    commit({ ...payload, options: payload.options.filter((o) => o.id !== id) });
  }

  const correctCount = payload.options.filter((o) => o.isCorrect).length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-indigo-50/60 px-4 py-2.5">
        <CheckCircle2 className="size-4 text-indigo-500 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          Multiple Choice
        </span>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={payload.multiSelect}
              onChange={toggleMultiSelect}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs text-slate-600">Multi-select</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={payload.showFeedback}
              onChange={() => commit({ ...payload, showFeedback: !payload.showFeedback })}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs text-slate-600">Show feedback</span>
          </label>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Question */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Question
          </label>
          <textarea
            rows={2}
            value={payload.question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter the question…"
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
          />
        </div>

        {/* Options */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Options
              {correctCount === 0 && (
                <span className="ml-2 text-amber-500 normal-case font-normal">
                  (mark at least one correct)
                </span>
              )}
            </label>
            <span className="text-[11px] text-slate-400">{payload.options.length}/6</span>
          </div>

          <div className="space-y-2">
            {payload.options.map((opt) => (
              <div key={opt.id} className="group">
                <div
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                    opt.isCorrect
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <GripVertical className="size-3.5 text-slate-300 shrink-0 cursor-grab" />

                  {/* Correct toggle */}
                  <button
                    type="button"
                    onClick={() => toggleCorrect(opt.id)}
                    title={opt.isCorrect ? 'Mark incorrect' : 'Mark correct'}
                    className="shrink-0"
                  >
                    {opt.isCorrect ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : (
                      <Circle className="size-4 text-slate-300 hover:text-slate-400" />
                    )}
                  </button>

                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => setOptionText(opt.id, e.target.value)}
                    placeholder={`Option ${opt.id.toUpperCase()}…`}
                    className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
                  />

                  {/* Feedback toggle */}
                  {payload.showFeedback && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedFeedback(expandedFeedback === opt.id ? null : opt.id)
                      }
                      className="shrink-0 text-slate-300 hover:text-slate-500 transition-colors"
                      title="Edit feedback"
                    >
                      {expandedFeedback === opt.id ? (
                        <ChevronUp className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => removeOption(opt.id)}
                    disabled={payload.options.length <= 2}
                    className="shrink-0 text-slate-300 hover:text-red-400 disabled:opacity-30 transition-colors"
                    title="Remove option"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                {/* Feedback row */}
                {payload.showFeedback && expandedFeedback === opt.id && (
                  <div className="mt-1 ml-10 mr-2">
                    <input
                      type="text"
                      value={opt.feedback}
                      onChange={(e) => setOptionFeedback(opt.id, e.target.value)}
                      placeholder="Feedback shown after selection…"
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {payload.options.length < 6 && (
            <button
              type="button"
              onClick={addOption}
              className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800"
            >
              <Plus className="size-3.5" /> Add option
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

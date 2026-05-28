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
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-indigo-50/60 px-4 py-3">
        <CheckCircle2 className="size-5 text-indigo-500 shrink-0" />
        <span className="text-sm font-bold uppercase tracking-wide text-indigo-600">
          Multiple Choice
        </span>
        <div className="ml-auto flex items-center gap-4">
          {/* Toggle switch – Multi-select */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span
              role="switch"
              aria-checked={payload.multiSelect}
              onClick={toggleMultiSelect}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                payload.multiSelect ? 'bg-indigo-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                  payload.multiSelect ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </span>
            <span className="text-sm font-medium text-slate-700">Multi-select</span>
          </label>
          {/* Toggle switch – Show feedback */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span
              role="switch"
              aria-checked={payload.showFeedback}
              onClick={() => commit({ ...payload, showFeedback: !payload.showFeedback })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                payload.showFeedback ? 'bg-indigo-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                  payload.showFeedback ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </span>
            <span className="text-sm font-medium text-slate-700">Show feedback</span>
          </label>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Question */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Question
          </label>
          <textarea
            rows={3}
            value={payload.question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter the question…"
            className="w-full resize-none rounded-lg border border-slate-200 px-4 py-3 text-base text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {/* Options */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Options
              {correctCount === 0 && (
                <span className="ml-2 text-amber-500 normal-case font-normal text-xs">
                  — mark at least one correct
                </span>
              )}
            </label>
            <span className="text-xs font-semibold text-slate-400">{payload.options.length}/6</span>
          </div>

          <div className="space-y-2">
            {payload.options.map((opt) => (
              <div key={opt.id} className="group">
                <div
                  className={`flex items-center gap-3 rounded-xl border-2 px-3 py-3 transition-colors ${
                    opt.isCorrect
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <GripVertical className="size-5 text-slate-300 shrink-0 cursor-grab" />

                  {/* Correct toggle */}
                  <button
                    type="button"
                    onClick={() => toggleCorrect(opt.id)}
                    title={opt.isCorrect ? 'Mark incorrect' : 'Mark correct'}
                    className="shrink-0 rounded-full p-0.5 transition-transform hover:scale-110"
                  >
                    {opt.isCorrect ? (
                      <CheckCircle2 className="size-6 text-emerald-500" />
                    ) : (
                      <Circle className="size-6 text-slate-300 hover:text-slate-400" />
                    )}
                  </button>

                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => setOptionText(opt.id, e.target.value)}
                    placeholder={`Option ${opt.id.toUpperCase()}…`}
                    className="flex-1 bg-transparent text-base text-slate-700 placeholder-slate-400 outline-none"
                  />

                  {/* Feedback toggle */}
                  {payload.showFeedback && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedFeedback(expandedFeedback === opt.id ? null : opt.id)
                      }
                      className={`shrink-0 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                        expandedFeedback === opt.id
                          ? 'bg-indigo-100 text-indigo-600'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                      }`}
                      title="Edit feedback"
                    >
                      {expandedFeedback === opt.id ? (
                        <span className="flex items-center gap-1"><ChevronUp className="size-4" />Feedback</span>
                      ) : (
                        <span className="flex items-center gap-1"><ChevronDown className="size-4" />Feedback</span>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => removeOption(opt.id)}
                    disabled={payload.options.length <= 2}
                    className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-400 disabled:opacity-30 transition-colors"
                    title="Remove option"
                  >
                    <Trash2 className="size-5" />
                  </button>
                </div>

                {/* Feedback row */}
                {payload.showFeedback && expandedFeedback === opt.id && (
                  <div className="mt-1.5 ml-12 mr-2">
                    <input
                      type="text"
                      value={opt.feedback}
                      onChange={(e) => setOptionFeedback(opt.id, e.target.value)}
                      placeholder="Feedback shown after selection…"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
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
              className="mt-3 flex items-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 px-4 py-2.5 text-sm font-semibold text-indigo-500 transition-colors hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 w-full justify-center"
            >
              <Plus className="size-4" /> Add option
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

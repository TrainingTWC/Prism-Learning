import { useState } from 'react';
import type { MCQBlock } from './types';

interface MCQOption {
  id: string;
  text: string;
  isCorrect: boolean;
  feedback?: string;
}

interface MCQPayload {
  question?: string;
  options?: MCQOption[];
  multiSelect?: boolean;
  showFeedback?: boolean;
}

interface Props {
  block: MCQBlock;
}

const correctStyle: React.CSSProperties = {
  borderColor: 'var(--prism-correct, #16a34a)',
  backgroundColor: 'color-mix(in srgb, var(--prism-correct, #16a34a) 10%, white)',
  color: 'color-mix(in srgb, var(--prism-correct, #16a34a) 70%, #0f172a)',
};
const incorrectStyle: React.CSSProperties = {
  borderColor: 'var(--prism-incorrect, #dc2626)',
  backgroundColor: 'color-mix(in srgb, var(--prism-incorrect, #dc2626) 10%, white)',
  color: 'color-mix(in srgb, var(--prism-incorrect, #dc2626) 70%, #0f172a)',
};

export function MCQBlockRenderer({ block }: Props) {
  let payload: MCQPayload = {};
  try { payload = JSON.parse(block.content) as MCQPayload; } catch { /* empty */ }

  const { question = '', options = [], multiSelect = false, showFeedback = true } = payload;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const toggle = (id: string) => {
    if (submitted) return;
    if (multiSelect) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelected(new Set([id]));
    }
  };

  const handleSubmit = () => {
    if (selected.size === 0) return;
    setSubmitted(true);
  };

  const handleReset = () => {
    setSelected(new Set());
    setSubmitted(false);
  };

  const isCorrect = (id: string) => options.find((o) => o.id === id)?.isCorrect ?? false;
  const allCorrect = submitted && [...selected].every(isCorrect) && options.filter((o) => o.isCorrect).every((o) => selected.has(o.id));

  return (
    <div className="prism-mcq my-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
      <p className="mb-4 font-semibold text-slate-800">{question}</p>
      <div className="space-y-2">
        {options.map((opt) => {
          const isSelected = selected.has(opt.id);
          const showResult = submitted && isSelected;
          const correct = opt.isCorrect;

          let optClass =
            'flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 text-sm transition';
          let optStyle: React.CSSProperties = {};
          if (submitted) {
            if (isSelected && correct) { optStyle = correctStyle; }
            else if (isSelected)       { optStyle = incorrectStyle; }
            else { optClass += ' border-slate-200 bg-white text-slate-500'; }
          } else {
            optClass += isSelected
              ? ' border-indigo-400 bg-indigo-50 text-indigo-800'
              : ' border-slate-200 bg-white text-slate-700 hover:border-slate-300';
          }

          return (
            <div key={opt.id}>
              <button
                type="button"
                onClick={() => toggle(opt.id)}
                style={optStyle}
                className={optClass + ' w-full text-left'}
              >
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    isSelected ? 'border-current' : 'border-slate-300'
                  }`}
                >
                  {isSelected ? (correct ? '✓' : '✗') : ''}
                </span>
                <span className="flex-1">{opt.text}</span>
              </button>
              {showResult && showFeedback && opt.feedback && (
                <p
                  className="mt-1 ml-8 text-xs"
                  style={{ color: correct ? 'var(--prism-correct, #16a34a)' : 'var(--prism-incorrect, #dc2626)' }}
                >
                  {opt.feedback}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        {!submitted ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selected.size === 0}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            Submit
          </button>
        ) : (
          <>
            <span
              className="text-sm font-medium"
              style={{ color: allCorrect ? 'var(--prism-correct, #16a34a)' : 'var(--prism-incorrect, #dc2626)' }}
            >
              {allCorrect ? '✓ Correct!' : '✗ Not quite.'}
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="text-sm text-indigo-600 hover:underline"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

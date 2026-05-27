import { useState } from 'react';
import type { TrueFalseBlock } from './types';

interface TFPayload {
  statement?: string;
  correctAnswer?: boolean;
  trueFeedback?: string;
  falseFeedback?: string;
}

interface Props {
  block: TrueFalseBlock;
}

export function TrueFalseBlockRenderer({ block }: Props) {
  let payload: TFPayload = {};
  try { payload = JSON.parse(block.content) as TFPayload; } catch { /* empty */ }

  const { statement = '', correctAnswer = true, trueFeedback = '', falseFeedback = '' } = payload;

  const [answer, setAnswer] = useState<boolean | null>(null);

  const handleAnswer = (val: boolean) => {
    if (answer !== null) return;
    setAnswer(val);
  };

  const isRight = answer === correctAnswer;
  const feedback = answer === true ? trueFeedback : falseFeedback;

  return (
    <div className="prism-true-false my-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
      <p className="mb-5 font-semibold text-slate-800">{statement}</p>
      <div className="flex gap-3">
        {[true, false].map((val) => {
          const label = val ? 'True' : 'False';
          let cls = 'flex-1 rounded-lg border-2 py-3 text-sm font-semibold transition';
          if (answer === null) {
            cls += ' border-slate-200 bg-white text-slate-700 hover:border-slate-300 cursor-pointer';
          } else if (answer === val) {
            cls += isRight
              ? ' border-emerald-400 bg-emerald-50 text-emerald-700'
              : ' border-red-400 bg-red-50 text-red-700';
          } else {
            cls += ' border-slate-200 bg-white text-slate-400 opacity-60';
          }
          return (
            <button
              key={label}
              type="button"
              onClick={() => handleAnswer(val)}
              className={cls}
            >
              {label}
            </button>
          );
        })}
      </div>
      {answer !== null && (
        <div className={`mt-4 text-sm ${isRight ? 'text-emerald-600' : 'text-red-600'}`}>
          {isRight ? '✓ Correct! ' : '✗ Not quite. '}
          {feedback}
        </div>
      )}
      {answer !== null && (
        <button
          type="button"
          onClick={() => setAnswer(null)}
          className="mt-2 text-xs text-indigo-600 hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}

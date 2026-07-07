import { useState } from 'react';
import type { TrueFalseBlock } from './types';
import { sanitizeInline } from './sanitizeInline';

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
    <div className="prism-true-false my-6 rounded-2xl border border-slate-200 bg-slate-50/90 p-5 shadow-sm sm:p-6">
      <p
        className="mb-5 text-base font-semibold leading-6 text-slate-800"
        // eslint-disable-next-line react/no-danger -- sanitized via sanitizeInline
        dangerouslySetInnerHTML={{ __html: sanitizeInline(statement) }}
      />
      <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
        {[true, false].map((val) => {
          const label = val ? 'True' : 'False';
          let cls = 'prism-pressable min-h-12 rounded-xl border-2 py-3 text-sm font-semibold shadow-sm';
          let style: React.CSSProperties = {};
          if (answer === null) {
            cls += ' border-slate-200 bg-white text-slate-700 hover:border-slate-300 cursor-pointer';
          } else if (answer === val) {
            cls += isRight
              ? ' border-2'
              : ' border-2';
            style = isRight
              ? { borderColor: 'var(--prism-correct, #16a34a)', backgroundColor: 'color-mix(in srgb, var(--prism-correct, #16a34a) 10%, white)', color: 'color-mix(in srgb, var(--prism-correct, #16a34a) 70%, #0f172a)' }
              : { borderColor: 'var(--prism-incorrect, #dc2626)', backgroundColor: 'color-mix(in srgb, var(--prism-incorrect, #dc2626) 10%, white)', color: 'color-mix(in srgb, var(--prism-incorrect, #dc2626) 70%, #0f172a)' };
          } else {
            cls += ' border-slate-200 bg-white text-slate-400 opacity-60';
          }
          return (
            <button
              key={label}
              type="button"
              onClick={() => handleAnswer(val)}
              style={style}
              className={cls}
            >
              {label}
            </button>
          );
        })}
      </div>
      {answer !== null && (
        <div
          className="prism-feedback-enter mt-4 rounded-xl bg-white/75 px-4 py-3 text-sm font-medium shadow-sm"
          style={{ color: isRight ? 'var(--prism-correct, #16a34a)' : 'var(--prism-incorrect, #dc2626)' }}
        >
          {isRight ? '✓ Correct! ' : '✗ Not quite. '}
          <span
            // eslint-disable-next-line react/no-danger -- sanitized via sanitizeInline
            dangerouslySetInnerHTML={{ __html: sanitizeInline(feedback) }}
          />
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

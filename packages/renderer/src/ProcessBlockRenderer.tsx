import type { ProcessBlock } from './types';
import { sanitizeInline } from './sanitizeInline';

interface Step {
  id: string;
  title: string;
  body: string;
}

interface Payload {
  steps?: Step[];
}

interface Props {
  block: ProcessBlock;
}

export function ProcessBlockRenderer({ block }: Props) {
  let payload: Payload = {};
  try { payload = JSON.parse(block.content) as Payload; } catch { /* empty */ }
  const steps = payload.steps ?? [];
  if (!steps.length) return null;

  return (
    <ol className="prism-process my-6 space-y-0 list-none">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li key={step.id} className="flex gap-4">
            {/* Step indicator + connector */}
            <div className="flex flex-col items-center" style={{ width: '2rem', flexShrink: 0 }}>
              <div
                className="flex size-8 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                style={{ background: 'var(--prism-primary, #4f46e5)' }}
              >
                {i + 1}
              </div>
              {!isLast && (
                <div style={{ width: '2px', flex: 1, minHeight: '1.5rem', background: 'linear-gradient(to bottom, var(--prism-primary, #4f46e5) 0%, #e2e8f0 100%)', opacity: 0.4, margin: '0.25rem 0' }} />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-6'}`}>
              <p className="font-semibold text-sm leading-none text-slate-800 mt-1">{step.title}</p>
              {step.body && (
                <p
                  className="mt-2 text-sm leading-relaxed text-slate-500"
                  // eslint-disable-next-line react/no-danger -- sanitized via sanitizeInline
                  dangerouslySetInnerHTML={{ __html: sanitizeInline(step.body) }}
                />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

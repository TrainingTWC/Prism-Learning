import { useState } from 'react';
import type { AccordionBlock } from './types';

interface Section {
  id: string;
  title: string;
  content: string;
}

interface AccordionPayload {
  sections?: Section[];
}

interface Props {
  block: AccordionBlock;
}

export function AccordionBlockRenderer({ block }: Props) {
  let payload: AccordionPayload = {};
  try { payload = JSON.parse(block.content) as AccordionPayload; } catch { /* empty */ }

  const sections = payload.sections ?? [];
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <div className="prism-accordion my-6 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {sections.map((s) => (
        <div key={s.id} className="bg-white">
          <button
            type="button"
            onClick={() => toggle(s.id)}
            className="prism-pressable flex min-h-12 w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold leading-6 text-slate-800 hover:bg-slate-50"
          >
            {s.title}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`size-4 shrink-0 text-slate-400 transition-transform ${open.has(s.id) ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className="prism-accordion-panel" data-open={open.has(s.id)}>
            <div>
              <div className="border-t border-slate-100 px-5 py-4 text-sm leading-relaxed text-slate-600">
                {s.content}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

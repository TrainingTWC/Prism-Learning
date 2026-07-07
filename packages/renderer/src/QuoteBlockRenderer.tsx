import type { QuoteBlock } from './types';
import { sanitizeInline } from './sanitizeInline';

interface Payload {
  text?: string;
  attribution?: string;
}

interface Props {
  block: QuoteBlock;
}

export function QuoteBlockRenderer({ block }: Props) {
  let payload: Payload = {};
  try { payload = JSON.parse(block.content) as Payload; } catch { /* empty */ }
  if (!payload.text) return null;

  return (
    <figure className="prism-quote my-6">
      <blockquote className="relative rounded-2xl border-l-4 border-[var(--prism-primary,#4f46e5)] bg-slate-50 py-5 pl-6 pr-5 shadow-sm">
        <svg
          aria-hidden="true"
          className="absolute left-4 top-4 size-5 text-[var(--prism-primary,#4f46e5)] opacity-30"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
        </svg>
        <p
          className="text-base leading-relaxed text-slate-700 italic"
          // eslint-disable-next-line react/no-danger -- sanitized via sanitizeInline
          dangerouslySetInnerHTML={{ __html: sanitizeInline(payload.text) }}
        />
      </blockquote>
      {payload.attribution && (
        <figcaption className="mt-3 flex items-center gap-2 pl-6">
          <span className="block h-px w-5 bg-slate-300" />
          <cite
            className="text-sm font-medium not-italic text-slate-500"
            // eslint-disable-next-line react/no-danger -- sanitized via sanitizeInline
            dangerouslySetInnerHTML={{ __html: sanitizeInline(payload.attribution) }}
          />
        </figcaption>
      )}
    </figure>
  );
}

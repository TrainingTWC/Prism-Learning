import { useState, useCallback } from 'react';
import type { Id } from '~convex/_generated/dataModel';
import { Quote } from 'lucide-react';
import { InlineRichText } from './InlineRichText';
import { sanitizeInline } from '~/lib/sanitizeInline';

export type QuotePayload = {
  text: string;
  attribution: string;
};

function parse(content?: string): QuotePayload {
  if (!content) return { text: '', attribution: '' };
  try { return JSON.parse(content) as QuotePayload; } catch { return { text: '', attribution: '' }; }
}

export function QuoteBlockEditor({
  blockId: _blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const [payload, setPayload] = useState<QuotePayload>(() => parse(initialContent));

  const commit = useCallback((next: QuotePayload) => {
    setPayload(next);
    onSave(JSON.stringify(next));
  }, [onSave]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-indigo-50/60 px-4 py-2.5">
        <Quote className="size-4 text-indigo-500 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Pull Quote</span>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Quote text</label>
          <InlineRichText
            value={payload.text}
            onChange={(html) => commit({ ...payload, text: html })}
            placeholder="Enter the quote text…"
            multiline
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Attribution (optional)</label>
          <InlineRichText
            value={payload.attribution}
            onChange={(html) => commit({ ...payload, attribution: html })}
            placeholder="— Name, Title"
          />
        </div>
        {/* Preview */}
        {payload.text && (
          <div className="mt-2 rounded-xl border-l-4 border-indigo-400 bg-slate-50 py-3 pl-4 pr-3">
            <p
              className="text-sm italic text-slate-600"
              // eslint-disable-next-line react/no-danger -- sanitized via sanitizeInline
              dangerouslySetInnerHTML={{ __html: sanitizeInline(payload.text) }}
            />
            {payload.attribution && (
              <p className="mt-1.5 text-xs font-medium text-slate-400">
                {'— '}
                <span
                  // eslint-disable-next-line react/no-danger -- sanitized via sanitizeInline
                  dangerouslySetInnerHTML={{ __html: sanitizeInline(payload.attribution) }}
                />
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

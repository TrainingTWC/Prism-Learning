import { useState } from 'react';
import type { FlashcardBlock } from './types';
import { sanitizeInline, stripHtml } from './sanitizeInline';

interface Card {
  id: string;
  front: string;
  back: string;
}

interface Payload {
  cards?: Card[];
}

interface Props {
  block: FlashcardBlock;
}

export function FlashcardBlockRenderer({ block }: Props) {
  let payload: Payload = {};
  try { payload = JSON.parse(block.content) as Payload; } catch { /* empty */ }
  const cards = payload.cards ?? [];

  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!cards.length) return null;

  const card = cards[cardIdx]!;
  const total = cards.length;

  return (
    <div className="prism-flashcard my-6 select-none">
      {/* Card */}
      <div
        role="button"
        tabIndex={0}
        aria-label={
          flipped
            ? `Back: ${stripHtml(card.back)}`
            : `Front: ${stripHtml(card.front)}. Click to reveal answer.`
        }
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setFlipped((f) => !f)}
        className="cursor-pointer rounded-2xl border-2 border-slate-200 bg-white shadow-md transition-shadow hover:shadow-lg active:scale-[0.99]"
        style={{ minHeight: '10rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center', transition: 'transform 0.15s ease' }}
      >
        <span
          className="mb-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
          style={{ background: flipped ? '#ecfdf5' : '#eff6ff', color: flipped ? '#059669' : '#2563eb' }}
        >
          {flipped ? 'Answer' : 'Question'}
        </span>
        <p
          className="text-base font-medium leading-relaxed text-slate-700"
          // eslint-disable-next-line react/no-danger -- sanitized via sanitizeInline
          dangerouslySetInnerHTML={{ __html: sanitizeInline(flipped ? card.back : card.front) }}
        />
        <p className="mt-3 text-xs text-slate-400">{flipped ? 'Click to see question' : 'Click to reveal answer'}</p>
      </div>

      {/* Navigation */}
      {total > 1 && (
        <div className="mt-3 flex items-center justify-between px-1">
          <button
            type="button"
            disabled={cardIdx === 0}
            onClick={() => { setCardIdx((i) => Math.max(0, i - 1)); setFlipped(false); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <span className="text-xs text-slate-400">{cardIdx + 1} / {total}</span>
          <button
            type="button"
            disabled={cardIdx === total - 1}
            onClick={() => { setCardIdx((i) => Math.min(total - 1, i + 1)); setFlipped(false); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

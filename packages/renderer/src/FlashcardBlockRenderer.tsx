import { useState } from 'react';
import type { FlashcardBlock, ResolveAsset } from './types';
import { sanitizeInline, stripHtml } from './sanitizeInline';

interface Card {
  id: string;
  front: string;
  back: string;
  imageStorageId?: string;
  audioStorageId?: string;
}

interface Payload {
  cards?: Card[];
}

interface Props {
  block: FlashcardBlock;
  resolveAsset: ResolveAsset;
}

function CardFace({
  label,
  labelBg,
  labelColor,
  html,
  imageSrc,
  audioSrc,
  hint,
  isBack,
}: {
  label: string;
  labelBg: string;
  labelColor: string;
  html: string;
  imageSrc?: string;
  audioSrc?: string;
  hint: string;
  isBack: boolean;
}) {
  return (
    <div
      className="prism-flashcard-face rounded-2xl border-2 border-slate-200 bg-white shadow-md"
      style={{
        gridRow: 1,
        gridColumn: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        textAlign: 'center',
        minHeight: '12rem',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: isBack ? 'rotateY(180deg)' : undefined,
      }}
    >
      <span
        className="mb-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
        style={{ background: labelBg, color: labelColor }}
      >
        {label}
      </span>
      {imageSrc && (
        <img
          src={imageSrc}
          alt=""
          className="mb-3 max-h-32 max-w-full rounded-lg object-contain"
        />
      )}
      <p
        className="text-base font-medium leading-relaxed text-slate-700"
        // eslint-disable-next-line react/no-danger -- sanitized via sanitizeInline
        dangerouslySetInnerHTML={{ __html: sanitizeInline(html) }}
      />
      {audioSrc && (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- transcript-free short clips
        <audio
          src={audioSrc}
          controls
          className="mt-3 h-8 w-full max-w-xs"
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <p className="mt-3 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

export function FlashcardBlockRenderer({ block, resolveAsset }: Props) {
  let payload: Payload = {};
  try { payload = JSON.parse(block.content) as Payload; } catch { /* empty */ }
  const cards = payload.cards ?? [];

  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!cards.length) return null;

  const card = cards[cardIdx]!;
  const total = cards.length;
  const imageSrc = card.imageStorageId ? resolveAsset(card.imageStorageId) : undefined;
  const audioSrc = card.audioStorageId ? resolveAsset(card.audioStorageId) : undefined;

  return (
    <div className="prism-flashcard my-6 select-none">
      <style>{`
        .prism-flashcard-scene { perspective: 1600px; }
        .prism-flashcard-inner { transition: transform 0.6s cubic-bezier(0.4, 0.15, 0.2, 1); transform-style: preserve-3d; }
      `}</style>
      <div
        className="prism-flashcard-scene"
        role="button"
        tabIndex={0}
        aria-label={
          flipped
            ? `Back: ${stripHtml(card.back)}`
            : `Front: ${stripHtml(card.front)}. Click to reveal answer.`
        }
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setFlipped((f) => !f)}
        style={{ minHeight: '12rem', cursor: 'pointer' }}
      >
        <div
          className="prism-flashcard-inner"
          style={{
            display: 'grid',
            width: '100%',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          <CardFace
            label="Question"
            labelBg="#eff6ff"
            labelColor="#2563eb"
            html={card.front}
            imageSrc={imageSrc}
            audioSrc={audioSrc}
            hint="Click to reveal answer"
            isBack={false}
          />
          <CardFace
            label="Answer"
            labelBg="#ecfdf5"
            labelColor="#059669"
            html={card.back}
            imageSrc={imageSrc}
            audioSrc={audioSrc}
            hint="Click to see question"
            isBack
          />
        </div>
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

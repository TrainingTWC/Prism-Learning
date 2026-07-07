import { useState, useCallback } from 'react';
import type { Id } from '~convex/_generated/dataModel';
import { CreditCard, Plus, Trash2, GripVertical } from 'lucide-react';
import { MediaUpload } from './MediaUpload';
import { InlineRichText } from './InlineRichText';
import { stripHtml } from '~/lib/sanitizeInline';

export type FlashCard = {
  id: string;
  front: string;
  back: string;
  imageStorageId?: string;
  audioStorageId?: string;
};

export type FlashcardPayload = {
  cards: FlashCard[];
};

function uid() { return Math.random().toString(36).slice(2, 7); }

function parse(content?: string): FlashcardPayload {
  if (!content) return { cards: [{ id: uid(), front: '', back: '' }] };
  try { return JSON.parse(content) as FlashcardPayload; } catch { return { cards: [{ id: uid(), front: '', back: '' }] }; }
}

export function FlashcardBlockEditor({
  blockId: _blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const [payload, setPayload] = useState<FlashcardPayload>(() => parse(initialContent));
  const [expandedId, setExpandedId] = useState<string | null>(() => parse(initialContent).cards[0]?.id ?? null);

  const commit = useCallback((next: FlashcardPayload) => {
    setPayload(next);
    onSave(JSON.stringify(next));
  }, [onSave]);

  function update(id: string, field: 'front' | 'back', value: string) {
    commit({ cards: payload.cards.map((c) => (c.id === id ? { ...c, [field]: value } : c)) });
  }

  function setMedia(id: string, field: 'imageStorageId' | 'audioStorageId', value: string | null) {
    commit({
      cards: payload.cards.map((c) =>
        c.id === id ? { ...c, [field]: value ?? undefined } : c,
      ),
    });
  }

  function addCard() {
    if (payload.cards.length >= 20) return;
    const newId = uid();
    commit({ cards: [...payload.cards, { id: newId, front: '', back: '' }] });
    setExpandedId(newId);
  }

  function removeCard(id: string) {
    if (payload.cards.length <= 1) return;
    const remaining = payload.cards.filter((c) => c.id !== id);
    commit({ cards: remaining });
    if (expandedId === id) setExpandedId(remaining[0]?.id ?? null);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-cyan-50/60 px-4 py-2.5">
        <CreditCard className="size-4 text-cyan-600 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Flashcards</span>
        <span className="ml-auto text-[11px] text-slate-400">{payload.cards.length}/20 cards</span>
      </div>

      <div className="divide-y divide-slate-100">
        {payload.cards.map((card, idx) => {
          const isOpen = expandedId === card.id;
          return (
            <div key={card.id} className="group">
              {/* Card header row */}
              <div className="flex items-center gap-2 px-3 py-2">
                <GripVertical className="size-3.5 text-slate-300 shrink-0" />
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : card.id)}
                  className="flex-1 text-left text-xs font-medium text-slate-600 hover:text-slate-800 truncate"
                >
                  Card {idx + 1}{card.front ? `: ${stripHtml(card.front).slice(0, 40)}${stripHtml(card.front).length > 40 ? '…' : ''}` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => removeCard(card.id)}
                  disabled={payload.cards.length <= 1}
                  className="ml-auto shrink-0 rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-400 disabled:opacity-30 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>

              {/* Expanded edit */}
              {isOpen && (
                <div className="px-4 pb-4 space-y-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Front (question)</label>
                    <InlineRichText
                      value={card.front}
                      onChange={(html) => update(card.id, 'front', html)}
                      placeholder="Question or prompt…"
                      multiline
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Back (answer)</label>
                    <InlineRichText
                      value={card.back}
                      onChange={(html) => update(card.id, 'back', html)}
                      placeholder="Answer or explanation…"
                      multiline
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <MediaUpload
                      accept="image/*"
                      storageId={card.imageStorageId ?? null}
                      onChange={(id) => setMedia(card.id, 'imageStorageId', id)}
                      onClear={() => setMedia(card.id, 'imageStorageId', null)}
                    />
                    <MediaUpload
                      accept="audio/*"
                      storageId={card.audioStorageId ?? null}
                      onChange={(id) => setMedia(card.id, 'audioStorageId', id)}
                      onClear={() => setMedia(card.id, 'audioStorageId', null)}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add card button */}
      <div className="px-4 py-3 border-t border-slate-100">
        <button
          type="button"
          onClick={addCard}
          disabled={payload.cards.length >= 20}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-40"
        >
          <Plus className="size-3.5" /> Add card
        </button>
      </div>
    </div>
  );
}

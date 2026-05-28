import { useState } from 'react';
import type { RevealCardsBlock, Theme } from './types';

type Card = { id: string; front: string; back: string };
type Payload = { columns: 2 | 3 | 4; cards: Card[] };

function parse(c: string): Payload | null { try { return JSON.parse(c) as Payload; } catch { return null; } }

export function RevealCardsBlockRenderer({ block, theme }: { block: RevealCardsBlock; theme: Theme }) {
  const p = parse(block.content);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  if (!p) return null;
  const accent = theme.accent || '#10b981';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${p.columns}, minmax(0,1fr))`, gap: 12 }}>
      {p.cards.map((c) => {
        const isFlipped = !!flipped[c.id];
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => setFlipped((f) => ({ ...f, [c.id]: !f[c.id] }))}
            style={{
              position: 'relative',
              minHeight: 140,
              border: 'none',
              borderRadius: 14,
              cursor: 'pointer',
              padding: 20,
              background: isFlipped ? accent : '#fff',
              color: isFlipped ? '#fff' : '#1a1a2e',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              fontSize: 16,
              fontWeight: 600,
              transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
              transform: isFlipped ? 'rotateY(0deg) scale(1.02)' : 'rotateY(0deg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            }}
          >
            <span>{isFlipped ? c.back : c.front}</span>
            <span style={{
              position: 'absolute', bottom: 8, right: 10,
              fontSize: 10, fontWeight: 700, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1,
            }}>{isFlipped ? 'Back' : 'Tap to reveal'}</span>
          </button>
        );
      })}
    </div>
  );
}

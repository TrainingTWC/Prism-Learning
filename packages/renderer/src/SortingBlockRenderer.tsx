import { useMemo, useState } from 'react';
import type { SortingBlock, Theme } from './types';

type Item = { id: string; text: string };
type Payload = { prompt: string; items: Item[] };

function parse(c: string): Payload | null { try { return JSON.parse(c) as Payload; } catch { return null; } }
function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
}

export function SortingBlockRenderer({ block, theme }: { block: SortingBlock; theme: Theme }) {
  const p = parse(block.content);
  const initialShuffled = useMemo(() => p ? shuffle(p.items) : [], [p]);
  const [order, setOrder] = useState<Item[]>(initialShuffled);
  const [checked, setChecked] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  if (!p) return null;
  const accent = theme.accent || '#10b981';
  const correctOrder = p.items.map((x) => x.id);
  const allCorrect = order.map((x) => x.id).every((id, i) => id === correctOrder[i]);

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setOrder((o) => {
      const from = o.findIndex((x) => x.id === dragId);
      const to = o.findIndex((x) => x.id === targetId);
      if (from < 0 || to < 0) return o;
      const next = [...o];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m!);
      return next;
    });
    setDragId(null);
  }

  return (
    <div style={{ border: `2px solid ${accent}33`, borderRadius: 12, padding: 16, background: `${accent}08` }}>
      {p.prompt && <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>{p.prompt}</p>}
      <div>
        {order.map((it, i) => {
          const isCorrect = checked && it.id === correctOrder[i];
          const isWrong = checked && it.id !== correctOrder[i];
          const borderColor = isCorrect ? '#10b981' : isWrong ? '#ef4444' : '#e2e8f0';
          return (
            <div
              key={it.id}
              draggable={!checked}
              onDragStart={() => setDragId(it.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(it.id)}
              onDragEnd={() => setDragId(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#fff', color: '#1a1a2e',
                borderRadius: 10, padding: 12, marginBottom: 8,
                border: `2px solid ${borderColor}`,
                cursor: checked ? 'default' : 'grab',
                boxShadow: dragId === it.id ? '0 8px 20px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'box-shadow 0.15s',
              }}
            >
              <span style={{ width: 28, height: 28, borderRadius: 8, background: accent, color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 14 }}>{it.text}</span>
              {!checked && <span style={{ color: '#94a3b8', fontSize: 18 }}>⋮⋮</span>}
              {checked && <span style={{ fontSize: 18 }}>{isCorrect ? '✓' : '✗'}</span>}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 12 }}>
        {checked && (
          <span style={{ fontSize: 13, fontWeight: 600, color: allCorrect ? '#10b981' : '#ef4444' }}>
            {allCorrect ? 'Correct order!' : 'Not quite — try again'}
          </span>
        )}
        {checked && <button type="button" onClick={() => { setChecked(false); setOrder(shuffle(p.items)); }} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 600, cursor: 'pointer' }}>Try again</button>}
        {!checked && <button type="button" onClick={() => setChecked(true)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Check order</button>}
      </div>
    </div>
  );
}

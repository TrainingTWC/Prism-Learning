import { useMemo, useState } from 'react';
import type { MatchingBlock, Theme } from './types';

type Pair = { id: string; term: string; definition: string };
type Payload = { pairs: Pair[] };

function parse(c: string): Payload | null { try { return JSON.parse(c) as Payload; } catch { return null; } }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function MatchingBlockRenderer({ block, theme }: { block: MatchingBlock; theme: Theme }) {
  const p = parse(block.content);
  const shuffled = useMemo(() => p ? shuffle(p.pairs.map((x) => ({ id: x.id, definition: x.definition }))) : [], [p]);
  const [matches, setMatches] = useState<Record<string, string>>({}); // termPairId -> defPairId
  const [checked, setChecked] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  if (!p) return null;
  const accent = theme.accent || '#10b981';

  function status(termId: string): 'correct' | 'wrong' | 'pending' {
    if (!checked) return 'pending';
    return matches[termId] === termId ? 'correct' : 'wrong';
  }

  return (
    <div style={{ border: `2px solid ${accent}33`, borderRadius: 12, padding: 16, background: `${accent}08` }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.6, marginBottom: 8 }}>Terms</div>
          {p.pairs.map((t) => {
            const droppedDefId = matches[t.id];
            const droppedDef = droppedDefId ? p.pairs.find((x) => x.id === droppedDefId) : null;
            const s = status(t.id);
            const borderColor = s === 'correct' ? '#10b981' : s === 'wrong' ? '#ef4444' : accent;
            return (
              <div
                key={t.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) setMatches((m) => ({ ...m, [t.id]: dragId }));
                  setDragId(null);
                }}
                style={{ background: '#fff', color: '#1a1a2e', borderRadius: 10, padding: 12, marginBottom: 8, border: `2px solid ${borderColor}`, display: 'flex', alignItems: 'center', gap: 12, minHeight: 60 }}
              >
                <strong style={{ fontSize: 14, flex: '0 0 auto' }}>{t.term}</strong>
                <span style={{ flex: 1, fontSize: 13, padding: '6px 10px', borderRadius: 6, background: droppedDef ? `${accent}15` : 'transparent', border: droppedDef ? 'none' : '1px dashed #cbd5e1', textAlign: 'center', color: droppedDef ? '#1a1a2e' : '#94a3b8' }}>
                  {droppedDef ? droppedDef.definition : 'Drop here'}
                </span>
              </div>
            );
          })}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.6, marginBottom: 8 }}>Definitions</div>
          {shuffled.filter((d) => !Object.values(matches).includes(d.id)).map((d) => (
            <div
              key={d.id}
              draggable
              onDragStart={() => setDragId(d.id)}
              onDragEnd={() => setDragId(null)}
              style={{ background: accent, color: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, cursor: 'grab', fontSize: 13, fontWeight: 500, boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}
            >
              {d.definition}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        {checked && <button type="button" onClick={() => { setChecked(false); setMatches({}); }} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 600, cursor: 'pointer' }}>Reset</button>}
        <button type="button" onClick={() => setChecked(true)} disabled={Object.keys(matches).length !== p.pairs.length} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: Object.keys(matches).length !== p.pairs.length ? 0.5 : 1 }}>Check</button>
      </div>
    </div>
  );
}

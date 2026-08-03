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
  // Tap-to-place selection — HTML5 drag never fires dragstart on touch devices,
  // so without this the block is uncompletable on phones (the exact viewport
  // this preview renders). Tap a definition to select it, tap a term to place
  // it, tap a filled term to send its definition back to the bank.
  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);

  if (!p) return null;
  const accent = theme.accent || '#10b981';

  function status(termId: string): 'correct' | 'wrong' | 'pending' {
    if (!checked) return 'pending';
    return matches[termId] === termId ? 'correct' : 'wrong';
  }

  function place(termId: string, defId: string) {
    setMatches((m) => ({ ...m, [termId]: defId }));
    setSelectedDefId(null);
  }

  function clearTerm(termId: string) {
    setMatches((m) => {
      const next = { ...m };
      delete next[termId];
      return next;
    });
  }

  function onTermClick(termId: string, hasMatch: boolean) {
    if (checked) return;
    if (selectedDefId) place(termId, selectedDefId);
    else if (hasMatch) clearTerm(termId);
  }

  return (
    <div style={{ border: `2px solid ${accent}33`, borderRadius: 12, padding: 16, background: `${accent}08` }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.6, marginBottom: 8 }}>Terms</div>
          {p.pairs.map((t) => {
            const droppedDefId = matches[t.id];
            const droppedDef = droppedDefId ? p.pairs.find((x) => x.id === droppedDefId) : null;
            const s = status(t.id);
            const borderColor = s === 'correct' ? '#10b981' : s === 'wrong' ? '#ef4444' : (selectedDefId ? accent : '#e2e8f0');
            return (
              <div
                key={t.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) place(t.id, dragId);
                  setDragId(null);
                }}
                onClick={() => onTermClick(t.id, !!droppedDef)}
                style={{ background: '#fff', color: '#1a1a2e', borderRadius: 10, padding: 12, marginBottom: 8, border: `2px solid ${borderColor}`, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', minHeight: 60, cursor: 'pointer' }}
              >
                <strong style={{ fontSize: 14, flex: '0 1 auto', minWidth: 0, overflowWrap: 'break-word' }}>{t.term}</strong>
                <span style={{ flex: '1 1 140px', minWidth: 0, fontSize: 13, padding: '6px 10px', borderRadius: 6, overflowWrap: 'break-word', background: droppedDef ? `${accent}15` : 'transparent', border: droppedDef ? 'none' : '1px dashed #cbd5e1', textAlign: 'center', color: droppedDef ? '#1a1a2e' : '#94a3b8' }}>
                  {droppedDef ? droppedDef.definition : 'Tap or drop'}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.6, marginBottom: 8 }}>Definitions</div>
          {shuffled.filter((d) => !Object.values(matches).includes(d.id)).map((d) => (
            <div
              key={d.id}
              draggable={!checked}
              onDragStart={() => setDragId(d.id)}
              onDragEnd={() => setDragId(null)}
              onClick={() => !checked && setSelectedDefId((cur) => (cur === d.id ? null : d.id))}
              style={{
                background: accent, color: '#fff', borderRadius: 10, padding: 12, marginBottom: 8,
                cursor: checked ? 'default' : 'grab', fontSize: 13, fontWeight: 500, overflowWrap: 'break-word',
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                outline: selectedDefId === d.id ? '3px solid rgba(0,0,0,0.35)' : 'none',
                outlineOffset: 2,
              }}
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

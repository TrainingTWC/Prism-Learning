import { useState, useMemo } from 'react';
import type { FillBlanksBlock, Theme } from './types';

type Payload = { template: string; answers: Record<string, string> };

function parse(c: string): Payload | null { try { return JSON.parse(c) as Payload; } catch { return null; } }

export function FillBlanksBlockRenderer({ block, theme }: { block: FillBlanksBlock; theme: Theme }) {
  const p = parse(block.content);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  const parts = useMemo(() => {
    if (!p) return [] as Array<{ type: 'text' | 'blank'; value: string }>;
    const out: Array<{ type: 'text' | 'blank'; value: string }> = [];
    const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(p.template)) !== null) {
      if (m.index > last) out.push({ type: 'text', value: p.template.slice(last, m.index) });
      out.push({ type: 'blank', value: m[1]! });
      last = m.index + m[0].length;
    }
    if (last < p.template.length) out.push({ type: 'text', value: p.template.slice(last) });
    return out;
  }, [p]);

  if (!p) return null;
  const accent = theme.accent || '#10b981';

  function status(key: string): 'correct' | 'wrong' | 'pending' {
    if (!checked) return 'pending';
    return (vals[key] ?? '').trim().toLowerCase() === (p!.answers[key] ?? '').trim().toLowerCase() ? 'correct' : 'wrong';
  }

  return (
    <div style={{ border: `2px solid ${accent}33`, borderRadius: 12, padding: 20, background: `${accent}08` }}>
      <p style={{ fontSize: 16, lineHeight: 2, margin: 0 }}>
        {parts.map((pt, i) => pt.type === 'text' ? (
          <span key={i}>{pt.value}</span>
        ) : (
          <input
            key={i}
            value={vals[pt.value] ?? ''}
            onChange={(e) => setVals((v) => ({ ...v, [pt.value]: e.target.value }))}
            disabled={checked && status(pt.value) === 'correct'}
            style={{
              display: 'inline-block', width: 120,
              padding: '4px 10px', margin: '0 4px',
              border: `2px solid ${status(pt.value) === 'correct' ? '#10b981' : status(pt.value) === 'wrong' ? '#ef4444' : accent}`,
              borderRadius: 6, background: '#fff', color: '#1a1a2e',
              fontSize: 15, fontWeight: 600,
            }}
          />
        ))}
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        {checked && <button type="button" onClick={() => { setChecked(false); setVals({}); }} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 600, cursor: 'pointer' }}>Reset</button>}
        <button type="button" onClick={() => setChecked(true)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Check answers</button>
      </div>
    </div>
  );
}

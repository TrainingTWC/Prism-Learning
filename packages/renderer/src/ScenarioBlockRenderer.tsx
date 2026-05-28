import { useState } from 'react';
import type { ScenarioBlock, Theme } from './types';

type Choice = { id: string; label: string; nextNodeId: string | null };
type Node = { id: string; title: string; body: string; choices: Choice[]; isEnding: boolean };
type Payload = { startNodeId: string; nodes: Node[] };

function parse(c: string): Payload | null { try { return JSON.parse(c) as Payload; } catch { return null; } }

export function ScenarioBlockRenderer({ block, theme }: { block: ScenarioBlock; theme: Theme }) {
  const p = parse(block.content);
  const [currentId, setCurrentId] = useState(p?.startNodeId ?? '');
  const [history, setHistory] = useState<string[]>([]);

  if (!p) return null;
  const accent = theme.accent || '#10b981';
  const node = p.nodes.find((n) => n.id === currentId);
  if (!node) return null;

  return (
    <div style={{ border: `2px solid ${accent}33`, borderRadius: 12, overflow: 'hidden', background: `${accent}05` }}>
      <div style={{ background: accent, color: '#fff', padding: '10px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{node.isEnding ? '🏁 Scenario complete' : `Step ${history.length + 1}`}</span>
        <span style={{ opacity: 0.7 }}>{node.title}</span>
      </div>
      <div style={{ padding: 20 }}>
        <p style={{ fontSize: 15, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{node.body}</p>

        {!node.isEnding && node.choices.length > 0 && (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {node.choices.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={!c.nextNodeId}
                onClick={() => {
                  if (c.nextNodeId) {
                    setHistory((h) => [...h, currentId]);
                    setCurrentId(c.nextNodeId);
                  }
                }}
                style={{
                  textAlign: 'left',
                  background: '#fff',
                  color: '#1a1a2e',
                  border: `2px solid ${accent}40`,
                  borderRadius: 10,
                  padding: '12px 16px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: c.nextNodeId ? 'pointer' : 'not-allowed',
                  opacity: c.nextNodeId ? 1 : 0.5,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { if (c.nextNodeId) e.currentTarget.style.borderColor = accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${accent}40`; }}
              >
                → {c.label}
              </button>
            ))}
          </div>
        )}

        {node.isEnding && (
          <button
            type="button"
            onClick={() => { setCurrentId(p.startNodeId); setHistory([]); }}
            style={{ marginTop: 20, padding: '10px 20px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            Restart scenario
          </button>
        )}
      </div>
    </div>
  );
}

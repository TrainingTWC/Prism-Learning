import type { LabeledGraphicBlock, ResolveAsset, Theme } from './types';

type Label = { id: string; xPct: number; yPct: number; text: string };
type Payload = { storageId: string; altText: string; labels: Label[] };

function parse(c: string): Payload | null { try { return JSON.parse(c) as Payload; } catch { return null; } }

export function LabeledGraphicBlockRenderer({ block, resolveAsset, theme }: { block: LabeledGraphicBlock; resolveAsset: ResolveAsset; theme: Theme }) {
  const p = parse(block.content);
  if (!p) return null;
  const accent = theme.accent || '#10b981';
  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
      <img src={resolveAsset(p.storageId)} alt={p.altText} style={{ width: '100%', display: 'block' }} />
      {p.labels.map((l) => (
        <div key={l.id} style={{
          position: 'absolute',
          left: `${l.xPct}%`, top: `${l.yPct}%`,
          transform: 'translate(-50%, -50%)',
          background: '#fff', color: '#1a1a2e',
          padding: '6px 14px', borderRadius: 999,
          fontSize: 12, fontWeight: 700,
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          border: `2px solid ${accent}`,
          display: 'flex', alignItems: 'center', gap: 6,
          whiteSpace: 'nowrap',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
          {l.text}
        </div>
      ))}
    </div>
  );
}

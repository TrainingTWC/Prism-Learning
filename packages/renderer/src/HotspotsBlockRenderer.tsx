import { useState } from 'react';
import type { HotspotsBlock, ResolveAsset, Theme } from './types';

type Hotspot = { id: string; xPct: number; yPct: number; title: string; body: string };
type Payload = { storageId: string; altText: string; hotspots: Hotspot[] };

function parse(content: string): Payload | null {
  try { return JSON.parse(content) as Payload; } catch { return null; }
}

export function HotspotsBlockRenderer({
  block,
  resolveAsset,
  theme,
}: {
  block: HotspotsBlock;
  resolveAsset: ResolveAsset;
  theme: Theme;
}) {
  const p = parse(block.content);
  const [openId, setOpenId] = useState<string | null>(null);
  if (!p) return null;
  const url = resolveAsset(p.storageId);
  const accent = theme.accent || '#10b981';
  const open = p.hotspots.find((h) => h.id === openId) ?? null;

  return (
    <div className="prism-hotspots" style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
      <img src={url} alt={p.altText} style={{ width: '100%', display: 'block' }} />
      {p.hotspots.map((h, idx) => (
        <button
          key={h.id}
          type="button"
          onClick={() => setOpenId(openId === h.id ? null : h.id)}
          aria-label={h.title}
          style={{
            position: 'absolute',
            left: `${h.xPct}%`,
            top: `${h.yPct}%`,
            transform: 'translate(-50%, -50%)',
            width: 36, height: 36, borderRadius: '50%',
            background: accent, color: '#fff',
            border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 14,
            boxShadow: `0 0 0 6px ${accent}33, 0 4px 12px rgba(0,0,0,0.3)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'prism-hs-pulse 2s ease-in-out infinite',
          }}
        >
          {idx + 1}
        </button>
      ))}
      {open && (
        <div
          style={{
            position: 'absolute',
            left: `${open.xPct}%`,
            top: `${open.yPct}%`,
            transform: `translate(${open.xPct > 50 ? 'calc(-100% - 24px)' : '24px'}, -50%)`,
            maxWidth: 280, minWidth: 200,
            background: '#fff', color: '#1a1a2e',
            borderRadius: 12, padding: 16,
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            zIndex: 5,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <strong style={{ fontSize: 14, color: accent }}>{open.title}</strong>
            <button
              type="button"
              onClick={() => setOpenId(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 18, lineHeight: 1 }}
              aria-label="Close"
            >×</button>
          </div>
          {open.body && <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5 }}>{open.body}</p>}
        </div>
      )}
      <style>{`@keyframes prism-hs-pulse { 0%,100% { box-shadow: 0 0 0 6px ${accent}33, 0 4px 12px rgba(0,0,0,0.3); } 50% { box-shadow: 0 0 0 12px ${accent}1a, 0 4px 12px rgba(0,0,0,0.3); } }`}</style>
    </div>
  );
}

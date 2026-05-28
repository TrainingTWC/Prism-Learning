import type { AudioBlock, ResolveAsset, Theme } from './types';

type Payload = { storageId: string; title: string; transcript: string };

function parse(c: string): Payload | null { try { return JSON.parse(c) as Payload; } catch { return null; } }

export function AudioBlockRenderer({ block, resolveAsset, theme }: { block: AudioBlock; resolveAsset: ResolveAsset; theme: Theme }) {
  const p = parse(block.content);
  if (!p) return null;
  const accent = theme.accent || '#10b981';
  return (
    <div style={{ border: `2px solid ${accent}33`, borderRadius: 12, overflow: 'hidden', background: `${accent}08` }}>
      {p.title && <div style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: accent, borderBottom: `1px solid ${accent}22` }}>{p.title}</div>}
      <div style={{ padding: 16 }}>
        <audio src={resolveAsset(p.storageId)} controls style={{ width: '100%' }} />
        {p.transcript && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: 0.75 }}>Transcript</summary>
            <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.transcript}</p>
          </details>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { GalleryBlock, ResolveAsset, Theme } from './types';
import { sanitizeInline } from './sanitizeInline';

type Item = { storageId: string; altText: string; caption: string };
type Payload = { layout: 'carousel' | 'grid'; items: Item[] };

function parse(c: string): Payload | null { try { return JSON.parse(c) as Payload; } catch { return null; } }

export function GalleryBlockRenderer({ block, resolveAsset, theme }: { block: GalleryBlock; resolveAsset: ResolveAsset; theme: Theme }) {
  const p = parse(block.content);
  const [idx, setIdx] = useState(0);
  if (!p || p.items.length === 0) return null;
  const accent = theme.accent || '#10b981';

  if (p.layout === 'grid') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        {p.items.map((it, i) => (
          <figure key={i} style={{ margin: 0 }}>
            <img src={resolveAsset(it.storageId)} alt={it.altText} style={{ width: '100%', borderRadius: 12, display: 'block' }} />
            {it.caption && <figcaption style={{ marginTop: 6, fontSize: 12, textAlign: 'center', opacity: 0.7 }} dangerouslySetInnerHTML={{ __html: sanitizeInline(it.caption) }} />}
          </figure>
        ))}
      </div>
    );
  }

  const cur = p.items[idx]!;
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000' }}>
        <img src={resolveAsset(cur.storageId)} alt={cur.altText} style={{ width: '100%', display: 'block', maxHeight: 500, objectFit: 'contain' }} />
      </div>
      {cur.caption && <p style={{ marginTop: 8, textAlign: 'center', fontSize: 13, opacity: 0.75 }} dangerouslySetInnerHTML={{ __html: sanitizeInline(cur.caption) }} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={() => setIdx((i) => (i - 1 + p.items.length) % p.items.length)} style={{ background: accent, color: '#fff', border: 'none', borderRadius: 999, width: 36, height: 36, cursor: 'pointer', fontSize: 18 }}>‹</button>
        <div style={{ display: 'flex', gap: 6 }}>
          {p.items.map((_, i) => (
            <button key={i} type="button" onClick={() => setIdx(i)} style={{ width: i === idx ? 24 : 8, height: 8, borderRadius: 4, background: i === idx ? accent : '#ccc', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }} aria-label={`Go to image ${i + 1}`} />
          ))}
        </div>
        <button type="button" onClick={() => setIdx((i) => (i + 1) % p.items.length)} style={{ background: accent, color: '#fff', border: 'none', borderRadius: 999, width: 36, height: 36, cursor: 'pointer', fontSize: 18 }}>›</button>
      </div>
    </div>
  );
}

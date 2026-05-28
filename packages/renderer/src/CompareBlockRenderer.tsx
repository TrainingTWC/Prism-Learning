import { useRef, useState } from 'react';
import type { CompareBlock, ResolveAsset, Theme } from './types';

type Payload = { beforeStorageId: string; afterStorageId: string; beforeLabel: string; afterLabel: string };

function parse(c: string): Payload | null { try { return JSON.parse(c) as Payload; } catch { return null; } }

export function CompareBlockRenderer({ block, resolveAsset, theme }: { block: CompareBlock; resolveAsset: ResolveAsset; theme: Theme }) {
  const p = parse(block.content);
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  if (!p) return null;
  const accent = theme.accent || '#10b981';

  function move(clientX: number) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }

  return (
    <div
      ref={ref}
      onPointerDown={(e) => { dragging.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e.clientX); }}
      onPointerMove={(e) => { if (dragging.current) move(e.clientX); }}
      onPointerUp={() => { dragging.current = false; }}
      style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', userSelect: 'none', touchAction: 'none', cursor: 'ew-resize', background: '#000' }}
    >
      <img src={resolveAsset(p.afterStorageId)} alt={p.afterLabel} style={{ width: '100%', display: 'block' }} />
      <div style={{ position: 'absolute', inset: 0, width: `${pos}%`, overflow: 'hidden' }}>
        <img src={resolveAsset(p.beforeStorageId)} alt={p.beforeLabel} style={{ width: `${10000 / pos}%`, maxWidth: 'none', display: 'block' }} />
      </div>
      {/* Divider */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos}%`, width: 3, background: '#fff', boxShadow: '0 0 12px rgba(0,0,0,0.5)' }} />
      <div style={{
        position: 'absolute', top: '50%', left: `${pos}%`,
        transform: 'translate(-50%, -50%)',
        width: 44, height: 44, borderRadius: '50%', background: accent,
        border: '3px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 20, fontWeight: 700,
      }}>⇆</div>
      {/* Labels */}
      <span style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{p.beforeLabel}</span>
      <span style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{p.afterLabel}</span>
    </div>
  );
}

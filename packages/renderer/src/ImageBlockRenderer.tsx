import { useState, useEffect } from 'react';
import type { ImageBlock, ResolveAsset } from './types';

interface Payload {
  storageId?: string;
  altText?: string;
  caption?: string;
}

interface Props {
  block: ImageBlock;
  resolveAsset: ResolveAsset;
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image fullscreen"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.88)', cursor: 'zoom-out',
      }}
      onClick={onClose}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close fullscreen"
        style={{
          position: 'absolute', top: '1rem', right: '1rem',
          width: '2.5rem', height: '2.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', border: 'none',
          background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer',
          fontSize: '1.25rem', lineHeight: 1,
        }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Image — stop propagation so clicking image doesn't close */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 'min(96vw, 1200px)',
          maxHeight: '92vh',
          objectFit: 'contain',
          borderRadius: '0.75rem',
          cursor: 'default',
          boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
        }}
      />
    </div>
  );
}

export function ImageBlockRenderer({ block, resolveAsset }: Props) {
  const [open, setOpen] = useState(false);
  let payload: Payload = {};
  try { payload = JSON.parse(block.content) as Payload; } catch { /* empty */ }

  if (!payload.storageId) return null;

  const src = resolveAsset(payload.storageId);

  return (
    <figure className="prism-image my-6">
      <div style={{ position: 'relative', display: 'inline-block', width: '100%', textAlign: 'center' }}>
        <img
          src={src}
          alt={payload.altText ?? ''}
          onClick={() => setOpen(true)}
          style={{ cursor: 'zoom-in' }}
          className="mx-auto aspect-auto max-w-full rounded-2xl bg-slate-100 object-cover"
        />
        {/* Zoom hint */}
        <div
          style={{
            position: 'absolute', bottom: '0.5rem', right: '0.5rem',
            background: 'rgba(0,0,0,0.45)', borderRadius: '0.5rem',
            padding: '0.2rem 0.45rem', pointerEvents: 'none',
          }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="#fff" strokeWidth="2" fill="none">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </div>
      </div>
      {payload.caption && (
        <figcaption className="mt-2 text-center text-sm text-slate-500">
          {payload.caption}
        </figcaption>
      )}
      {open && <Lightbox src={src} alt={payload.altText ?? ''} onClose={() => setOpen(false)} />}
    </figure>
  );
}

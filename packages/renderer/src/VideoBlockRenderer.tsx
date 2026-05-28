import { useRef } from 'react';
import type { VideoBlock, ResolveAsset } from './types';

interface Payload {
  srcType?: 'embed' | 'storage';
  src?: string;
  caption?: string;
}

interface Props {
  block: VideoBlock;
  resolveAsset: ResolveAsset;
}

export function VideoBlockRenderer({ block, resolveAsset }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  let payload: Payload = {};
  try { payload = JSON.parse(block.content) as Payload; } catch { /* empty */ }

  if (!payload.src) return null;

  const resolvedSrc =
    payload.srcType === 'storage' ? resolveAsset(payload.src) : payload.src;

  function handleFullscreen() {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.requestFullscreen) vid.requestFullscreen();
  }

  return (
    <figure className="prism-video my-6">
      {payload.srcType === 'embed' ? (
        <div className="relative overflow-hidden rounded-2xl bg-slate-100" style={{ paddingTop: '56.25%' }}>
          <iframe
            src={resolvedSrc}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      ) : (
        <div style={{ position: 'relative', display: 'inline-block', width: '100%', textAlign: 'center' }}>
          <video
            ref={videoRef}
            src={resolvedSrc}
            controls
            className="mx-auto max-w-full rounded-2xl bg-slate-100"
          />
          {/* Fullscreen button overlay */}
          <button
            type="button"
            onClick={handleFullscreen}
            aria-label="Enter fullscreen"
            style={{
              position: 'absolute', bottom: '0.75rem', right: '0.75rem',
              width: '2rem', height: '2rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '0.4rem', border: 'none',
              background: 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer',
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        </div>
      )}
      {payload.caption && (
        <figcaption className="mt-2 text-center text-sm text-slate-500">
          {payload.caption}
        </figcaption>
      )}
    </figure>
  );
}

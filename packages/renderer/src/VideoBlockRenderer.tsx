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
  let payload: Payload = {};
  try { payload = JSON.parse(block.content) as Payload; } catch { /* empty */ }

  if (!payload.src) return null;

  const resolvedSrc =
    payload.srcType === 'storage' ? resolveAsset(payload.src) : payload.src;

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
        <video
          src={resolvedSrc}
          controls
          className="mx-auto max-w-full rounded-2xl bg-slate-100"
        />
      )}
      {payload.caption && (
        <figcaption className="mt-2 text-center text-sm text-slate-500">
          {payload.caption}
        </figcaption>
      )}
    </figure>
  );
}

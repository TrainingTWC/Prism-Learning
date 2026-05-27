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

export function ImageBlockRenderer({ block, resolveAsset }: Props) {
  let payload: Payload = {};
  try { payload = JSON.parse(block.content) as Payload; } catch { /* empty */ }

  if (!payload.storageId) return null;

  const src = resolveAsset(payload.storageId);

  return (
    <figure className="prism-image my-6">
      <img
        src={src}
        alt={payload.altText ?? ''}
        className="mx-auto aspect-auto max-w-full rounded-2xl bg-slate-100 object-cover"
      />
      {payload.caption && (
        <figcaption className="mt-2 text-center text-sm text-slate-500">
          {payload.caption}
        </figcaption>
      )}
    </figure>
  );
}

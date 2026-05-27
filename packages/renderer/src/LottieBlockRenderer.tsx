import { useState, useEffect } from 'react';
import type { LottieBlock, ResolveAsset } from './types';

interface Payload {
  storageId?: string;
  loop?: boolean;
  autoplay?: boolean;
}

interface DotLottieProps {
  src: string;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
}

interface Props {
  block: LottieBlock;
  resolveAsset: ResolveAsset;
}

export function LottieBlockRenderer({ block, resolveAsset }: Props) {
  const [Component, setComponent] = useState<React.ComponentType<DotLottieProps> | null>(null);

  useEffect(() => {
    void import('@lottiefiles/dotlottie-react').then((mod) => {
      setComponent(() => (mod as { DotLottieReact: React.ComponentType<DotLottieProps> }).DotLottieReact);
    }).catch(() => { /* package not available in this context */ });
  }, []);

  let payload: Payload = {};
  try { payload = JSON.parse(block.content) as Payload; } catch { /* empty */ }

  if (!payload.storageId) return null;

  const src = resolveAsset(payload.storageId);

  if (!Component) {
    return <div className="my-6 flex h-44 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-400">Loading animation...</div>;
  }

  return (
    <div className="prism-lottie my-6">
      <Component
        src={src}
        loop={payload.loop ?? true}
        autoplay={payload.autoplay ?? true}
        className="mx-auto max-w-sm rounded-2xl"
      />
    </div>
  );
}

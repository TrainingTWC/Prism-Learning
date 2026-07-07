import type { DividerBlock } from './types';

interface Payload {
  style?: 'line' | 'space' | 'dots';
  label?: string;
  padding?: number;
}

interface Props {
  block: DividerBlock;
}

const MIN_PADDING = 0;
const MAX_PADDING = 96;

function defaultPaddingForStyle(style: Payload['style']) {
  return style === 'space' ? 32 : 48;
}

function dividerPadding(value: unknown, style: Payload['style']) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return defaultPaddingForStyle(style);
  return Math.min(MAX_PADDING, Math.max(MIN_PADDING, Math.round(numeric)));
}

export function DividerBlockRenderer({ block }: Props) {
  let payload: Payload = {};
  try { payload = JSON.parse(block.content) as Payload; } catch { /* empty */ }
  const style = payload.style ?? 'line';
  const padding = dividerPadding(payload.padding, style);

  if (style === 'space') {
    return <div className="prism-divider" style={{ height: `${padding * 2}px` }} />;
  }

  if (style === 'dots') {
    return (
      <div className="prism-divider" style={{ padding: `${padding}px 0`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
        <span style={{ display: 'block', width: '6px', height: '6px', borderRadius: '50%', background: '#cbd5e1' }} />
        <span style={{ display: 'block', width: '6px', height: '6px', borderRadius: '50%', background: '#cbd5e1' }} />
        <span style={{ display: 'block', width: '6px', height: '6px', borderRadius: '50%', background: '#cbd5e1' }} />
      </div>
    );
  }

  // line (default)
  if (payload.label) {
    return (
      <div className="prism-divider" style={{ padding: `${padding}px 0`, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
        <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8' }}>{payload.label}</span>
        <span style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
      </div>
    );
  }

  return (
    <div className="prism-divider" style={{ padding: `${padding}px 0` }}>
      <div style={{ borderTop: '1px solid #e2e8f0' }} />
    </div>
  );
}

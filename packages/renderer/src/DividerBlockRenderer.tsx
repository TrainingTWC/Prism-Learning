import type { DividerBlock } from './types';

interface Payload {
  style?: 'line' | 'space' | 'dots';
  label?: string;
}

interface Props {
  block: DividerBlock;
}

export function DividerBlockRenderer({ block }: Props) {
  let payload: Payload = {};
  try { payload = JSON.parse(block.content) as Payload; } catch { /* empty */ }
  const style = payload.style ?? 'line';

  if (style === 'space') {
    return <div className="prism-divider" style={{ margin: '4rem 0' }} />;
  }

  if (style === 'dots') {
    return (
      <div className="prism-divider" style={{ margin: '3.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
        <span style={{ display: 'block', width: '6px', height: '6px', borderRadius: '50%', background: '#cbd5e1' }} />
        <span style={{ display: 'block', width: '6px', height: '6px', borderRadius: '50%', background: '#cbd5e1' }} />
        <span style={{ display: 'block', width: '6px', height: '6px', borderRadius: '50%', background: '#cbd5e1' }} />
      </div>
    );
  }

  // line (default)
  if (payload.label) {
    return (
      <div className="prism-divider" style={{ margin: '3.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
        <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8' }}>{payload.label}</span>
        <span style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
      </div>
    );
  }

  return <hr className="prism-divider" style={{ margin: '3.5rem 0', border: 0, borderTop: '1px solid #e2e8f0' }} />;
}

import type { ButtonBlock } from './types';

interface Payload {
  label?: string;
  url?: string;
  style?: 'primary' | 'outline' | 'ghost';
  align?: 'left' | 'center' | 'right';
}

interface Props {
  block: ButtonBlock;
}

export function ButtonBlockRenderer({ block }: Props) {
  let payload: Payload = {};
  try { payload = JSON.parse(block.content) as Payload; } catch { /* empty */ }
  if (!payload.label) return null;

  const align = payload.align ?? 'left';
  const style = payload.style ?? 'primary';

  const alignStyle: React.CSSProperties = {
    textAlign: align === 'center' ? 'center' : align === 'right' ? 'right' : 'left',
  };

  const buttonStyle: React.CSSProperties =
    style === 'primary'
      ? { background: 'var(--prism-primary, #4f46e5)', color: '#fff', border: 'none' }
      : style === 'outline'
        ? { background: 'transparent', color: 'var(--prism-primary, #4f46e5)', border: '2px solid var(--prism-primary, #4f46e5)' }
        : { background: 'transparent', color: 'var(--prism-primary, #4f46e5)', border: 'none', textDecoration: 'underline' };

  const sharedClass =
    'inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-85 active:scale-95';

  if (payload.url) {
    return (
      <div className="prism-button my-6" style={alignStyle}>
        <a
          href={payload.url}
          target="_blank"
          rel="noopener noreferrer"
          className={sharedClass}
          style={buttonStyle}
        >
          {payload.label}
        </a>
      </div>
    );
  }

  return (
    <div className="prism-button my-6" style={alignStyle}>
      <button type="button" className={sharedClass} style={buttonStyle}>
        {payload.label}
      </button>
    </div>
  );
}

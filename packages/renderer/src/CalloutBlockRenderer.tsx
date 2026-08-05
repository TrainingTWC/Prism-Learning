import type { CalloutBlock } from './types';
import { sanitizeInline } from './sanitizeInline';

interface Payload {
  variant?: 'info' | 'warning' | 'success' | 'tip';
  title?: string;
  body?: string;
}

const VARIANTS = {
  info: {
    bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0, marginTop: '0.05rem' }}>
        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
      </svg>
    ),
  },
  warning: {
    bg: '#fffbeb', border: '#fde68a', text: '#92400e',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0, marginTop: '0.05rem' }}>
        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
      </svg>
    ),
  },
  success: {
    bg: '#f0fdf4', border: '#bbf7d0', text: '#166534',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0, marginTop: '0.05rem' }}>
        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
      </svg>
    ),
  },
  tip: {
    bg: '#faf5ff', border: '#e9d5ff', text: '#6b21a8',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0, marginTop: '0.05rem' }}>
        <path d="M12 2a7 7 0 0 1 5.27 11.578A5 5 0 0 1 14 17v1a2 2 0 0 1-2 2h0a2 2 0 0 1-2-2v-1a5 5 0 0 1-3.27-3.422A7 7 0 0 1 12 2zm0 2a5 5 0 0 0-2.693 9.228A3 3 0 0 1 11 16v1h2v-1a3 3 0 0 1 1.693-2.772A5 5 0 0 0 12 4zM10 19h4v1a2 2 0 0 1-2 2h0a2 2 0 0 1-2-2v-1z" />
      </svg>
    ),
  },
} as const;

interface Props {
  block: CalloutBlock;
}

export function CalloutBlockRenderer({ block }: Props) {
  let payload: Payload = {};
  try { payload = JSON.parse(block.content) as Payload; } catch { /* empty */ }
  const variant = (payload.variant ?? 'info') as keyof typeof VARIANTS;
  const v = VARIANTS[variant];

  return (
    <div
      className="prism-callout my-6 flex gap-3 rounded-2xl border px-5 py-4"
      style={{ background: v.bg, borderColor: v.border, color: v.text }}
    >
      <span style={{ color: v.text }}>{v.icon}</span>
      <div className="min-w-0">
        {payload.title && (
          <p
            className="font-semibold text-sm mb-1"
            style={{ color: v.text }}
            // eslint-disable-next-line react/no-danger -- sanitized via sanitizeInline
            dangerouslySetInnerHTML={{ __html: sanitizeInline(payload.title) }}
          />
        )}
        {payload.body && (
          <p
            className="text-sm leading-relaxed"
            style={{ color: v.text, opacity: 0.85 }}
            // eslint-disable-next-line react/no-danger -- sanitized via sanitizeInline
            dangerouslySetInnerHTML={{ __html: sanitizeInline(payload.body) }}
          />
        )}
      </div>
    </div>
  );
}

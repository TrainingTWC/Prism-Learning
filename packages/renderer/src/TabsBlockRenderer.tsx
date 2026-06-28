import { useState } from 'react';
import type { TabsBlock } from './types';

interface Tab {
  id: string;
  title: string;
  content: string;
}

interface Payload {
  tabs?: Tab[];
}

interface Props {
  block: TabsBlock;
}

export function TabsBlockRenderer({ block }: Props) {
  let payload: Payload = {};
  try { payload = JSON.parse(block.content) as Payload; } catch { /* empty */ }
  const tabs = payload.tabs ?? [];
  const [activeIdx, setActiveIdx] = useState(0);
  if (!tabs.length) return null;

  return (
    <div className="prism-tabs my-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveIdx(i)}
            className="relative shrink-0 px-5 py-3 text-sm font-medium transition-colors [&_p]:m-0 [&_p]:inline [&_strong]:font-bold [&_em]:italic [&_u]:underline"
            style={{
              color: activeIdx === i ? 'var(--prism-primary, #4f46e5)' : '#64748b',
              borderBottom: activeIdx === i ? '2px solid var(--prism-primary, #4f46e5)' : '2px solid transparent',
              background: activeIdx === i ? '#fff' : 'transparent',
            }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: tab.title }}
          />
        ))}
      </div>

      {/* Content */}
      <div
        className="px-5 py-5 text-sm leading-relaxed text-slate-600 prism-rich-content"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: tabs[activeIdx]?.content ?? '' }}
      />
    </div>
  );
}

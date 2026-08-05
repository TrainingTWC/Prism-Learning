import { Monitor } from 'lucide-react';

/**
 * RSP-02: shows a "best viewed on desktop" overlay on small viewports.
 * CSS-only — no JS screen-size detection needed.
 */
export function MobileGuard({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}

      {/* Visible only on screens narrower than md (768px) */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white p-8 md:hidden">
        <div className="max-w-xs text-center">
          <Monitor className="mx-auto mb-4 size-12 text-slate-300" strokeWidth={1.5} />
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Best viewed on a larger screen</h2>
          <p className="text-sm leading-relaxed text-slate-500">
            Prism Authoring is a desktop tool. Open it on a laptop or desktop for the best
            experience.
          </p>
        </div>
      </div>
    </>
  );
}

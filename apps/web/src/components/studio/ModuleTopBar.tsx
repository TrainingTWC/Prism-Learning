import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

interface ModuleTopBarProps {
  workspaceId: string;
  /** Breadcrumb content rendered after the logo tile. */
  breadcrumb: ReactNode;
  /** Optional centre tabs. */
  tabs?: ReactNode;
  /** Right-aligned actions. */
  right?: ReactNode;
}

/** White 56px studio top bar shared by outline, publish and the lesson editor. */
export function ModuleTopBar({ workspaceId, breadcrumb, tabs, right }: ModuleTopBarProps) {
  return (
    <header className="flex min-h-14 flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-2">
      <Link
        to="/w/$workspaceId/modules"
        params={{ workspaceId }}
        aria-label="Back to modules"
        className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-brand"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3 21 19H3z" />
          <path d="M12 3v16" />
        </svg>
      </Link>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        {breadcrumb}
      </nav>
      {tabs && <div className="ml-4 flex items-center gap-1">{tabs}</div>}
      <div className="flex-1" />
      {right && <div className="flex items-center gap-3">{right}</div>}
    </header>
  );
}

/** Tab pill used inside ModuleTopBar's `tabs` slot. */
export function TopBarTab({
  active,
  children,
}: {
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`flex h-[34px] items-center rounded-lg px-3 text-[13px] ${
        active ? 'bg-brand-soft font-semibold text-brand-ink' : 'text-ink-2 hover:bg-hover'
      }`}
    >
      {children}
    </span>
  );
}

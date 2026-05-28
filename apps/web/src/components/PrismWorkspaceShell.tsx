import { Link } from '@tanstack/react-router';
import { Bell, BookOpen, Brain, ChevronsLeft, ChevronsRight, Layers, Moon, Palette, Search, Sun, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type ActiveSection = 'home' | 'overview' | 'modules' | 'build' | 'theme' | 'members';

type PrismWorkspaceShellProps = {
  workspaceId?: string;
  workspaceName?: string;
  workspaceRole?: string;
  active: ActiveSection;
  overline?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  topbarActions?: ReactNode;
  showPageHeader?: boolean;
  children: ReactNode;
};

const navItems = [
  { id: 'overview', label: 'Workspace', icon: BookOpen, to: '/w/$workspaceId' },
  { id: 'modules', label: 'Modules', icon: Layers, to: '/w/$workspaceId/modules' },
  { id: 'build', label: 'AI Builder', icon: Brain, to: '/w/$workspaceId/build-with-ai' },
  { id: 'theme', label: 'Brand Theme', icon: Palette, to: '/w/$workspaceId/theme' },
  { id: 'members', label: 'Members', icon: Users, to: '/w/$workspaceId/members' },
] as const;

export function PrismWorkspaceShell({
  workspaceId,
  workspaceName,
  workspaceRole,
  active,
  overline,
  title,
  subtitle,
  actions,
  topbarActions,
  showPageHeader = true,
  children,
}: PrismWorkspaceShellProps) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('prism-sidebar-collapsed') === 'true');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => localStorage.getItem('prism-theme') === 'light' ? 'light' : 'dark');
  const resolvedWorkspaceName = workspaceName ?? 'Prism Learning';

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('prism-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('prism-sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  return (
    <div className="prism-brand-screen prism-app-shell" data-collapsed={collapsed}>
      <aside className="prism-sidebar">
        <div className="border-b border-[var(--sidebar-border)] px-5 py-5">
          <Link to="/" className="mb-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] transition hover:opacity-80">
            <img src="/prism-logo.png" className="size-8 shrink-0" alt="Prism Learning" />
            <span className="prism-sidebar-label">Prism Learning</span>
          </Link>
          <p className="prism-sidebar-label truncate text-lg font-bold tracking-tight text-[var(--text-primary)]">{resolvedWorkspaceName}</p>
          {workspaceRole && (
            <span className="badge-pill prism-sidebar-label mt-3 bg-[rgba(13,140,99,0.1)] text-[var(--ember-400)]">
              <span className="size-1.5 rounded-full bg-[var(--ember-400)]" />
              {workspaceRole}
            </span>
          )}
        </div>

        <div className="prism-sidebar-label px-4 py-4">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] px-3 py-2 text-[var(--text-muted)]">
            <Search className="size-3.5" />
            <span className="text-xs">Search Prism Learning...</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          <p className="prism-sidebar-label px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">Authoring</p>
          <Link to="/" data-active={active === 'home'} className="prism-nav-item" title="Home">
            <BookOpen className="size-4" />
            <span className="prism-sidebar-label">Home</span>
          </Link>
          {workspaceId && navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                to={item.to}
                params={{ workspaceId }}
                data-active={active === item.id}
                className="prism-nav-item"
                title={item.label}
              >
                <Icon className="size-4" />
                <span className="prism-sidebar-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--sidebar-border)] p-4">
          <div className="prism-sidebar-label rounded-2xl border border-[var(--border-subtle)] bg-[var(--card-bg)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">SCORM readiness</p>
            <div className="mt-3 flex items-end justify-between">
              <span className="font-mono-value text-2xl font-bold text-[var(--obsidian-50)]">1.2</span>
              <span className="badge-pill bg-[rgba(34,197,94,0.08)] text-[var(--semantic-success)]">Ready</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] transition hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            <span className="prism-sidebar-label">Collapse</span>
          </button>
        </div>
      </aside>

      <div className="prism-shell-right">
        <header className="prism-topbar flex items-center justify-between px-8">
          <div className="flex w-full max-w-xl items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] px-3 py-2 text-[var(--text-muted)]">
            <Search className="size-4" />
            <span className="text-xs">Search Prism...</span>
          </div>
          <div className="ml-6 flex items-center gap-4">
            <button
              type="button"
              onClick={() => setTheme((value) => value === 'light' ? 'dark' : 'light')}
              className="rounded-lg p-2 text-[var(--text-tertiary)] transition hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]"
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
            <button type="button" className="relative rounded-lg p-2 text-[var(--text-tertiary)] transition hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]" aria-label="Notifications">
              <Bell className="size-4" />
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[var(--ember-400)]" />
            </button>
            {topbarActions}
            <div className="hidden border-l border-[var(--border-subtle)] pl-4 text-right sm:block">
              <p className="text-xs font-semibold text-[var(--text-primary)]">Prism Author</p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Global Admin</p>
            </div>
            <div className="flex size-8 items-center justify-center rounded-full bg-[rgba(13,140,99,0.16)] text-xs font-bold text-[var(--ember-400)]">PA</div>
          </div>
        </header>

        <main className="prism-shell-main">
          <div className="prism-shell-inner animate-fadeInUp">
            {showPageHeader && (
              <div className="mb-8 flex flex-col justify-between gap-5 border-b border-[var(--border-subtle)] pb-6 md:flex-row md:items-end">
                <div>
                  {overline && <p className="text-overline mb-2">{overline}</p>}
                  <h1 className="text-[32px] font-extrabold tracking-tight text-[var(--obsidian-100)]">{title}</h1>
                  {subtitle && <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-tertiary)]">{subtitle}</p>}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
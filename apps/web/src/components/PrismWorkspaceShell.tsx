import { Link, useNavigate } from '@tanstack/react-router';
import { BarChart2, Bell, BookOpen, Brain, CheckCheck, ChevronsLeft, ChevronsRight, KeyRound, Layers, LogOut, Moon, Palette, Search, Sun, Trash2, Users } from 'lucide-react';
import { SetPasswordModal } from './SetPasswordModal';
import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';
import type { Id } from '~convex/_generated/dataModel';
import { api } from '~convex/_generated/api';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type ActiveSection = 'home' | 'intelligence' | 'overview' | 'modules' | 'build' | 'theme' | 'members' | 'analytics';

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

type ShellNotification = {
  _id: Id<'notifications'>;
  title: string;
  body: string;
  createdAt: number;
  isRead: boolean;
  workspaceId?: Id<'workspaces'>;
  moduleId?: Id<'modules'>;
};

const navItems = [
  { id: 'overview', label: 'Workspace', icon: BookOpen, to: '/w/$workspaceId' },
  { id: 'modules', label: 'Modules', icon: Layers, to: '/w/$workspaceId/modules' },
  { id: 'build', label: 'AI Builder', icon: Brain, to: '/w/$workspaceId/build-with-ai' },
  { id: 'theme', label: 'Brand Theme', icon: Palette, to: '/w/$workspaceId/theme' },
  { id: 'members', label: 'Members', icon: Users, to: '/w/$workspaceId/members' },
  { id: 'analytics', label: 'Analytics', icon: BarChart2, to: '/w/$workspaceId/analytics' },
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
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const resolvedWorkspaceName = workspaceName ?? 'Prism Learning';
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const me = useQuery(api.users.getMe);
  const notificationFeed = useQuery(api.notifications.listMine);
  const markNotificationRead = useMutation(api.notifications.markRead);
  const markAllNotificationsRead = useMutation(api.notifications.markAllRead);
  const removeNotification = useMutation(api.notifications.remove);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const displayName = me?.name ?? me?.email?.split('@')[0] ?? 'User';
  const initials = getInitials(me?.name ?? me?.email ?? 'U');
  const notificationItems = (notificationFeed?.items ?? []) as ShellNotification[];

  async function handleSignOut() {
    await signOut();
    void navigate({ to: '/sign-in', replace: true });
  }

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('prism-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('prism-sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (!notificationsOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setNotificationsOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [notificationsOpen]);

  async function handleOpenNotification(notification: {
    _id: Id<'notifications'>;
    isRead: boolean;
    workspaceId?: Id<'workspaces'>;
    moduleId?: Id<'modules'>;
  }) {
    if (!notification.isRead) {
      await markNotificationRead({ notificationId: notification._id });
    }

    setNotificationsOpen(false);

    if (notification.workspaceId && notification.moduleId) {
      void navigate({
        to: '/w/$workspaceId/m/$moduleId',
        params: { workspaceId: notification.workspaceId, moduleId: notification.moduleId },
      });
      return;
    }

    if (notification.workspaceId) {
      void navigate({
        to: '/w/$workspaceId',
        params: { workspaceId: notification.workspaceId },
      });
    }
  }

  return (
    <div className="prism-brand-screen prism-app-shell" data-collapsed={collapsed}>
      <aside className="prism-sidebar">
        <div className="border-b border-[var(--sidebar-border)] px-5 py-5">
          <Link to="/" className="prism-brand-link mb-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] transition hover:opacity-80">
            <img src="/prism-logo.png" className="size-8 shrink-0" alt="Prism Learning" />
            <span className="prism-brand-wordmark">Prism Learning</span>
          </Link>
          <p className="prism-sidebar-label truncate text-lg font-bold tracking-tight text-[var(--text-primary)]">{resolvedWorkspaceName}</p>
          {workspaceRole && (
            <span className="badge-pill prism-sidebar-label mt-3 bg-[rgba(140,67,208,0.1)] text-[var(--ember-400)]">
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
          {!workspaceId && (
            <Link to="/intelligence" data-active={active === 'intelligence'} className="prism-nav-item" title="Intelligence">
              <BarChart2 className="size-4" />
              <span className="prism-sidebar-label">Intelligence</span>
            </Link>
          )}
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
              <span className="badge-pill bg-[rgba(170,117,221,0.12)] text-[var(--ember-400)]">Ready</span>
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
          <div className="ml-4 flex shrink-0 items-center gap-1.5">
            {topbarActions && (
              <>
                {topbarActions}
                <span className="mx-1 h-4 w-px bg-[var(--border-subtle)]" />
              </>
            )}
            <button
              type="button"
              onClick={() => setTheme((value) => value === 'light' ? 'dark' : 'light')}
              className="rounded-lg p-2 text-[var(--text-tertiary)] transition hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]"
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
            <div className="relative" ref={notificationRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen((value) => !value)}
                className="relative rounded-lg p-2 text-[var(--text-tertiary)] transition hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]"
                aria-label="Notifications"
              >
                <Bell className="size-4" />
                {!!notificationFeed?.unreadCount && (
                  <>
                    <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[var(--ember-400)]" />
                    <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-[var(--ember-400)] px-1 text-[10px] font-bold leading-4 text-white">
                      {notificationFeed.unreadCount > 9 ? '9+' : notificationFeed.unreadCount}
                    </span>
                  </>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-12 z-40 w-[360px] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--card-bg)] shadow-2xl">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Notifications</p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {notificationFeed?.unreadCount ?? 0} unread
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void markAllNotificationsRead({})}
                      disabled={!notificationFeed?.unreadCount}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--ember-400)] transition hover:bg-[var(--card-bg-hover)] disabled:opacity-40"
                    >
                      <CheckCheck className="size-3.5" />
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto p-2">
                    {notificationItems.length ? (
                      <div className="space-y-2">
                        {notificationItems.map((notification) => (
                          <div
                            key={notification._id}
                            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--sidebar-bg)]/60 p-3"
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-1 size-2 shrink-0 rounded-full ${notification.isRead ? 'bg-[var(--border-subtle)]' : 'bg-[var(--ember-400)]'}`}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-semibold text-[var(--text-primary)]">{notification.title}</p>
                                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{notification.body}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => void removeNotification({ notificationId: notification._id })}
                                    className="rounded-md p-1 text-[var(--text-muted)] transition hover:bg-[var(--card-bg-hover)] hover:text-[var(--semantic-danger)]"
                                    aria-label="Delete notification"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                                <div className="mt-3 flex items-center gap-2 text-[11px]">
                                  {!notification.isRead && (
                                    <button
                                      type="button"
                                      onClick={() => void markNotificationRead({ notificationId: notification._id })}
                                      className="rounded-md px-2 py-1 font-semibold text-[var(--ember-400)] transition hover:bg-[var(--card-bg-hover)]"
                                    >
                                      Mark as read
                                    </button>
                                  )}
                                  {(notification.workspaceId || notification.moduleId) && (
                                    <button
                                      type="button"
                                      onClick={() => void handleOpenNotification(notification)}
                                      className="rounded-md px-2 py-1 font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]"
                                    >
                                      Open
                                    </button>
                                  )}
                                  <span className="ml-auto text-[var(--text-muted)]">{formatNotificationTime(notification.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                        <Bell className="size-5 text-[var(--text-muted)]" />
                        <p className="text-sm font-semibold text-[var(--text-primary)]">No notifications yet</p>
                        <p className="text-xs text-[var(--text-muted)]">Workspace updates and AI build completions will show up here.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <span className="mx-1.5 h-5 w-px bg-[var(--border-subtle)]" />
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[rgba(140,67,208,0.16)] text-xs font-bold text-[var(--ember-400)]">{initials}</div>
              <div className="hidden flex-col sm:flex">
                <p className="text-xs font-semibold leading-none text-[var(--text-primary)]">{displayName}</p>
                {workspaceRole && (
                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em] leading-none text-[var(--text-muted)]">{workspaceRole}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPasswordModalOpen(true)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]"
                aria-label="Set or change password"
                title="Set / change password"
              >
                <KeyRound className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--card-bg-hover)] hover:text-[var(--semantic-danger)]"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
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
      {me?.email && (
        <SetPasswordModal
          email={me.email}
          open={passwordModalOpen}
          onClose={() => setPasswordModalOpen(false)}
        />
      )}
    </div>
  );
}

function getInitials(str: string): string {
  if (str.includes('@')) return str[0]?.toUpperCase() ?? 'U';
  const words = str.trim().split(/\s+/);
  if (words.length === 1) return words[0]?.[0]?.toUpperCase() ?? 'U';
  return ((words[0]?.[0] ?? '') + (words[words.length - 1]?.[0] ?? '')).toUpperCase();
}

function formatNotificationTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
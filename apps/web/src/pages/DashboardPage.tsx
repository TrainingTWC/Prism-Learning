import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { Link, useNavigate } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import { Plus, Loader2, ChevronRight, Users, Brain, Layers, Palette } from 'lucide-react';
import { PrismWorkspaceShell } from '../components/PrismWorkspaceShell';

export function DashboardPage() {
  const workspaces = useQuery(api.workspaces.listMine);
  const createWorkspace = useMutation(api.workspaces.create);
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    setSaving(true);
    setError(null);
    try {
      const id = await createWorkspace({ name });
      setNewName('');
      setCreating(false);
      void navigate({ to: '/w/$workspaceId', params: { workspaceId: id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setSaving(false);
    }
  }

  const firstWorkspace = workspaces?.[0];

  function handleFeatureCard(kind: 'workspaces' | 'build' | 'theme') {
    if (kind === 'workspaces') {
      document.getElementById('workspace-registry')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!firstWorkspace) {
      setCreating(true);
      document.getElementById('workspace-registry')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    void navigate({
      to: kind === 'build' ? '/w/$workspaceId/build-with-ai' : '/w/$workspaceId/theme',
      params: { workspaceId: firstWorkspace._id },
    });
  }

  return (
    <PrismWorkspaceShell
      active="home"
      overline="AI-native SCORM authoring"
      title="Prism Learning"
      subtitle="Build mobile-first learning modules, generate structured course content from documents, and export SCORM packages from one operational authoring system."
      showPageHeader={false}
    >
        <section className="animate-fadeInUp pt-10 lg:pt-16">
          <p className="mb-5 text-overline">AI-native SCORM authoring</p>
          <h2 className="text-[clamp(3rem,8vw,5.5rem)] font-extrabold uppercase leading-none tracking-tight text-[var(--obsidian-50)]">
            Prism <span className="text-gradient-ember">Learning</span>
          </h2>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-[var(--text-tertiary)]">
            Build mobile-first learning modules, generate structured course content from documents,
            and export SCORM packages from one operational authoring system.
          </p>
        </section>

        <section className="mt-10 grid gap-5 sm:grid-cols-3">
          {[
            { kind: 'workspaces' as const, icon: Layers, title: 'Workspaces', description: 'Organize authoring systems by team, client, or learning program.' },
            { kind: 'build' as const, icon: Brain, title: 'AI Builder', description: 'Turn briefs, PDFs, DOCX files, images, and video into complete modules.' },
            { kind: 'theme' as const, icon: Palette, title: 'Brand System', description: 'Control colour, type, shape, and learner-facing presentation.' },
          ].map((card, index) => {
            const Icon = card.icon;
            return (
              <button key={card.title} type="button" onClick={() => handleFeatureCard(card.kind)} className={`glass glass-interactive animate-fadeInUp stagger-${index + 2} p-6 text-left`}>
                <div className="prism-icon-tile mb-5 size-12 rounded-xl">
                  <Icon className="size-5" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-primary)]">{card.title}</h2>
                <p className="mt-3 text-xs leading-6 text-[var(--text-tertiary)]">{card.description}</p>
                <div className="mt-5 flex items-center gap-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--ember-400)]">
                  Open <ChevronRight className="size-3.5" />
                </div>
              </button>
            );
          })}
        </section>

        <section id="workspace-registry" className="mt-12 flex scroll-mt-24 flex-col justify-between gap-5 border-b border-[var(--border-subtle)] pb-6 md:flex-row md:items-end">
          <div>
            <p className="text-overline mb-2">Workspace registry</p>
            <h2 className="text-[32px] font-extrabold tracking-tight text-[var(--obsidian-100)]">Authoring environments</h2>
            <p className="mt-2 text-sm text-[var(--text-tertiary)]">Launch and manage your collaborative learning production spaces.</p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="prism-action-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold"
          >
            <Plus className="size-4" />
            New workspace
          </button>
        </section>

        {/* New workspace form */}
        {creating && (
          <div className="glass mt-6 p-5">
            <h2 className="mb-3 text-sm font-bold text-[var(--text-primary)]">New workspace name</h2>
            <form onSubmit={(e) => void handleCreate(e)} className="flex gap-3">
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Onboarding 2025"
                className="block flex-1 rounded-lg border px-3.5 py-2.5 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={saving || !newName.trim()}
                className="prism-action-primary flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold disabled:opacity-50"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setNewName('');
                  setError(null);
                }}
                className="rounded-lg border border-[var(--border-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--text-tertiary)] hover:bg-[var(--card-bg-hover)]"
              >
                Cancel
              </button>
            </form>
            {error && (
              <p className="mt-3 text-sm text-[var(--semantic-danger)]">{error}</p>
            )}
          </div>
        )}

        {/* Loading state */}
        {workspaces === undefined && (
          <div className="mt-6 flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <Loader2 className="size-4 animate-spin" />
            Loading workspaces…
          </div>
        )}

        {/* Empty state */}
        {workspaces !== undefined && workspaces.length === 0 && !creating && (
          <div className="glass mt-6 border-dashed p-12 text-center">
            <div className="prism-icon-tile mx-auto mb-4 size-12 rounded-xl">
              <Plus className="size-6" />
            </div>
            <h2 className="mb-1 text-base font-bold text-[var(--text-primary)]">No workspaces yet</h2>
            <p className="mb-5 text-sm text-[var(--text-tertiary)]">
              Create your first workspace to start building learning modules.
            </p>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="prism-action-primary inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold"
            >
              <Plus className="size-4" />
              Create workspace
            </button>
          </div>
        )}

        {/* Workspace list */}
        {workspaces && workspaces.length > 0 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => (
              <Link
                key={ws._id}
                to="/w/$workspaceId"
                params={{ workspaceId: ws._id }}
                className="widget group flex items-center justify-between p-5"
              >
                <div>
                  <p className="font-bold text-[var(--text-primary)]">{ws.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`badge-pill ${
                        ws.role === 'owner'
                          ? 'bg-[rgba(13,140,99,0.1)] text-[var(--ember-400)]'
                          : 'bg-white/[0.04] text-[var(--text-tertiary)]'
                      }`}
                    >
                      {ws.role}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <Users className="size-3" />
                      Members
                    </span>
                  </div>
                </div>
                <ChevronRight className="size-5 text-[var(--text-muted)] transition-colors group-hover:text-[var(--ember-400)]" />
              </Link>
            ))}
          </div>
        )}
    </PrismWorkspaceShell>
  );
}

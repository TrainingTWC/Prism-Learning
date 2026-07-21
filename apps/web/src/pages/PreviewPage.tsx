import { useQuery, useConvex } from 'convex/react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildPreviewHtml } from '../lib/scormExport';
import type { ExportBlock, ExportLesson, ExportModule, ExportTheme } from '../lib/scormExport';
import {
  ChevronLeft,
  Eye,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────

type ViewMode = 'phone' | 'tablet' | 'desktop';

const VIEW_MODES: Array<{ id: ViewMode; label: string; icon: typeof Smartphone }> = [
  { id: 'phone', label: 'Phone', icon: Smartphone },
  { id: 'tablet', label: 'Tablet', icon: Tablet },
  { id: 'desktop', label: 'Desktop', icon: Monitor },
];

function viewportClass(mode: ViewMode): string {
  if (mode === 'phone') return 'max-w-[390px] rounded-[2rem] border-[10px] border-slate-900 shadow-2xl';
  if (mode === 'tablet') return 'max-w-[760px] rounded-[1.75rem] border-[10px] border-slate-900 shadow-2xl';
  return 'max-w-5xl rounded-3xl border border-slate-200 shadow-xl';
}

/** Parse block JSON content and collect all storageId references */
function extractStorageIds(blocks: Array<{ type: string; content?: string }>): string[] {
  const ids: string[] = [];
  for (const block of blocks) {
    if (!block.content) continue;
    try {
      const p = JSON.parse(block.content) as Record<string, unknown>;
      if (typeof p.storageId === 'string') ids.push(p.storageId);
      if (block.type === 'video' && p.srcType === 'storage' && typeof p.src === 'string') ids.push(p.src);
      if (typeof p.beforeStorageId === 'string') ids.push(p.beforeStorageId);
      if (typeof p.afterStorageId === 'string') ids.push(p.afterStorageId);
      if (Array.isArray(p.items)) {
        for (const item of p.items as Array<{ storageId?: string }>) {
          if (typeof item.storageId === 'string') ids.push(item.storageId);
        }
      }
      if (Array.isArray(p.cards)) {
        for (const card of p.cards as Array<{ imageStorageId?: string; audioStorageId?: string }>) {
          if (typeof card.imageStorageId === 'string') ids.push(card.imageStorageId);
          if (typeof card.audioStorageId === 'string') ids.push(card.audioStorageId);
        }
      }
      if (Array.isArray(p.tabs)) {
        for (const tab of p.tabs as Array<{ imageStorageId?: string; audioStorageId?: string }>) {
          if (typeof tab.imageStorageId === 'string') ids.push(tab.imageStorageId);
          if (typeof tab.audioStorageId === 'string') ids.push(tab.audioStorageId);
        }
      }
    } catch { /* not JSON */ }
  }
  return [...new Set(ids)];
}

const DEFAULT_THEME: ExportTheme = {
  primary: '#4f46e5',
  accent: '#aa75dd',
  headingFont: 'Inter',
  bodyFont: 'Inter',
};

// ── Component ───────────────────────────────────────────────────────────────

export function PreviewPage() {
  const { workspaceId, moduleId } = useParams({
    from: '/protected/w/$workspaceId/m/$moduleId/preview',
  });
  const wsId = workspaceId as Id<'workspaces'>;
  const modId = moduleId as Id<'modules'>;
  const navigate = useNavigate();
  const convex = useConvex();

  const content = useQuery(api.modules.getWithContent, { moduleId: modId });
  const workspace = useQuery(api.workspaces.getById, { workspaceId: wsId });
  const allBlocksRaw = useQuery(api.blocks.listByModule, { moduleId: modId });

  const [lessonIdx, setLessonIdx] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('phone');
  const [assetCache, setAssetCache] = useState<Record<string, string>>({});

  // ── Build export-compatible data structures ────────────────────────────

  const lessons = useMemo(() => content?.lessons ?? [], [content]);
  const allBlocks = useMemo(() => allBlocksRaw ?? [], [allBlocksRaw]);

  const exportMod = useMemo<ExportModule | null>(() => {
    if (!content) return null;
    const exportLessons: ExportLesson[] = lessons.map((l) => ({
      id: l._id,
      title: l.title,
      blocks: allBlocks
        .filter((b) => b.lessonId === l._id)
        .map((b): ExportBlock => ({ id: b._id, type: b.type, content: b.content ?? '' })),
    }));
    return { id: content.module._id, title: content.module.title, lessons: exportLessons };
  }, [content, lessons, allBlocks]);

  const exportTheme = useMemo<ExportTheme>(() => {
    const t = workspace?.theme;
    if (!t) return DEFAULT_THEME;
    return {
      primary: t.primary ?? DEFAULT_THEME.primary,
      accent: t.accent ?? DEFAULT_THEME.accent,
      headingFont: t.headingFont ?? DEFAULT_THEME.headingFont,
      bodyFont: t.bodyFont ?? DEFAULT_THEME.bodyFont,
    };
  }, [workspace]);

  // ── Asset resolution ───────────────────────────────────────────────────

  const currentLesson = exportMod?.lessons[lessonIdx];
  const storageIdKey = useMemo(
    () => extractStorageIds(currentLesson?.blocks ?? []).join(','),
    [currentLesson],
  );

  const resolveAssets = useCallback(
    (key: string) => {
      const ids = key ? key.split(',') : [];
      for (const id of ids) {
        if (!assetCache[id]) {
          void convex.query(api.files.getFileUrl, { storageId: id }).then((url) => {
            if (url) setAssetCache((prev) => ({ ...prev, [id]: url }));
          });
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [convex],
  );

  const prevStorageIdKey = useRef('');
  useEffect(() => {
    if (storageIdKey !== prevStorageIdKey.current) {
      prevStorageIdKey.current = storageIdKey;
      resolveAssets(storageIdKey);
    }
  }, [storageIdKey, resolveAssets]);

  const assetMap = useMemo<Record<string, string>>(() => {
    const ids = storageIdKey ? storageIdKey.split(',') : [];
    const map: Record<string, string> = {};
    for (const id of ids) {
      if (assetCache[id]) map[id] = assetCache[id];
    }
    return map;
  }, [storageIdKey, assetCache]);

  const iframeHtml = useMemo(() => {
    if (!exportMod || !currentLesson) return '';
    return buildPreviewHtml(exportMod, lessonIdx, assetMap, exportTheme);
  }, [exportMod, lessonIdx, assetMap, exportTheme, currentLesson]);

  // ── postMessage handler ────────────────────────────────────────────────

  const lessonCount = lessons.length;

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data || typeof e.data !== 'object') return;
      const { type, dir, idx } = e.data as { type: string; dir?: string; idx?: number };
      if (type === 'prism-preview-nav') {
        if (dir === 'next') setLessonIdx((i) => Math.min(i + 1, lessonCount - 1));
        else if (dir === 'prev') setLessonIdx((i) => Math.max(i - 1, 0));
      } else if (type === 'prism-preview-goto' && typeof idx === 'number') {
        setLessonIdx(Math.max(0, Math.min(idx, lessonCount - 1)));
      } else if (type === 'prism-preview-restart') {
        setLessonIdx(0);
      } else if (type === 'prism-preview-exit') {
        void navigate({ to: '/w/$workspaceId/m/$moduleId', params: { workspaceId, moduleId } });
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [lessonCount, navigate, workspaceId, moduleId]);

  // ── Loading + error states ─────────────────────────────────────────────

  if (content === undefined || workspace === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="size-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Module not found
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {/* Authoring chrome — minimal, stays outside the preview iframe */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/w/$workspaceId/m/$moduleId"
            params={{ workspaceId, moduleId }}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronLeft className="size-4" />
            Back to editor
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <Eye className="size-4 text-indigo-400" />
            Learner Preview
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {VIEW_MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  viewMode === mode.id
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="size-3.5" />
                {mode.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex flex-1 justify-center overflow-auto px-3 py-6 sm:px-6">
        <section className={`w-full overflow-hidden ${viewportClass(viewMode)}`}>
          {iframeHtml ? (
            <iframe
              srcDoc={iframeHtml}
              title="Learner preview"
              sandbox="allow-scripts allow-same-origin allow-popups"
              className="block w-full border-0 bg-white"
              style={{
                height:
                  viewMode === 'desktop'
                    ? 'calc(100vh - 8.5rem)'
                    : 'min(844px, calc(100vh - 8.5rem))',
                minHeight: '680px',
              }}
            />
          ) : (
            <div
              className="flex items-center justify-center bg-white"
              style={{
                height:
                  viewMode === 'desktop'
                    ? 'calc(100vh - 8.5rem)'
                    : 'min(844px, calc(100vh - 8.5rem))',
                minHeight: '680px',
              }}
            >
              <Loader2 className="size-5 animate-spin text-indigo-300" />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}



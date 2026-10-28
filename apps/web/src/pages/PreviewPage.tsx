import { useQuery } from 'convex/react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { formatTabTitle, resolveLessonIndex } from '../lib/editorNav';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { buildPreviewHtml } from '../lib/scormExport';
import type { ExportModule, ExportOptions, ExportTheme } from '../lib/scormExport';
import { collectStorageIds } from '../lib/rendererBlocks';
import { toExportTheme } from '../lib/workspaceTheme';
import { buildExportModule, completionOptionsFromModule } from '../lib/exportData';
import { useAssetUrls } from '../lib/useAssetUrls';
import { ArrowLeft, Loader2, Monitor, RotateCcw, Smartphone, Tablet } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────

type ViewMode = 'phone' | 'tablet' | 'desktop';

const VIEW_MODES: Array<{ id: ViewMode; label: string; icon: typeof Smartphone }> = [
  { id: 'desktop', label: 'Desktop', icon: Monitor },
  { id: 'tablet', label: 'Tablet', icon: Tablet },
  { id: 'phone', label: 'Phone', icon: Smartphone },
];

const FRAME_WIDTH: Record<ViewMode, number> = { desktop: 1180, tablet: 820, phone: 390 };

function frameClass(mode: ViewMode): string {
  return mode === 'phone'
    ? 'rounded-[28px] border-8 border-[#0E0E12]'
    : 'rounded-[14px]';
}

// Phone/tablet emulate a real device's logical viewport height (capped so a short
// window still fits); desktop instead fills the available authoring area.
const frameScreenStyle = (mode: ViewMode): CSSProperties => ({
  height: mode === 'desktop' ? 'calc(100vh - 8.5rem)' : 'min(844px, calc(100vh - 8.5rem))',
  minHeight: '680px',
});

// ── Component ───────────────────────────────────────────────────────────────

export function PreviewPage() {
  const { workspaceId, moduleId } = useParams({
    from: '/protected/w/$workspaceId/m/$moduleId/preview',
  });
  const { lesson: startLessonId, returnTo } = useSearch({
    from: '/protected/w/$workspaceId/m/$moduleId/preview',
  });
  const wsId = workspaceId as Id<'workspaces'>;
  const modId = moduleId as Id<'modules'>;
  const navigate = useNavigate();

  const content = useQuery(api.modules.getWithContent, { moduleId: modId });
  const workspace = useQuery(api.workspaces.getById, { workspaceId: wsId });
  const allBlocksRaw = useQuery(api.blocks.listByModule, { moduleId: modId });

  const [lessonIdx, setLessonIdx] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');

  // ── Build export-compatible data structures ────────────────────────────

  const lessons = useMemo(() => content?.lessons ?? [], [content]);
  const allBlocks = useMemo(() => allBlocksRaw ?? [], [allBlocksRaw]);

  const exportMod = useMemo<ExportModule | null>(() => {
    if (!content) return null;
    return buildExportModule(content.module, lessons, allBlocks, content.coverUrl ?? undefined);
  }, [content, lessons, allBlocks]);

  const exportTheme = useMemo<ExportTheme>(() => toExportTheme(workspace?.theme), [workspace]);

  // ── Asset resolution ───────────────────────────────────────────────────

  const currentLesson = exportMod?.lessons[lessonIdx];
  const storageIds = useMemo(
    () => collectStorageIds(currentLesson?.blocks ?? []),
    [currentLesson],
  );
  const assetMap = useAssetUrls(storageIds);

  // Real per-module completion settings, so the preview matches what the
  // author configured on the publish page.
  const exportOptions = useMemo<ExportOptions>(
    () => completionOptionsFromModule(content?.module),
    [content],
  );

  const iframeHtml = useMemo(() => {
    if (!exportMod || !currentLesson) return '';
    return buildPreviewHtml(exportMod, lessonIdx, assetMap, exportTheme, exportOptions);
  }, [exportMod, lessonIdx, assetMap, exportTheme, currentLesson, exportOptions]);

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
        void navigate({
          to: '/w/$workspaceId/m/$moduleId',
          params: { workspaceId, moduleId },
          search: { lesson: returnTo },
        });
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [lessonCount, navigate, workspaceId, moduleId, returnTo]);

  // Start lesson: seed once from ?lesson= so live Convex updates never reset it.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || lessons.length === 0) return;
    seededRef.current = true;
    setLessonIdx(resolveLessonIndex(lessons, startLessonId));
  }, [lessons, startLessonId]);

  // Return to the lesson that was being edited (not the one viewed in preview).
  const editorSearch = { lesson: returnTo };

  useDocumentTitle(content ? formatTabTitle(['Preview', content.module.title]) : null);

  // ── Loading + error states ─────────────────────────────────────────────

  if (content === undefined || workspace === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#26262E]">
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#26262E] text-[#BDBDC7]">
        Module not found
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col bg-[#26262E]">
      {/* Authoring chrome — stays outside the preview iframe */}
      <header className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-white">
        <Link
          to="/w/$workspaceId/m/$moduleId"
          params={{ workspaceId, moduleId }}
          search={editorSearch}
          className="flex h-[34px] items-center gap-1.5 rounded-[10px] bg-[#34343E] px-3 text-sm text-white transition hover:bg-[#3E3E49] hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back to editor
        </Link>
        <span className="text-[13px] text-[#BDBDC7]">Previewing as a learner &middot; progress isn&apos;t saved</span>

        <div className="flex-1" />

        <div role="tablist" aria-label="Device" className="flex gap-1 rounded-[10px] bg-[#34343E] p-[3px]">
          {VIEW_MODES.map((mode) => {
            const Icon = mode.icon;
            const on = viewMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={mode.label}
                onClick={() => setViewMode(mode.id)}
                className={`flex h-[30px] items-center gap-1.5 rounded-lg px-3 text-[13px] transition ${
                  on ? 'bg-white font-semibold text-ink' : 'text-[#D4D4DC] hover:text-white'
                }`}
              >
                <Icon className="size-4" />
                {mode.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setLessonIdx(0)}
          className="flex h-[34px] items-center gap-1.5 rounded-[10px] bg-[#34343E] px-3 text-[13px] text-white transition hover:bg-[#3E3E49]"
        >
          <RotateCcw className="size-3.5" />
          Reset progress
        </button>
      </header>

      <main className="flex flex-1 justify-center overflow-auto px-4 pb-10 pt-2">
        {/* self-start: without it, main's flex row stretches this section to the
            row's full height, leaving dead space inside the frame below the iframe. */}
        <section
          className={`w-full self-start overflow-hidden bg-white shadow-[0_20px_50px_rgba(0,0,0,0.35)] ${frameClass(viewMode)}`}
          style={{ maxWidth: FRAME_WIDTH[viewMode] }}
        >
          {iframeHtml ? (
            <iframe
              srcDoc={iframeHtml}
              title="Learner preview"
              sandbox="allow-scripts allow-same-origin allow-popups"
              className="block w-full border-0 bg-white"
              style={frameScreenStyle(viewMode)}
            />
          ) : (
            <div
              className="flex items-center justify-center bg-white"
              style={frameScreenStyle(viewMode)}
            >
              <Loader2 className="size-5 animate-spin text-brand" />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

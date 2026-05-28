import { useQuery, useConvex } from 'convex/react';
import { Link, useParams } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { useState, useCallback } from 'react';
import { Module } from '@prism/renderer';
import type { Block, Theme } from '@prism/renderer';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Monitor,
  RotateCcw,
  Smartphone,
  Tablet,
} from 'lucide-react';

const DEFAULT_THEME: Theme = {
  primary: '#4f46e5',
  accent: '#10b981',
  headingFont: 'Inter',
  bodyFont: 'Inter',
};

type ViewMode = 'phone' | 'tablet' | 'desktop';

const VIEW_MODES: Array<{ id: ViewMode; label: string; icon: typeof Smartphone }> = [
  { id: 'phone', label: 'Phone', icon: Smartphone },
  { id: 'tablet', label: 'Tablet', icon: Tablet },
  { id: 'desktop', label: 'Desktop', icon: Monitor },
];

function mapBlockType(type: string): Block['type'] | null {
  const map: Record<string, Block['type']> = {
    richText: 'rich-text',
    image: 'image',
    video: 'video',
    lottie: 'lottie',
    mcq: 'mcq',
    trueFalse: 'true-false',
    accordion: 'accordion',
    quote: 'quote',
    callout: 'callout',
    divider: 'divider',
    flashcard: 'flashcard',
    process: 'process',
    tabs: 'tabs',
    button: 'button',
    customHtml: 'custom-html',
    hotspots: 'hotspots',
    gallery: 'gallery',
    compare: 'compare',
    audio: 'audio',
    labeledGraphic: 'labeled-graphic',
    fillBlanks: 'fill-blanks',
    revealCards: 'reveal-cards',
    matching: 'matching',
    sorting: 'sorting',
    scenario: 'scenario',
  };
  return map[type] ?? null;
}

function viewportClass(mode: ViewMode): string {
  if (mode === 'phone') return 'max-w-[390px] rounded-[2rem] border-[10px] border-slate-900 shadow-2xl';
  if (mode === 'tablet') return 'max-w-[760px] rounded-[1.75rem] border-[10px] border-slate-900 shadow-2xl';
  return 'max-w-5xl rounded-3xl border border-slate-200 shadow-xl';
}

export function PreviewPage() {
  const { workspaceId, moduleId } = useParams({
    from: '/protected/w/$workspaceId/m/$moduleId/preview',
  });
  const wsId = workspaceId as Id<'workspaces'>;
  const modId = moduleId as Id<'modules'>;

  const content = useQuery(api.modules.getWithContent, { moduleId: modId });
  const workspace = useQuery(api.workspaces.getById, { workspaceId: wsId });
  const convex = useConvex();

  const [lessonIdx, setLessonIdx] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('phone');
  const [showSummary, setShowSummary] = useState(false);
  const [assetCache, setAssetCache] = useState<Record<string, string>>({});

  const resolveAsset = useCallback(
    (assetId: string): string => {
      if (assetCache[assetId]) return assetCache[assetId];
      void convex.query(api.files.getFileUrl, { storageId: assetId }).then((url) => {
        if (url) setAssetCache((cache) => ({ ...cache, [assetId]: url }));
      });
      return '';
    },
    [assetCache, convex],
  );

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

  const lessons = content.lessons ?? [];
  const lesson = lessons[lessonIdx];
  const allBlocks = content.blocks ?? [];
  const blocks: Block[] = allBlocks
    .filter((block) => block.lessonId === lesson?._id)
    .map((block) => {
      const type = mapBlockType(block.type);
      if (!type) return null;
      return { id: block._id, type, content: block.content ?? '' } as Block;
    })
    .filter((block): block is Block => block !== null);

  const theme: Theme = workspace?.theme ?? DEFAULT_THEME;
  const lessonCount = lessons.length;
  const progressPct = lessonCount > 0 ? Math.round(((lessonIdx + 1) / lessonCount) * 100) : 0;
  const quizCount = allBlocks.filter((block) => block.type === 'mcq' || block.type === 'trueFalse').length;

  const goToLesson = (nextIdx: number) => {
    setShowSummary(false);
    setLessonIdx(Math.max(0, Math.min(nextIdx, lessonCount - 1)));
  };

  const handleContinue = () => {
    if (lessonIdx >= lessonCount - 1) setShowSummary(true);
    else goToLesson(lessonIdx + 1);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
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
        <section className={`w-full overflow-hidden bg-white ${viewportClass(viewMode)}`}>
          <div className="flex h-[min(844px,calc(100vh-8.5rem))] min-h-[680px] flex-col bg-white">
            <div className="border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {content.module.title}
                  </p>
                  <h1
                    className="mt-1 line-clamp-2 text-lg font-bold leading-6"
                    style={{ color: theme.headingTextColor ?? theme.primary, fontFamily: theme.headingFont }}
                  >
                    {showSummary ? 'Course complete' : (lesson?.title ?? 'Preview')}
                  </h1>
                </div>
                <div className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {showSummary ? 'Done' : `${lessonIdx + 1}/${Math.max(lessonCount, 1)}`}
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${showSummary ? 100 : progressPct}%`, backgroundColor: theme.primary }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50/70 px-5 py-6">
              {showSummary ? (
                <div className="prism-feedback-enter flex min-h-full flex-col items-center justify-center text-center">
                  <div className="flex size-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-sm">
                    <CheckCircle2 className="size-10" />
                  </div>
                  <h2 className="mt-5 text-2xl font-bold text-slate-900">Nicely done</h2>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-slate-600">
                    You reached the end of this module. Review any lesson or restart the preview from the beginning.
                  </p>
                  <div className="mt-5 grid w-full max-w-xs grid-cols-2 gap-3 rounded-2xl bg-white p-3 text-left shadow-sm">
                    <div>
                      <p className="text-xs text-slate-400">Lessons</p>
                      <p className="text-lg font-bold text-slate-900">{lessonCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Interactions</p>
                      <p className="text-lg font-bold text-slate-900">{quizCount}</p>
                    </div>
                  </div>
                </div>
              ) : lesson ? (
                <div key={lesson._id} className="animate-[prism-block-reveal_260ms_cubic-bezier(.2,.8,.2,1)_both]">
                  <Module blocks={blocks} theme={theme} resolveAsset={resolveAsset} />
                </div>
              ) : (
                <p className="text-slate-400">No lessons in this module yet.</p>
              )}
            </div>

            <footer className="border-t border-slate-200 bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={lessonIdx === 0 && !showSummary}
                  onClick={() => (showSummary ? setShowSummary(false) : goToLesson(lessonIdx - 1))}
                  className="flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" /> Previous
                </button>
                {showSummary ? (
                  <button
                    type="button"
                    onClick={() => {
                      setLessonIdx(0);
                      setShowSummary(false);
                    }}
                    className="flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-[.98]"
                    style={{ backgroundColor: theme.primary }}
                  >
                    <RotateCcw className="size-4" /> Restart
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={lessonCount === 0}
                    onClick={handleContinue}
                    className="flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-[.98] disabled:opacity-40"
                    style={{ backgroundColor: theme.primary }}
                  >
                    {lessonIdx >= lessonCount - 1 ? 'Finish' : 'Continue'} <ChevronRight className="size-4" />
                  </button>
                )}
              </div>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}

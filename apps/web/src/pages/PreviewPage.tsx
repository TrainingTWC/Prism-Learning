import { useQuery, useConvex } from 'convex/react';
import { Link, useParams } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { useState, useCallback } from 'react';
import { Module } from '@prism/renderer';
import type { Block, Theme } from '@prism/renderer';
import { ChevronLeft, ChevronRight, Eye, Loader2 } from 'lucide-react';

const DEFAULT_THEME: Theme = {
  primary: '#4f46e5',
  accent: '#10b981',
  headingFont: 'Inter',
  bodyFont: 'Inter',
};

/** Map Convex block type strings → renderer type literals */
function mapBlockType(type: string): Block['type'] | null {
  const map: Record<string, Block['type']> = {
    richText: 'rich-text',
    image: 'image',
    video: 'video',
    lottie: 'lottie',
    mcq: 'mcq',
    trueFalse: 'true-false',
    accordion: 'accordion',
  };
  return map[type] ?? null;
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
  // Cache resolved asset URLs: storageId → URL
  const [assetCache, setAssetCache] = useState<Record<string, string>>({});

  const resolveAsset = useCallback(
    (assetId: string): string => {
      if (assetCache[assetId]) return assetCache[assetId];
      // Kick off async resolution — return placeholder while loading
      void convex.query(api.files.getFileUrl, { storageId: assetId }).then((url) => {
        if (url) setAssetCache((c) => ({ ...c, [assetId]: url }));
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
    .filter((b) => b.lessonId === lesson?._id)
    .map((b) => {
      const type = mapBlockType(b.type);
      if (!type) return null;
      return { id: b._id, type, content: b.content ?? '' } as Block;
    })
    .filter((b): b is Block => b !== null);

  const theme: Theme = workspace?.theme ?? DEFAULT_THEME;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/w/$workspaceId/m/$moduleId"
            params={{ workspaceId, moduleId }}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
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
        <div className="text-sm text-slate-500">
          {content.module.title}
        </div>
      </header>

      <div className="flex flex-1">
        {/* Lesson sidebar */}
        <aside className="hidden w-52 shrink-0 border-r border-slate-200 bg-white p-3 md:block">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Lessons
          </p>
          <nav className="space-y-0.5">
            {lessons.map((l, i) => (
              <button
                key={l._id}
                type="button"
                onClick={() => setLessonIdx(i)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                  i === lessonIdx
                    ? 'bg-indigo-50 font-medium text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {l.title}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex flex-1 flex-col">
          <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
            {lesson ? (
              <>
                <h1
                  className="mb-6 text-2xl font-bold"
                  style={{ color: theme.primary, fontFamily: theme.headingFont }}
                >
                  {lesson.title}
                </h1>
                <Module blocks={blocks} theme={theme} resolveAsset={resolveAsset} />
              </>
            ) : (
              <p className="text-slate-400">No lessons in this module yet.</p>
            )}
          </div>

          {/* Prev / Next */}
          {lessons.length > 1 && (
            <footer className="border-t border-slate-200 bg-white px-6 py-4">
              <div className="mx-auto flex max-w-2xl items-center justify-between">
                <button
                  type="button"
                  disabled={lessonIdx === 0}
                  onClick={() => setLessonIdx((i) => i - 1)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" /> Previous
                </button>
                <span className="text-xs text-slate-400">
                  {lessonIdx + 1} / {lessons.length}
                </span>
                <button
                  type="button"
                  disabled={lessonIdx === lessons.length - 1}
                  onClick={() => setLessonIdx((i) => i + 1)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  Next <ChevronRight className="size-4" />
                </button>
              </div>
            </footer>
          )}
        </main>
      </div>
    </div>
  );
}

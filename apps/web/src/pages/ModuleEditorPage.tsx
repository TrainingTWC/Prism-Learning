import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { formatTabTitle, resolveLessonId } from '../lib/editorNav';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { resolveWorkspaceTheme } from '../lib/workspaceTheme';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { ImportQuizDialog } from '../components/ImportQuizDialog';
import { EditorTopBar } from '../components/editor/EditorTopBar';
import { OutlineRail } from '../components/editor/OutlineRail';
import { LessonCanvas } from '../components/editor/LessonCanvas';
import { Inspector } from '../components/editor/Inspector';
import { BlockLibraryModal } from '../components/editor/BlockLibraryModal';
import { catalogEntry, insertionAfterOrder, type InsertTarget } from '../components/editor/blockCatalog';
import type { EditorBlock, EditorBlockType, EditorLesson } from '../components/editor/types';

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return (el as HTMLElement).isContentEditable === true;
}

export function ModuleEditorPage() {
  const { workspaceId, moduleId } = useParams({
    from: '/protected/w/$workspaceId/m/$moduleId',
  });
  const search = useSearch({ from: '/protected/w/$workspaceId/m/$moduleId' });
  const navigate = useNavigate();
  const wsId = workspaceId as Id<'workspaces'>;
  const modId = moduleId as Id<'modules'>;

  const [activeLessonId, setActiveLessonId] = useState<Id<'lessons'> | null>(null);

  const content = useQuery(api.modules.getWithContent, { moduleId: modId });
  // Blocks are fetched per active lesson — this means a block save by any user
  // only invalidates the subscribers on THAT lesson, not all 5-7 co-editors.
  const lessonBlocks = useQuery(
    api.blocks.list,
    activeLessonId ? { lessonId: activeLessonId } : 'skip',
  );
  const presence = useQuery(api.presence.list, { moduleId: modId });
  const workspace = useQuery(api.workspaces.getById, { workspaceId: wsId });

  const addLesson = useMutation(api.lessons.add);
  const removeLesson = useMutation(api.lessons.remove);
  const renameLesson = useMutation(api.lessons.rename);
  const reorderLessons = useMutation(api.lessons.reorder);
  const renameModule = useMutation(api.modules.rename);

  const addBlock = useMutation(api.blocks.add);
  const updateContent = useMutation(api.blocks.updateContent);
  const removeBlock = useMutation(api.blocks.remove);
  const duplicateBlock = useMutation(api.blocks.duplicate);
  const reorderBlocks = useMutation(api.blocks.reorder);
  const moveBlockToLesson = useMutation(api.blocks.moveToLesson);
  const pingPresence = useMutation(api.presence.ping);

  const [renamingLessonId, setRenamingLessonId] = useState<string | null>(null);
  const [renameLessonValue, setRenameLessonValue] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState<Id<'blocks'> | null>(null);
  const [libraryTarget, setLibraryTarget] = useState<InsertTarget | null>(null);
  const [importQuizOpen, setImportQuizOpen] = useState(false);
  const [editorEpochs, setEditorEpochs] = useState<Record<string, number>>({});
  // Content we just saved but the subscription has not echoed yet — keeps the
  // deselected (renderer) view from flashing stale content.
  const [localContent, setLocalContent] = useState<Record<string, string>>({});
  const [savingCount, setSavingCount] = useState(0);

  const track = useCallback(async <T,>(p: Promise<T>): Promise<T> => {
    setSavingCount((c) => c + 1);
    try {
      return await p;
    } finally {
      setSavingCount((c) => c - 1);
    }
  }, []);

  // Ping presence every 10s
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const doPing = () => {
      void pingPresence({ moduleId: modId, activeLessonId: activeLessonId ?? undefined });
    };
    doPing();
    pingRef.current = setInterval(doPing, 10_000);
    return () => { if (pingRef.current) clearInterval(pingRef.current); };
  }, [modId, activeLessonId, pingPresence]);

  // Auto-select first lesson when data loads
  useEffect(() => {
    if (content && content.lessons.length > 0 && !activeLessonId) {
      setActiveLessonId(resolveLessonId(content.lessons, search.lesson));
    }
    // search.lesson only seeds the initial selection (see state->URL sync below)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, activeLessonId]);

  // State -> URL sync so reload / browser Back restore the active lesson.
  useEffect(() => {
    if (activeLessonId && activeLessonId !== search.lesson) {
      void navigate({
        to: '/w/$workspaceId/m/$moduleId',
        params: { workspaceId, moduleId },
        search: { lesson: activeLessonId },
        replace: true,
      });
    }
  }, [activeLessonId, search.lesson, navigate, workspaceId, moduleId]);

  // Tab title: module name
  useDocumentTitle(content ? formatTabTitle([content.module.title]) : null);

  const lessons = useMemo(() => (content?.lessons ?? []) as EditorLesson[], [content]);
  const activeLesson = lessons.find((l) => l._id === activeLessonId) ?? null;
  const activeLessonIndex = activeLesson ? lessons.indexOf(activeLesson) : -1;

  const serverBlocks = useMemo(() => (lessonBlocks ?? []) as EditorBlock[], [lessonBlocks]);

  // Drop a local override once its save has settled (Convex guarantees the
  // query reflects the mutation by then), so we never mask collaborators' edits.
  const clearOverride = useCallback((blockId: string, value: string) => {
    setLocalContent((prev) => {
      if (prev[blockId] !== value) return prev;
      const next = { ...prev };
      delete next[blockId];
      return next;
    });
  }, []);

  const blocksForLesson = useMemo(
    () =>
      serverBlocks.map((b) =>
        localContent[b._id] !== undefined ? { ...b, content: localContent[b._id] } : b,
      ),
    [serverBlocks, localContent],
  );

  const theme = useMemo(() => resolveWorkspaceTheme(workspace?.theme), [workspace?.theme]);

  const selectLesson = useCallback((id: Id<'lessons'>) => {
    setSelectedBlockId(null);
    setActiveLessonId(id);
  }, []);

  const handleSaveBlock = useCallback(
    (blockId: Id<'blocks'>, html: string) => {
      setLocalContent((prev) => ({ ...prev, [blockId]: html }));
      void track(updateContent({ blockId, content: html }))
        .catch(() => undefined)
        .finally(() => clearOverride(blockId, html));
    },
    [updateContent, track, clearOverride],
  );

  const handleLayoutContent = useCallback(
    async (blockId: Id<'blocks'>, newContent: string) => {
      setLocalContent((prev) => ({ ...prev, [blockId]: newContent }));
      try {
        await updateContent({ blockId, content: newContent });
        // The block editors are uncontrolled — remount so they re-read the content.
        setEditorEpochs((prev) => ({ ...prev, [blockId]: (prev[blockId] ?? 0) + 1 }));
      } finally {
        clearOverride(blockId, newContent);
      }
    },
    [updateContent, clearOverride],
  );

  async function handleAddLesson() {
    const id = await addLesson({ moduleId: modId });
    selectLesson(id as Id<'lessons'>);
  }

  const handleAddBlock = useCallback(
    async (type: EditorBlockType, target: InsertTarget) => {
      if (!activeLessonId) return;
      setLibraryTarget(null);
      const afterOrder = insertionAfterOrder(serverBlocks, target);
      const id = await track(
        addBlock({ lessonId: activeLessonId, moduleId: modId, type, afterOrder }),
      );
      setSelectedBlockId(id as Id<'blocks'>);
    },
    [activeLessonId, serverBlocks, addBlock, modId, track],
  );

  const openLibrary = useCallback((target: InsertTarget) => setLibraryTarget(target), []);

  // Keyboard: Escape closes the library, else deselects; "/" opens the library.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (importQuizOpen) return;
      if (e.key === 'Escape') {
        if (libraryTarget) setLibraryTarget(null);
        else setSelectedBlockId(null);
        return;
      }
      if (
        e.key === '/' &&
        !e.ctrlKey && !e.metaKey && !e.altKey &&
        !libraryTarget &&
        activeLessonId &&
        !isTypingTarget(document.activeElement)
      ) {
        e.preventDefault();
        setLibraryTarget(selectedBlockId ? { afterBlockId: selectedBlockId } : 'end');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [importQuizOpen, libraryTarget, selectedBlockId, activeLessonId]);

  if (content === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ground">
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );
  }
  if (content === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ground text-ink-3">
        Module not found.
      </div>
    );
  }

  const mod = content.module;
  const selectedBlock = blocksForLesson.find((b) => b._id === selectedBlockId) ?? null;
  const questionCount = blocksForLesson.filter((b) => b.type === 'mcq' || b.type === 'trueFalse').length;

  let libraryLocation = '';
  if (libraryTarget) {
    const lt = activeLesson?.title ?? 'this lesson';
    if (libraryTarget === 'start') libraryLocation = `Inserting at the start of ${lt}`;
    else if (libraryTarget === 'end') libraryLocation = `Inserting at the end of ${lt}`;
    else {
      const after = blocksForLesson.find((b) => b._id === libraryTarget.afterBlockId);
      const label = after ? (catalogEntry(after.type)?.label ?? after.type) : 'block';
      libraryLocation = `Inserting after "${label}" in ${lt}`;
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ground font-sans text-ink">
      <EditorTopBar
        workspaceId={workspaceId}
        moduleId={moduleId}
        moduleTitle={mod.title}
        lessonTitle={activeLesson?.title ?? null}
        activeLessonId={activeLessonId}
        saving={savingCount > 0}
        presence={presence ?? []}
        onRenameModule={async (title) => {
          await renameModule({ moduleId: modId, title });
        }}
      />

      <div className="flex min-h-0 flex-1">
        <OutlineRail
          workspaceId={workspaceId}
          moduleId={moduleId}
          lessons={lessons}
          activeLessonId={activeLessonId}
          presence={presence ?? []}
          renamingLessonId={renamingLessonId}
          renameValue={renameLessonValue}
          onSelect={selectLesson}
          onStartRename={(lesson) => {
            setRenamingLessonId(lesson._id);
            setRenameLessonValue(lesson.title);
          }}
          onRename={async (lessonId, title) => {
            await renameLesson({ lessonId, title });
            setRenamingLessonId(null);
          }}
          onRenameChange={setRenameLessonValue}
          onCancelRename={() => setRenamingLessonId(null)}
          onDelete={async (lessonId) => {
            await removeLesson({ lessonId });
            if (activeLessonId === lessonId) {
              const remaining = lessons.filter((l) => l._id !== lessonId);
              setSelectedBlockId(null);
              setActiveLessonId(remaining[0]?._id ?? null);
            }
          }}
          onReorder={async (lessonIds) => {
            await reorderLessons({ lessonIds });
          }}
          onAdd={handleAddLesson}
        />

        <LessonCanvas
          lesson={activeLesson}
          lessonIndex={Math.max(0, activeLessonIndex)}
          lessonCount={lessons.length}
          lessons={lessons}
          blocks={blocksForLesson}
          theme={theme}
          selectedBlockId={selectedBlockId}
          editorEpochs={editorEpochs}
          renaming={!!activeLesson && renamingLessonId === activeLesson._id}
          renameValue={renameLessonValue}
          onStartRename={() => {
            if (!activeLesson) return;
            setRenamingLessonId(activeLesson._id);
            setRenameLessonValue(activeLesson.title);
          }}
          onRenameChange={setRenameLessonValue}
          onCommitRename={async () => {
            if (activeLesson && renameLessonValue.trim()) {
              await renameLesson({ lessonId: activeLesson._id, title: renameLessonValue.trim() });
            }
            setRenamingLessonId(null);
          }}
          onCancelRename={() => setRenamingLessonId(null)}
          onSelectBlock={setSelectedBlockId}
          onSaveBlock={handleSaveBlock}
          onDuplicate={async (blockId) => {
            const id = await duplicateBlock({ blockId });
            setSelectedBlockId(id as Id<'blocks'>);
          }}
          onDelete={async (blockId) => {
            if (selectedBlockId === blockId) setSelectedBlockId(null);
            await removeBlock({ blockId });
          }}
          onMoveToLesson={async (blockId, targetLessonId) => {
            await moveBlockToLesson({ blockId, targetLessonId });
            selectLesson(targetLessonId);
          }}
          onReorder={async (blockIds) => {
            await track(reorderBlocks({ blockIds }));
          }}
          onInsert={(type, target) => void handleAddBlock(type, target)}
          onOpenLibrary={openLibrary}
          onAddLesson={handleAddLesson}
        />

        <Inspector
          block={selectedBlock}
          lessonTitle={activeLesson?.title ?? null}
          blockCount={blocksForLesson.length}
          questionCount={questionCount}
          theme={theme}
          onUpdateContent={handleLayoutContent}
          track={track}
        />
      </div>

      {libraryTarget && (
        <BlockLibraryModal
          location={libraryLocation}
          onInsert={(type) => void handleAddBlock(type, libraryTarget)}
          onImportQuestions={() => {
            setLibraryTarget(null);
            setImportQuizOpen(true);
          }}
          onClose={() => setLibraryTarget(null)}
        />
      )}

      {/* Quiz import (Intelligence checklist / CSV) */}
      {importQuizOpen && activeLessonId && (
        <ImportQuizDialog
          workspaceId={wsId}
          moduleId={modId}
          lessonId={activeLessonId}
          onClose={() => setImportQuizOpen(false)}
          onImported={() => setImportQuizOpen(false)}
        />
      )}
    </div>
  );
}

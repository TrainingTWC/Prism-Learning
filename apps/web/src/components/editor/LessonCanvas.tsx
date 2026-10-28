import type { CSSProperties } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Pencil, Plus } from 'lucide-react';
import { BLOCK_STYLE_BASE_CSS, tokensToCss, type Theme } from '@prism/renderer';
import type { Id } from '~convex/_generated/dataModel';
import { collectStorageIds } from '../../lib/rendererBlocks';
import { useAssetUrls } from '../../lib/useAssetUrls';
import { BlockInserter, QuickPicks } from './BlockInserter';
import { CanvasBlock } from './CanvasBlock';
import type { InsertTarget } from './blockCatalog';
import type { EditorBlock, EditorBlockType, EditorLesson } from './types';

interface LessonCanvasProps {
  lesson: EditorLesson | null;
  lessonIndex: number;
  lessonCount: number;
  lessons: EditorLesson[];
  blocks: EditorBlock[];
  theme: Theme;
  selectedBlockId: Id<'blocks'> | null;
  editorEpochs: Record<string, number>;
  renaming: boolean;
  renameValue: string;
  onStartRename: () => void;
  onRenameChange: (v: string) => void;
  onCommitRename: () => Promise<void>;
  onCancelRename: () => void;
  onSelectBlock: (id: Id<'blocks'> | null) => void;
  onSaveBlock: (blockId: Id<'blocks'>, content: string) => void;
  onDuplicate: (blockId: Id<'blocks'>) => Promise<void>;
  onDelete: (blockId: Id<'blocks'>) => Promise<void>;
  onMoveToLesson: (blockId: Id<'blocks'>, target: Id<'lessons'>) => Promise<void>;
  onReorder: (blockIds: Id<'blocks'>[]) => Promise<void>;
  onInsert: (type: EditorBlockType, target: InsertTarget) => void;
  onOpenLibrary: (target: InsertTarget) => void;
  onAddLesson: () => Promise<void>;
  onUpdateContent: (blockId: Id<'blocks'>, content: string) => Promise<void>;
  track: <T>(p: Promise<T>) => Promise<T>;
}

export function LessonCanvas({
  lesson,
  lessonIndex,
  lessonCount,
  lessons,
  blocks,
  theme,
  selectedBlockId,
  editorEpochs,
  renaming,
  renameValue,
  onStartRename,
  onRenameChange,
  onCommitRename,
  onCancelRename,
  onSelectBlock,
  onSaveBlock,
  onDuplicate,
  onDelete,
  onMoveToLesson,
  onReorder,
  onInsert,
  onOpenLibrary,
  onAddLesson,
  onUpdateContent,
  track,
}: LessonCanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const assetMap = useAssetUrls(collectStorageIds(blocks));
  const resolveAsset = (id: string) => assetMap[id] ?? '';

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b._id === active.id);
    const newIndex = blocks.findIndex((b) => b._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...blocks];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved!);
    await onReorder(reordered.map((b) => b._id));
  }

  /** Clicking the canvas background (not a block / inserter) deselects. */
  function onBackgroundClick(e: React.MouseEvent) {
    const el = e.target as HTMLElement;
    if (el.closest('[data-canvas-block]') || el.closest('[data-inserter]') || el.closest('[data-keep-selection]')) {
      return;
    }
    onSelectBlock(null);
  }

  if (!lesson) {
    return (
      <main className="flex flex-1 items-center justify-center bg-ground">
        <div className="text-center text-ink-3">
          <p className="text-sm">Select or create a lesson to start editing</p>
          <button
            type="button"
            onClick={() => void onAddLesson()}
            className="mx-auto mt-3 flex items-center gap-1.5 rounded-[10px] bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-ink"
          >
            <Plus className="size-4" /> Add lesson
          </button>
        </div>
      </main>
    );
  }

  const paperStyle = {
    ...tokensToCss(theme),
    '--prism-block-bleed': '56px',
  } as CSSProperties;

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-ground px-6 pb-24 pt-8" onClick={onBackgroundClick}>
      <div
        className="prism-module mx-auto w-full max-w-[860px] rounded-[18px] bg-white px-14 pb-12 pt-12 shadow-[0_1px_2px_rgba(23,23,28,0.06),0_8px_24px_rgba(23,23,28,0.05)]"
        style={paperStyle}
      >
        <style>{BLOCK_STYLE_BASE_CSS}</style>
        <header className="mb-6" data-keep-selection>
          <p
            className="text-[13px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: theme.primary }}
          >
            Lesson {lessonIndex + 1} of {lessonCount}
          </p>
          {renaming ? (
            <input
              autoFocus
              aria-label="Lesson title"
              className="mt-2 w-full border-b-2 bg-transparent text-[34px] font-extrabold leading-tight outline-none"
              style={{ borderColor: theme.primary, fontFamily: 'var(--prism-font-heading)', color: 'var(--prism-heading-color)' }}
              value={renameValue}
              onChange={(e) => onRenameChange(e.target.value)}
              onBlur={() => void onCommitRename()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') onCancelRename();
              }}
            />
          ) : (
            <div className="group mt-2 flex items-start gap-3">
              <h1
                className="cursor-text text-[34px] font-extrabold leading-tight"
                style={{ fontFamily: 'var(--prism-font-heading)', color: 'var(--prism-heading-color)' }}
                onClick={onStartRename}
                title="Click to rename"
              >
                {lesson.title}
              </h1>
              <button
                type="button"
                onClick={onStartRename}
                aria-label="Rename lesson"
                title="Rename lesson"
                className="mt-2 rounded p-1 text-ink-3 opacity-0 hover:bg-hover hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Pencil className="size-4" />
              </button>
            </div>
          )}
        </header>

        {blocks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[12px] border border-dashed border-line px-6 py-14 text-center font-sans">
            <p className="text-sm font-medium text-ink">This lesson is empty</p>
            <p className="text-[13px] text-ink-3">Add your first block to get started.</p>
            <QuickPicks
              onPick={(t) => onInsert(t, 'end')}
              onOpenLibrary={() => onOpenLibrary('end')}
            />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => void handleDragEnd(e)}
          >
            <SortableContext items={blocks.map((b) => b._id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col font-sans">
                <BlockInserter
                  onPick={(t) => onInsert(t, 'start')}
                  onOpenLibrary={() => onOpenLibrary('start')}
                />
                {blocks.map((block) => (
                  <div key={block._id} className="flex flex-col">
                    <CanvasBlock
                      block={block}
                      lessons={lessons}
                      theme={theme}
                      resolveAsset={resolveAsset}
                      selected={selectedBlockId === block._id}
                      editorEpoch={editorEpochs[block._id] ?? 0}
                      onSelect={() => onSelectBlock(block._id)}
                      onSave={(content) => onSaveBlock(block._id, content)}
                      onDuplicate={() => onDuplicate(block._id)}
                      onDelete={() => onDelete(block._id)}
                      onMoveToLesson={(target) => onMoveToLesson(block._id, target)}
                      onSlashCommand={() => onOpenLibrary({ afterBlockId: block._id })}
                      onUpdateContent={onUpdateContent}
                      track={track}
                    />
                    <BlockInserter
                      onPick={(t) => onInsert(t, { afterBlockId: block._id })}
                      onOpenLibrary={() => onOpenLibrary({ afterBlockId: block._id })}
                    />
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </main>
  );
}

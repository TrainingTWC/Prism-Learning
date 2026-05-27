import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { Link, useParams } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  ChevronLeft,
  Loader2,
  GripVertical,
  Pencil,
  Trash2,
  Copy,
  MoreHorizontal,
  Users,
  Type,
  ImageIcon,
  Video,
  Zap,
  ChevronDown,
  CheckCircle2,
  ToggleLeft,
  AlignJustify,
} from 'lucide-react';
import { RichTextBlockEditor } from '../components/RichTextBlockEditor';
import { ImageBlockEditor } from '../components/ImageBlockEditor';
import { VideoBlockEditor } from '../components/VideoBlockEditor';
import { LottieBlockEditor } from '../components/LottieBlockEditor';
import { MCQBlockEditor } from '../components/MCQBlockEditor';
import { TrueFalseBlockEditor } from '../components/TrueFalseBlockEditor';
import { AccordionBlockEditor } from '../components/AccordionBlockEditor';

// ── Types ──────────────────────────────────────────────────────────────────

type Lesson = {
  _id: Id<'lessons'>;
  title: string;
  order: number;
  createdAt: number;
  moduleId: Id<'modules'>;
};

type BlockType = 'richText' | 'image' | 'video' | 'lottie' | 'mcq' | 'trueFalse' | 'accordion';

type Block = {
  _id: Id<'blocks'>;
  lessonId: Id<'lessons'>;
  moduleId: Id<'modules'>;
  type: BlockType;
  order: number;
  content?: string;
  updatedAt: number;
  lastEditedBy?: Id<'users'>;
};

const BLOCK_TYPES: { type: BlockType; label: string; icon: React.ReactNode }[] = [
  { type: 'richText',  label: 'Rich text',       icon: <Type className="size-3.5" /> },
  { type: 'image',     label: 'Image',            icon: <ImageIcon className="size-3.5" /> },
  { type: 'video',     label: 'Video',            icon: <Video className="size-3.5" /> },
  { type: 'lottie',    label: 'Animation',        icon: <Zap className="size-3.5" /> },
  { type: 'mcq',       label: 'Multiple choice',  icon: <CheckCircle2 className="size-3.5" /> },
  { type: 'trueFalse', label: 'True / False',     icon: <ToggleLeft className="size-3.5" /> },
  { type: 'accordion', label: 'Accordion',        icon: <AlignJustify className="size-3.5" /> },
];

// ── Main Page ──────────────────────────────────────────────────────────────

export function ModuleEditorPage() {
  const { workspaceId, moduleId } = useParams({
    from: '/protected/w/$workspaceId/m/$moduleId',
  });
  const wsId = workspaceId as Id<'workspaces'>;
  const modId = moduleId as Id<'modules'>;

  const content = useQuery(api.modules.getWithContent, { moduleId: modId });
  const presence = useQuery(api.presence.list, { moduleId: modId });

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

  const pingPresence = useMutation(api.presence.ping);

  const [activeLessonId, setActiveLessonId] = useState<Id<'lessons'> | null>(null);
  const [renamingLessonId, setRenamingLessonId] = useState<string | null>(null);
  const [renameLessonValue, setRenameLessonValue] = useState('');
  const [renamingModule, setRenamingModule] = useState(false);
  const [renameModuleValue, setRenameModuleValue] = useState('');
  const [blockMenuId, setBlockMenuId] = useState<string | null>(null);
  const [addBlockMenuOpen, setAddBlockMenuOpen] = useState(false);

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
      setActiveLessonId(content.lessons[0]!._id);
    }
  }, [content, activeLessonId]);

  const lessons = (content?.lessons ?? []) as Lesson[];
  const activeLesson = lessons.find((l) => l._id === activeLessonId) ?? null;
  const blocksForLesson = ((content?.blocks ?? []) as Block[]).filter(
    (b) => b.lessonId === activeLessonId,
  );

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleLessonDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = lessons.findIndex((l) => l._id === active.id);
    const newIndex = lessons.findIndex((l) => l._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...lessons];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved!);
    await reorderLessons({ lessonIds: reordered.map((l) => l._id) });
  }

  async function handleBlockDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocksForLesson.findIndex((b) => b._id === active.id);
    const newIndex = blocksForLesson.findIndex((b) => b._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...blocksForLesson];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved!);
    await reorderBlocks({ blockIds: reordered.map((b) => b._id) });
  }

  const handleSaveBlock = useCallback(
    (blockId: Id<'blocks'>, html: string) => {
      void updateContent({ blockId, content: html });
    },
    [updateContent],
  );

  async function handleAddLesson() {
    const id = await addLesson({ moduleId: modId });
    setActiveLessonId(id as Id<'lessons'>);
  }

  async function handleAddBlock(type: BlockType = 'richText') {
    if (!activeLessonId) return;
    setAddBlockMenuOpen(false);
    const lastBlock = blocksForLesson[blocksForLesson.length - 1];
    await addBlock({
      lessonId: activeLessonId,
      moduleId: modId,
      type,
      afterOrder: lastBlock?.order,
    });
  }

  if (content === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-indigo-500" />
      </div>
    );
  }
  if (content === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Module not found.
      </div>
    );
  }

  const mod = content.module;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to="/w/$workspaceId/modules"
            params={{ workspaceId }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronLeft className="size-5" />
          </Link>
          {renamingModule ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await renameModule({ moduleId: modId, title: renameModuleValue });
                setRenamingModule(false);
              }}
            >
              <input
                autoFocus
                value={renameModuleValue}
                onChange={(e) => setRenameModuleValue(e.target.value)}
                onBlur={async () => {
                  await renameModule({ moduleId: modId, title: renameModuleValue });
                  setRenamingModule(false);
                }}
                onKeyDown={(e) => e.key === 'Escape' && setRenamingModule(false)}
                className="rounded border border-indigo-300 px-2 py-0.5 text-sm font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 w-64"
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRenameModuleValue(mod.title);
                setRenamingModule(true);
              }}
              className="truncate max-w-xs text-sm font-semibold text-slate-800 hover:text-indigo-600"
              title="Click to rename"
            >
              {mod.title}
            </button>
          )}
        </div>

        {/* Presence avatars */}
        <div className="flex items-center gap-2">
          {(presence ?? []).length > 0 && (
            <div className="flex items-center gap-1">
              <Users className="size-3.5 text-slate-400" />
              <div className="flex -space-x-1.5">
                {(presence ?? []).slice(0, 4).map((p) => (
                  <div
                    key={p._id}
                    title={p.displayName}
                    className="flex size-6 items-center justify-center rounded-full border-2 border-white bg-indigo-500 text-[9px] font-bold text-white"
                  >
                    {p.displayName.slice(0, 1).toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
              mod.status === 'published'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {mod.status}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Lessons sidebar */}
        <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Lessons
            </span>
            <button
              type="button"
              onClick={() => void handleAddLesson()}
              title="Add lesson"
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
            >
              <Plus className="size-4" />
            </button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => void handleLessonDragEnd(e)}
          >
            <SortableContext
              items={lessons.map((l) => l._id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex-1 overflow-y-auto py-1">
                {lessons.map((lesson) => (
                  <SortableLesson
                    key={lesson._id}
                    lesson={lesson}
                    isActive={activeLessonId === lesson._id}
                    isRenaming={renamingLessonId === lesson._id}
                    renameValue={renameLessonValue}
                    onSelect={() => setActiveLessonId(lesson._id)}
                    onStartRename={() => {
                      setRenamingLessonId(lesson._id);
                      setRenameLessonValue(lesson.title);
                    }}
                    onRename={async (title) => {
                      await renameLesson({ lessonId: lesson._id, title });
                      setRenamingLessonId(null);
                    }}
                    onRenameChange={setRenameLessonValue}
                    onCancelRename={() => setRenamingLessonId(null)}
                    onDelete={async () => {
                      await removeLesson({ lessonId: lesson._id });
                      if (activeLessonId === lesson._id) {
                        const remaining = lessons.filter((l) => l._id !== lesson._id);
                        setActiveLessonId(remaining[0]?._id ?? null);
                      }
                    }}
                  />
                ))}
                {lessons.length === 0 && (
                  <li className="px-4 py-6 text-center text-xs text-slate-400">
                    No lessons yet
                  </li>
                )}
              </ul>
            </SortableContext>
          </DndContext>
        </aside>

        {/* Block canvas */}
        <main className="flex-1 overflow-y-auto">
          {!activeLesson ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-slate-400">
                <p className="text-sm">Select or create a lesson to start editing</p>
                <button
                  type="button"
                  onClick={() => void handleAddLesson()}
                  className="mt-3 flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 mx-auto"
                >
                  <Plus className="size-4" /> Add lesson
                </button>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl px-6 py-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-700">{activeLesson.title}</h2>
              </div>

              {/* Blocks */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => void handleBlockDragEnd(e)}
              >
                <SortableContext
                  items={blocksForLesson.map((b) => b._id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {blocksForLesson.map((block) => (
                      <SortableBlock
                        key={block._id}
                        block={block}
                        menuOpen={blockMenuId === block._id}
                        onToggleMenu={() =>
                          setBlockMenuId(blockMenuId === block._id ? null : block._id)
                        }
                        onSave={(html) => handleSaveBlock(block._id, html)}
                        onDelete={async () => {
                          setBlockMenuId(null);
                          await removeBlock({ blockId: block._id });
                        }}
                        onDuplicate={async () => {
                          setBlockMenuId(null);
                          await duplicateBlock({ blockId: block._id });
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Add block button + type picker */}
              <div className="relative">
                <div className="flex items-stretch rounded-xl border-2 border-dashed border-slate-200 overflow-hidden hover:border-indigo-300 transition-colors">
                  <button
                    type="button"
                    onClick={() => void handleAddBlock('richText')}
                    className="flex flex-1 items-center justify-center gap-2 py-4 text-sm text-slate-400 hover:text-indigo-500 transition-colors"
                  >
                    <Plus className="size-4" /> Add block
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddBlockMenuOpen((o) => !o)}
                    className="flex items-center px-3 text-slate-300 hover:text-indigo-500 border-l-2 border-dashed border-slate-200 transition-colors"
                    title="Choose block type"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>
                {addBlockMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-1 w-48 rounded-xl border border-slate-200 bg-white shadow-lg py-1 z-20">
                    {BLOCK_TYPES.map(({ type, label, icon }) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => void handleAddBlock(type)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span className="text-slate-400">{icon}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── SortableLesson ─────────────────────────────────────────────────────────

function SortableLesson({
  lesson,
  isActive,
  isRenaming,
  renameValue,
  onSelect,
  onStartRename,
  onRename,
  onRenameChange,
  onCancelRename,
  onDelete,
}: {
  lesson: Lesson;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  onSelect: () => void;
  onStartRename: () => void;
  onRename: (title: string) => Promise<void>;
  onRenameChange: (v: string) => void;
  onCancelRename: () => void;
  onDelete: () => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson._id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-1 px-2 py-1.5 text-sm ${
        isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab p-0.5 text-slate-300 opacity-0 group-hover:opacity-100 touch-none"
      >
        <GripVertical className="size-3.5" />
      </button>

      {isRenaming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onRename(renameValue);
          }}
          className="flex-1"
        >
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={() => void onRename(renameValue)}
            onKeyDown={(e) => e.key === 'Escape' && onCancelRename()}
            className="w-full rounded border border-indigo-300 px-1.5 py-0.5 text-xs outline-none"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={onStartRename}
          className="flex-1 truncate text-left text-xs"
        >
          {lesson.title}
        </button>
      )}

      {/* Actions */}
      {!isRenaming && (
        <div className="flex shrink-0 items-center opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={onStartRename}
            className="rounded p-0.5 hover:bg-slate-200"
            title="Rename"
          >
            <Pencil className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => void onDelete()}
            className="rounded p-0.5 text-red-400 hover:bg-red-50"
            title="Delete"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      )}
    </li>
  );
}

// ── SortableBlock ──────────────────────────────────────────────────────────

function SortableBlock({
  block,
  menuOpen,
  onToggleMenu,
  onSave,
  onDelete,
  onDuplicate,
}: {
  block: Block;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onSave: (html: string) => void;
  onDelete: () => Promise<void>;
  onDuplicate: () => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block._id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative flex gap-2">
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="mt-3 cursor-grab self-start p-1 text-slate-300 opacity-0 group-hover:opacity-100 touch-none"
      >
        <GripVertical className="size-4" />
      </button>

      {/* Block content */}
      <div className="flex-1">
        {block.type === 'richText' && (
          <RichTextBlockEditor
            blockId={block._id}
            initialContent={block.content ?? '<p></p>'}
            onSave={onSave}
          />
        )}
        {block.type === 'image' && (
          <ImageBlockEditor
            blockId={block._id}
            initialContent={block.content}
            onSave={onSave}
          />
        )}
        {block.type === 'video' && (
          <VideoBlockEditor
            blockId={block._id}
            initialContent={block.content}
            onSave={onSave}
          />
        )}
        {block.type === 'lottie' && (
          <LottieBlockEditor
            blockId={block._id}
            initialContent={block.content}
            onSave={onSave}
          />
        )}
        {block.type === 'mcq' && (
          <MCQBlockEditor
            blockId={block._id}
            initialContent={block.content}
            onSave={onSave}
          />
        )}
        {block.type === 'trueFalse' && (
          <TrueFalseBlockEditor
            blockId={block._id}
            initialContent={block.content}
            onSave={onSave}
          />
        )}
        {block.type === 'accordion' && (
          <AccordionBlockEditor
            blockId={block._id}
            initialContent={block.content}
            onSave={onSave}
          />
        )}
      </div>

      {/* Context menu */}
      <div className="relative mt-3 shrink-0 self-start">
        <button
          type="button"
          onClick={onToggleMenu}
          className="rounded p-1 text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-600"
        >
          <MoreHorizontal className="size-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-7 z-20 w-36 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
            <button
              type="button"
              onClick={() => void onDuplicate()}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Copy className="size-3.5" /> Duplicate
            </button>
            <hr className="my-1 border-slate-100" />
            <button
              type="button"
              onClick={() => void onDelete()}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

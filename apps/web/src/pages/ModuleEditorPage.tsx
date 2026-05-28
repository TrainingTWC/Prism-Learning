import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useConvex } from 'convex/react';
import { Link, useParams } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { buildScormPackage, downloadBlob } from '../lib/scormExport';
import type { ExportTheme } from '../lib/scormExport';
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
  Users,
  Type,
  ImageIcon,
  Video,
  Zap,
  CheckCircle2,
  ToggleLeft,
  AlignJustify,
  Eye,
  Download,
  Quote,
  AlertCircle,
  Minus,
  CreditCard,
  ListOrdered,
  PanelTop,
  MousePointerClick,
  Code2,
  X,
} from 'lucide-react';
import { RichTextBlockEditor } from '../components/RichTextBlockEditor';
import { ImageBlockEditor } from '../components/ImageBlockEditor';
import { VideoBlockEditor } from '../components/VideoBlockEditor';
import { LottieBlockEditor } from '../components/LottieBlockEditor';
import { MCQBlockEditor } from '../components/MCQBlockEditor';
import { TrueFalseBlockEditor } from '../components/TrueFalseBlockEditor';
import { AccordionBlockEditor } from '../components/AccordionBlockEditor';
import { QuoteBlockEditor } from '../components/QuoteBlockEditor';
import { CalloutBlockEditor } from '../components/CalloutBlockEditor';
import { DividerBlockEditor } from '../components/DividerBlockEditor';
import { FlashcardBlockEditor } from '../components/FlashcardBlockEditor';
import { ProcessBlockEditor } from '../components/ProcessBlockEditor';
import { TabsBlockEditor } from '../components/TabsBlockEditor';
import { ButtonBlockEditor } from '../components/ButtonBlockEditor';
import { CustomHtmlBlockEditor } from '../components/CustomHtmlBlockEditor';

// ── Types ──────────────────────────────────────────────────────────────────

type Lesson = {
  _id: Id<'lessons'>;
  title: string;
  order: number;
  createdAt: number;
  moduleId: Id<'modules'>;
};

type BlockType = 'richText' | 'image' | 'video' | 'lottie' | 'mcq' | 'trueFalse' | 'accordion' | 'quote' | 'callout' | 'divider' | 'flashcard' | 'process' | 'tabs' | 'button' | 'customHtml';

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

const BLOCK_TYPES: { type: BlockType; label: string; icon: React.ReactNode; group: string }[] = [
  // Content
  { type: 'richText',   label: 'Rich text',       icon: <Type className="size-3.5" />,              group: 'Content' },
  { type: 'image',      label: 'Image',            icon: <ImageIcon className="size-3.5" />,         group: 'Content' },
  { type: 'video',      label: 'Video',            icon: <Video className="size-3.5" />,             group: 'Content' },
  { type: 'lottie',     label: 'Animation',        icon: <Zap className="size-3.5" />,               group: 'Content' },
  { type: 'quote',      label: 'Pull Quote',       icon: <Quote className="size-3.5" />,             group: 'Content' },
  { type: 'callout',    label: 'Callout',          icon: <AlertCircle className="size-3.5" />,       group: 'Content' },
  { type: 'button',     label: 'Button',           icon: <MousePointerClick className="size-3.5" />, group: 'Content' },
  { type: 'divider',    label: 'Divider',          icon: <Minus className="size-3.5" />,             group: 'Content' },
  // Interactive
  { type: 'mcq',        label: 'Multiple choice',  icon: <CheckCircle2 className="size-3.5" />,      group: 'Interactive' },
  { type: 'trueFalse',  label: 'True / False',     icon: <ToggleLeft className="size-3.5" />,        group: 'Interactive' },
  { type: 'flashcard',  label: 'Flashcards',       icon: <CreditCard className="size-3.5" />,        group: 'Interactive' },
  // Layout
  { type: 'accordion',  label: 'Accordion',        icon: <AlignJustify className="size-3.5" />,      group: 'Layout' },
  { type: 'tabs',       label: 'Tabs',             icon: <PanelTop className="size-3.5" />,          group: 'Layout' },
  { type: 'process',    label: 'Process',          icon: <ListOrdered className="size-3.5" />,       group: 'Layout' },
  // Advanced
  { type: 'customHtml', label: 'Custom HTML',      icon: <Code2 className="size-3.5" />,             group: 'Advanced' },
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
  const workspace = useQuery(api.workspaces.getById, { workspaceId: wsId });
  const convex = useConvex();

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
  const [addBlockMenuOpen, setAddBlockMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportScorm = useCallback(async () => {
    if (!content) return;
    setExporting(true);
    try {
      const theme: ExportTheme = workspace?.theme ?? {
        primary: '#4f46e5', accent: '#10b981', headingFont: 'Inter', bodyFont: 'Inter',
      };
      const blob = await buildScormPackage(
        {
          id: modId,
          title: content.module.title,
          lessons: content.lessons.map((l) => ({
            id: l._id,
            title: l.title,
            blocks: (content.blocks as Block[])
              .filter((b) => b.lessonId === l._id)
              .sort((a, b) => a.order - b.order)
              .map((b) => ({ id: b._id, type: b.type, content: b.content })),
          })),
        },
        theme,
        async (storageId) => {
          const url = await convex.query(api.files.getFileUrl, { storageId });
          return url ?? '';
        },
      );
      const slug = content.module.title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      downloadBlob(blob, `${slug}_scorm12.zip`);
    } finally {
      setExporting(false);
    }
  }, [content, workspace, modId, convex]);

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
      <div className="prism-brand-screen flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-indigo-500" />
      </div>
    );
  }
  if (content === null) {
    return (
      <div className="prism-brand-screen flex min-h-screen items-center justify-center text-slate-500">
        Module not found.
      </div>
    );
  }

  const mod = content.module;

  return (
    <div className="prism-brand-screen flex h-screen flex-col overflow-hidden bg-slate-50">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/w/$workspaceId/modules"
            params={{ workspaceId }}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
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
                className="rounded-lg border border-indigo-300 px-3 py-1 text-base font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-400 w-72"
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRenameModuleValue(mod.title);
                setRenamingModule(true);
              }}
              className="group flex items-center gap-2 truncate max-w-sm text-base font-semibold text-slate-800 hover:text-indigo-600"
              title="Click to rename"
            >
              {mod.title}
              <Pencil className="size-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
            </button>
          )}
        </div>

        {/* Presence + actions */}
        <div className="flex items-center gap-3">
          {(presence ?? []).length > 0 && (
            <div className="flex items-center gap-1.5">
              <Users className="size-4 text-slate-400" />
              <div className="flex -space-x-1.5">
                {(presence ?? []).slice(0, 4).map((p) => (
                  <div
                    key={p._id}
                    title={p.displayName}
                    className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-indigo-500 text-[10px] font-bold text-white"
                  >
                    {p.displayName.slice(0, 1).toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
          )}
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
              mod.status === 'published'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {mod.status}
          </span>
          <Link
            to="/w/$workspaceId/m/$moduleId/preview"
            params={{ workspaceId, moduleId }}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800"
          >
            <Eye className="size-4" />
            Preview
          </Link>
          <button
            type="button"
            onClick={() => void handleExportScorm()}
            disabled={exporting}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {exporting ? 'Building…' : 'Export SCORM'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Lessons sidebar */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Lessons
            </span>
            <span className="text-xs text-slate-400">{lessons.length}</span>
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
              <ul className="flex-1 overflow-y-auto py-2">
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
                  <li className="px-4 py-8 text-center text-sm text-slate-400">
                    No lessons yet
                  </li>
                )}
              </ul>
              {/* Add lesson button at bottom */}
              <div className="shrink-0 border-t border-slate-100 p-3">
                <button
                  type="button"
                  onClick={() => void handleAddLesson()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-2.5 text-sm font-medium text-slate-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                >
                  <Plus className="size-4" /> Add lesson
                </button>
              </div>
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
            <div className="mx-auto max-w-3xl px-8 py-8 space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-800">{activeLesson.title}</h2>
                <button
                  type="button"
                  onClick={() => { setRenamingLessonId(activeLesson._id); setRenameLessonValue(activeLesson.title); }}
                  className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                  title="Rename lesson"
                >
                  <Pencil className="size-4" />
                </button>
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
                        onSave={(html) => handleSaveBlock(block._id, html)}
                        onDelete={async () => {
                          await removeBlock({ blockId: block._id });
                        }}
                        onDuplicate={async () => {
                          await duplicateBlock({ blockId: block._id });
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Add block */}
              {addBlockMenuOpen ? (
                <div className="rounded-2xl border-2 border-indigo-200 bg-white shadow-sm p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-indigo-600">Insert block</span>
                    <button
                      type="button"
                      onClick={() => setAddBlockMenuOpen(false)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  {['Content', 'Interactive', 'Layout', 'Advanced'].map((group) => (
                    <div key={group} className="mb-4 last:mb-0">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{group}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {BLOCK_TYPES.filter((bt) => bt.group === group).map(({ type, label, icon }) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => void handleAddBlock(type)}
                            className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-center hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                          >
                            <span className="[&>svg]:size-5 text-slate-500">{icon}</span>
                            <span className="text-[11px] font-medium text-slate-600 leading-tight">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddBlockMenuOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-5 text-sm font-semibold text-slate-400 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-500"
                >
                  <Plus className="size-5" /> Add block
                </button>
              )}
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
      className={`flex items-center gap-2 px-3 py-2.5 ${
        isActive
          ? 'bg-indigo-50 border-r-2 border-indigo-500 text-indigo-700'
          : 'text-slate-700 hover:bg-slate-50 border-r-2 border-transparent'
      }`}
    >
      {/* Drag handle — always visible */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab shrink-0 p-0.5 text-slate-300 hover:text-slate-500 touch-none"
      >
        <GripVertical className="size-4" />
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
            className="w-full rounded-lg border border-indigo-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={onStartRename}
          className="flex-1 truncate text-left text-sm font-medium"
        >
          {lesson.title}
        </button>
      )}

      {/* Actions — always visible */}
      {!isRenaming && (
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onStartRename}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            title="Rename"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void onDelete()}
            className="rounded-md p-1 text-slate-300 hover:bg-red-50 hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
    </li>
  );
}

// ── SortableBlock ──────────────────────────────────────────────────────────

function SortableBlock({
  block,
  onSave,
  onDelete,
  onDuplicate,
}: {
  block: Block;
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
    <div ref={setNodeRef} style={style} className="flex gap-2">
      {/* Drag handle — always visible */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="mt-4 cursor-grab self-start p-1.5 text-slate-300 hover:text-slate-500 touch-none rounded-lg hover:bg-slate-100"
        title="Drag to reorder"
      >
        <GripVertical className="size-5" />
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
        {block.type === 'quote' && (
          <QuoteBlockEditor
            blockId={block._id}
            initialContent={block.content}
            onSave={onSave}
          />
        )}
        {block.type === 'callout' && (
          <CalloutBlockEditor
            blockId={block._id}
            initialContent={block.content}
            onSave={onSave}
          />
        )}
        {block.type === 'divider' && (
          <DividerBlockEditor
            blockId={block._id}
            initialContent={block.content}
            onSave={onSave}
          />
        )}
        {block.type === 'flashcard' && (
          <FlashcardBlockEditor
            blockId={block._id}
            initialContent={block.content}
            onSave={onSave}
          />
        )}
        {block.type === 'process' && (
          <ProcessBlockEditor
            blockId={block._id}
            initialContent={block.content}
            onSave={onSave}
          />
        )}
        {block.type === 'tabs' && (
          <TabsBlockEditor
            blockId={block._id}
            initialContent={block.content}
            onSave={onSave}
          />
        )}
        {block.type === 'button' && (
          <ButtonBlockEditor
            blockId={block._id}
            initialContent={block.content}
            onSave={onSave}
          />
        )}
        {block.type === 'customHtml' && (
          <CustomHtmlBlockEditor
            blockId={block._id}
            initialContent={block.content}
            onSave={onSave}
          />
        )}
      </div>

      {/* Block actions — always visible */}
      <div className="mt-4 flex shrink-0 flex-col self-start gap-1">
        <button
          type="button"
          onClick={() => void onDuplicate()}
          className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          title="Duplicate block"
        >
          <Copy className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => void onDelete()}
          className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-400 transition-colors"
          title="Delete block"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

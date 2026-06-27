import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useConvex } from 'convex/react';
import { Link, useParams } from '@tanstack/react-router';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { buildScormPackage, downloadBlob } from '../lib/scormExport';
import type { ExportTheme, ExportOptions } from '../lib/scormExport';
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
  ChevronRight,
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
  Sun,
  Moon,
  Target,
  Images,
  ArrowLeftRight,
  Music,
  Tag,
  Layers,
  GitMerge,
  ArrowUpDown,
  GitBranch,
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
import { HotspotsBlockEditor } from '../components/HotspotsBlockEditor';
import { GalleryBlockEditor } from '../components/GalleryBlockEditor';
import { CompareBlockEditor } from '../components/CompareBlockEditor';
import { AudioBlockEditor } from '../components/AudioBlockEditor';
import { LabeledGraphicBlockEditor } from '../components/LabeledGraphicBlockEditor';
import { FillBlanksBlockEditor } from '../components/FillBlanksBlockEditor';
import { MatchingBlockEditor } from '../components/MatchingBlockEditor';
import { SortingBlockEditor } from '../components/SortingBlockEditor';
import { ScenarioBlockEditor } from '../components/ScenarioBlockEditor';

// ── Types ──────────────────────────────────────────────────────────────────

type Lesson = {
  _id: Id<'lessons'>;
  title: string;
  order: number;
  createdAt: number;
  moduleId: Id<'modules'>;
};

type BlockType = 'richText' | 'image' | 'video' | 'lottie' | 'mcq' | 'trueFalse' | 'accordion' | 'quote' | 'callout' | 'divider' | 'flashcard' | 'process' | 'tabs' | 'button' | 'customHtml' | 'hotspots' | 'gallery' | 'compare' | 'audio' | 'labeledGraphic' | 'fillBlanks' | 'matching' | 'sorting' | 'scenario';

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
  { type: 'fillBlanks', label: 'Fill blanks',      icon: <Type className="size-3.5" />,              group: 'Interactive' },
  { type: 'matching',   label: 'Matching',         icon: <GitMerge className="size-3.5" />,          group: 'Interactive' },
  { type: 'sorting',    label: 'Sort order',       icon: <ArrowUpDown className="size-3.5" />,       group: 'Interactive' },
  // Media
  { type: 'audio',          label: 'Audio',            icon: <Music className="size-3.5" />,          group: 'Media' },
  { type: 'gallery',        label: 'Gallery',          icon: <Images className="size-3.5" />,         group: 'Media' },
  { type: 'compare',        label: 'Before / after',   icon: <ArrowLeftRight className="size-3.5" />, group: 'Media' },
  { type: 'hotspots',       label: 'Hotspots',         icon: <Target className="size-3.5" />,         group: 'Media' },
  { type: 'labeledGraphic', label: 'Labeled graphic',  icon: <Tag className="size-3.5" />,            group: 'Media' },
  // Layout
  { type: 'accordion',  label: 'Accordion',        icon: <AlignJustify className="size-3.5" />,      group: 'Layout' },
  { type: 'tabs',       label: 'Tabs',             icon: <PanelTop className="size-3.5" />,          group: 'Layout' },
  { type: 'process',    label: 'Process',          icon: <ListOrdered className="size-3.5" />,       group: 'Layout' },
  // Scenario
  { type: 'scenario',   label: 'Branching scenario', icon: <GitBranch className="size-3.5" />,       group: 'Scenario' },
  // Advanced
  { type: 'customHtml', label: 'Custom HTML',      icon: <Code2 className="size-3.5" />,             group: 'Advanced' },
];

const BLOCK_DESCRIPTIONS: Record<BlockType, string> = {
  richText:      'Formatted text, headings, lists and links',
  image:         'Single image with optional caption',
  video:         'YouTube or Vimeo embed player',
  lottie:        'Lottie JSON animation loop',
  quote:         'Highlighted pull quote block',
  callout:       'Info, warning or tip callout box',
  button:        'Clickable call-to-action button',
  divider:       'Horizontal separator line',
  mcq:           'Multiple-choice question with scored feedback',
  trueFalse:     'True / false question with explanation',
  flashcard:     'Flip-card deck for memorisation',
  fillBlanks:    'Fill-in-the-blank cloze exercise',
  matching:      'Drag-and-match pairs activity',
  sorting:       'Drag items into the correct order',
  audio:         'Embedded audio file player',
  gallery:       'Image grid or carousel',
  compare:       'Before-and-after image slider',
  hotspots:      'Image with clickable info markers',
  labeledGraphic:'Image with labelled annotation pins',
  accordion:     'Collapsible expand / collapse sections',
  tabs:          'Tabbed content panels',
  process:       'Numbered step-by-step process',
  scenario:      'Branching scenario with choices',
  customHtml:    'Raw HTML or embed code',
};

// ── Main Page ──────────────────────────────────────────────────────────────

export function ModuleEditorPage() {
  const { workspaceId, moduleId } = useParams({
    from: '/protected/w/$workspaceId/m/$moduleId',
  });
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
  const moveBlockToLesson = useMutation(api.blocks.moveToLesson);

  const pingPresence = useMutation(api.presence.ping);

  const [renamingLessonId, setRenamingLessonId] = useState<string | null>(null);
  const [renameLessonValue, setRenameLessonValue] = useState('');
  const [renamingModule, setRenamingModule] = useState(false);
  const [renameModuleValue, setRenameModuleValue] = useState('');
  const [lessonsOpen, setLessonsOpen] = useState(true);
  // null = insert before first block, undefined = append at end, number = insert after that order
  const [insertAfterOrder, setInsertAfterOrder] = useState<number | null | undefined>(undefined);
  const [exporting, setExporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({ passingScore: 80, completionCriteria: 'completed' });
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => localStorage.getItem('prism-theme') === 'light' ? 'light' : 'dark'
  );

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('prism-theme', theme);
  }, [theme]);

  const handleExportScorm = useCallback(async (opts: ExportOptions) => {
    if (!content) return;
    setExporting(true);
    setExportDialogOpen(false);
    try {
      const theme: ExportTheme = workspace?.theme ?? {
        primary: '#4f46e5', accent: '#aa75dd', headingFont: 'Inter', bodyFont: 'Inter',
      };
      // Fetch all blocks at export time (one-shot, not a live subscription)
      const allBlocks = (await convex.query(api.blocks.listByModule, { moduleId: modId })) as Block[];
      const blob = await buildScormPackage(
        {
          id: modId,
          title: content.module.title,
          lessons: content.lessons.map((l) => ({
            id: l._id,
            title: l.title,
            blocks: allBlocks
              .filter((b) => b.lessonId === l._id)
              .map((b) => ({ id: b._id, type: b.type, content: b.content })),
          })),
        },
        theme,
        opts,
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
  const blocksForLesson = (lessonBlocks ?? []) as Block[];

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
    let afterOrder: number | undefined;
    if (insertAfterOrder === null) {
      // Insert before first block
      const firstBlock = blocksForLesson[0];
      afterOrder = firstBlock ? firstBlock.order - 2000 : undefined;
    } else if (insertAfterOrder !== undefined) {
      afterOrder = insertAfterOrder;
    } else {
      // Append at end
      const lastBlock = blocksForLesson[blocksForLesson.length - 1];
      afterOrder = lastBlock?.order;
    }
    setInsertAfterOrder(undefined);
    await addBlock({
      lessonId: activeLessonId,
      moduleId: modId,
      type,
      afterOrder,
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
    <div className="prism-brand-screen flex h-screen flex-col overflow-hidden bg-[var(--bg-primary)]">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--border-primary)] bg-[var(--bg-secondary)] px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/w/$workspaceId/modules"
            params={{ workspaceId }}
            className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]"
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
                className="rounded-lg border border-indigo-400 bg-[var(--input-bg)] px-3 py-1 text-base font-semibold text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-indigo-400 w-72"
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRenameModuleValue(mod.title);
                setRenamingModule(true);
              }}
              className="group flex items-center gap-2 truncate max-w-sm text-base font-semibold text-[var(--text-primary)] hover:text-indigo-400"
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
              <Users className="size-4 text-[var(--text-muted)]" />
              <div className="flex -space-x-1.5">
                {(presence ?? []).slice(0, 4).map((p) => (
                  <div
                    key={p._id}
                    title={p.displayName}
                    className="flex size-7 items-center justify-center rounded-full border-2 border-[var(--bg-secondary)] bg-indigo-500 text-[10px] font-bold text-white"
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
                ? 'bg-violet-50 text-violet-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {mod.status}
          </span>
          <Link
            to="/w/$workspaceId/m/$moduleId/preview"
            params={{ workspaceId, moduleId }}
            className="flex items-center gap-2 rounded-lg border border-[var(--border-primary)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]"
          >
            <Eye className="size-4" />
            Preview
          </Link>
          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setTheme((t) => t === 'light' ? 'dark' : 'light')}
            className="rounded-lg p-2 text-[var(--text-tertiary)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)] transition-colors"
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => setExportDialogOpen(true)}
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
        <aside className={`flex shrink-0 flex-col border-r border-[var(--border-primary)] bg-[var(--bg-secondary)] transition-all duration-200 ${lessonsOpen ? 'w-64' : 'w-12'}`}>
          <div className={`flex items-center border-b border-[var(--border-subtle)] py-3 ${lessonsOpen ? 'justify-between px-4' : 'justify-center px-2'}`}>
            {lessonsOpen && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Lessons</span>
                <span className="text-xs text-[var(--text-muted)]">{lessons.length}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setLessonsOpen((o) => !o)}
              className="shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]"
              title={lessonsOpen ? 'Collapse lessons' : 'Expand lessons'}
            >
              {lessonsOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          </div>

          {/* Collapsed rail — lesson initials */}
          {!lessonsOpen && (
            <div className="flex-1 overflow-y-auto py-2">
              {lessons.map((lesson) => (
                <button
                  key={lesson._id}
                  type="button"
                  onClick={() => { setActiveLessonId(lesson._id); setLessonsOpen(true); }}
                  title={lesson.title}
                  className={`flex w-full items-center justify-center py-2.5 text-[10px] font-bold transition-colors ${
                    activeLessonId === lesson._id
                      ? 'bg-indigo-500/10 text-indigo-400'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {lesson.title.slice(0, 2).toUpperCase()}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setLessonsOpen(true)}
                title="Add lesson"
                className="flex w-full items-center justify-center py-2.5 text-[var(--text-muted)] hover:text-indigo-400 transition-colors"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          )}

          {lessonsOpen && (
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
                  <li className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    No lessons yet
                  </li>
                )}
              </ul>
              {/* Add lesson button at bottom */}
              <div className="shrink-0 border-t border-[var(--border-subtle)] p-3">
                <button
                  type="button"
                  onClick={() => void handleAddLesson()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border-primary)] py-2.5 text-sm font-medium text-[var(--text-muted)] hover:border-indigo-500 hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors"
                >
                  <Plus className="size-4" /> Add lesson
                </button>
              </div>
            </SortableContext>
          </DndContext>
          )}
        </aside>

        {/* Block canvas */}
        <main className="flex-1 overflow-y-auto">
          {!activeLesson ? (
            <div className="flex h-full items-center justify-center bg-[var(--bg-primary)]">
              <div className="text-center text-[var(--text-muted)]">
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
              <div className="flex items-center gap-3 pb-2 border-b border-[var(--border-primary)]">
                <h2
                  className="text-xl font-bold text-[var(--text-primary)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors"
                  onClick={() => { setRenamingLessonId(activeLesson._id); setRenameLessonValue(activeLesson.title); }}
                  title="Click to rename"
                >
                  {activeLesson.title}
                </h2>
                <button
                  type="button"
                  onClick={() => { setRenamingLessonId(activeLesson._id); setRenameLessonValue(activeLesson.title); }}
                  className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-secondary)]"
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
                  <div className="flex flex-col gap-0">
                    {blocksForLesson.length > 0 && (
                      <InsertBetweenBtn
                        onClick={() => setInsertAfterOrder(null)}
                        active={insertAfterOrder === null}
                      />
                    )}
                    {blocksForLesson.map((block, idx) => {
                      const currentGroup = BLOCK_TYPES.find((bt) => bt.type === block.type)?.group ?? '';
                      const prevBlock = idx > 0 ? blocksForLesson[idx - 1] : null;
                      const prevGroup = prevBlock
                        ? (BLOCK_TYPES.find((bt) => bt.type === prevBlock.type)?.group ?? '')
                        : null;
                      const showGroupLabel = prevGroup === null || currentGroup !== prevGroup;
                      return (
                        <React.Fragment key={block._id}>
                          {showGroupLabel && (
                            <div className="flex items-center gap-2 px-1 pb-1 pt-3">
                              <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
                                {currentGroup}
                              </span>
                              <div className="h-px flex-1 bg-[var(--border-subtle)]" />
                            </div>
                          )}
                          <SortableBlock
                            block={block}
                            lessons={lessons}
                            onSave={(html) => handleSaveBlock(block._id, html)}
                            onDelete={async () => {
                              await removeBlock({ blockId: block._id });
                            }}
                            onDuplicate={async () => {
                              await duplicateBlock({ blockId: block._id });
                            }}
                            onMoveToLesson={async (targetLessonId) => {
                              await moveBlockToLesson({ blockId: block._id, targetLessonId });
                              setActiveLessonId(targetLessonId);
                            }}
                          />
                          {idx < blocksForLesson.length - 1 && (
                            <InsertBetweenBtn
                              onClick={() => setInsertAfterOrder(block.order)}
                              active={insertAfterOrder === block.order}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Append target */}
              <button
                type="button"
                onClick={() => setInsertAfterOrder(undefined)}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 py-4 text-sm font-medium transition-colors ${
                  insertAfterOrder === undefined
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                    : 'border-dashed border-[var(--border-primary)] text-[var(--text-muted)] hover:border-indigo-500 hover:bg-indigo-500/10 hover:text-indigo-400'
                }`}
              >
                <Plus className="size-4" />
                {insertAfterOrder === undefined ? 'Appending at end' : 'Click to append at end'}
              </button>
            </div>
          )}
        </main>

        {/* ── Block library — always-visible right panel ── */}
        <aside className="flex w-64 shrink-0 flex-col border-l border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Blocks</span>
            {insertAfterOrder !== undefined && (
              <button
                type="button"
                onClick={() => setInsertAfterOrder(undefined)}
                title="Reset to append mode"
                className="rounded-md p-1 text-indigo-400 transition-colors hover:bg-indigo-500/10"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {/* Insertion point banner */}
          <div className="shrink-0 px-3 pt-2.5">
            {insertAfterOrder === null ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1.5 text-[11px] font-medium text-indigo-400">
                <Plus className="size-3 shrink-0" /> Inserting before first block
              </div>
            ) : insertAfterOrder !== undefined ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1.5 text-[11px] font-medium text-indigo-400">
                <Plus className="size-3 shrink-0" /> Inserting after selected block
              </div>
            ) : activeLessonId ? (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2.5 py-1.5 text-[11px] text-[var(--text-muted)]">
                Appending to end of lesson
              </div>
            ) : (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2.5 py-1.5 text-[11px] text-[var(--text-muted)]">
                Select a lesson first
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {(['Content', 'Media', 'Interactive', 'Layout', 'Scenario', 'Advanced'] as const).map((group) => (
              <BlockLibraryGroup
                key={group}
                group={group}
                blocks={BLOCK_TYPES.filter((bt) => bt.group === group)}
                onAdd={(type) => void handleAddBlock(type)}
                disabled={!activeLessonId}
              />
            ))}
          </div>
        </aside>
      </div>

    {/* ── SCORM Export Dialog ── */}
    {exportDialogOpen && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export SCORM options"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setExportDialogOpen(false)} />
        <div className="relative w-full max-w-md rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Export SCORM 1.2</h2>
            <button type="button" onClick={() => setExportDialogOpen(false)} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--card-bg-hover)]"><X className="size-4" /></button>
          </div>

          {/* Completion criterion */}
          <div className="mb-5">
            <p className="mb-2 text-sm font-semibold text-[var(--text-secondary)]">Mark complete when…</p>
            <div className="flex flex-col gap-2">
              {([['completed', 'Learner reaches the final lesson'], ['passed', 'Learner achieves the pass score']] as const).map(([val, label]) => (
                <label key={val} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border-primary)] px-4 py-3 transition-colors hover:border-indigo-500 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-500/10">
                  <input
                    type="radio"
                    name="completionCriteria"
                    value={val}
                    checked={exportOptions.completionCriteria === val}
                    onChange={() => setExportOptions((o) => ({ ...o, completionCriteria: val }))}
                    className="accent-indigo-500"
                  />
                  <span className="text-sm text-[var(--text-primary)]">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Pass score */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">
              Pass score: <span className="text-indigo-400">{exportOptions.passingScore}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={exportOptions.passingScore}
              onChange={(e) => setExportOptions((o) => ({ ...o, passingScore: Number(e.target.value) }))}
              className="w-full accent-indigo-500"
            />
            <div className="mt-1 flex justify-between text-[11px] text-[var(--text-muted)]"><span>0%</span><span>50%</span><span>100%</span></div>
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setExportDialogOpen(false)} className="rounded-lg border border-[var(--border-primary)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--card-bg-hover)]">Cancel</button>
            <button type="button" onClick={() => void handleExportScorm(exportOptions)} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              <Download className="size-4" /> Export
            </button>
          </div>
        </div>
      </div>
    )}
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
          ? 'bg-indigo-500/10 border-r-2 border-indigo-500 text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--card-bg-hover)] border-r-2 border-transparent'
      }`}
    >
      {/* Drag handle — always visible */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab shrink-0 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] touch-none"
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
            className="w-full rounded-lg border border-indigo-500 bg-[var(--input-bg)] px-2 py-1 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={onStartRename}
          className="flex-1 truncate text-left text-sm font-medium text-[var(--text-primary)]"
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
            className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]"
            title="Rename"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void onDelete()}
            className="rounded-md p-1 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400"
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
  lessons,
  onSave,
  onDelete,
  onDuplicate,
  onMoveToLesson,
}: {
  block: Block;
  lessons: Lesson[];
  onSave: (html: string) => void;
  onDelete: () => Promise<void>;
  onDuplicate: () => Promise<void>;
  onMoveToLesson: (targetLessonId: Id<'lessons'>) => Promise<void>;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
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
        className="mt-4 cursor-grab self-start p-2.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] touch-none rounded-xl bg-[var(--bg-tertiary)] hover:bg-[var(--card-bg-hover)] transition-colors"
        title="Drag to reorder"
      >
        <GripVertical className="size-5" />
      </button>

      {/* Block content */}
      <div className="flex-1 prism-editor-block">
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
            moduleId={block.moduleId}
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
        {block.type === 'hotspots' && (
          <HotspotsBlockEditor blockId={block._id} initialContent={block.content} onSave={onSave} />
        )}
        {block.type === 'gallery' && (
          <GalleryBlockEditor blockId={block._id} initialContent={block.content} onSave={onSave} />
        )}
        {block.type === 'compare' && (
          <CompareBlockEditor blockId={block._id} initialContent={block.content} onSave={onSave} />
        )}
        {block.type === 'audio' && (
          <AudioBlockEditor blockId={block._id} initialContent={block.content} onSave={onSave} />
        )}
        {block.type === 'labeledGraphic' && (
          <LabeledGraphicBlockEditor blockId={block._id} initialContent={block.content} onSave={onSave} />
        )}
        {block.type === 'fillBlanks' && (
          <FillBlanksBlockEditor blockId={block._id} initialContent={block.content} onSave={onSave} />
        )}
        {block.type === 'matching' && (
          <MatchingBlockEditor blockId={block._id} initialContent={block.content} onSave={onSave} />
        )}
        {block.type === 'sorting' && (
          <SortingBlockEditor blockId={block._id} initialContent={block.content} onSave={onSave} />
        )}
        {block.type === 'scenario' && (
          <ScenarioBlockEditor blockId={block._id} initialContent={block.content} onSave={onSave} />
        )}
      </div>

      {/* Block actions — big, bold, always visible */}
      <div className="mt-4 flex shrink-0 flex-col self-start gap-1.5">
        <button
          type="button"
          onClick={() => void onDuplicate()}
          className="rounded-xl bg-[var(--bg-tertiary)] p-2.5 text-[var(--text-tertiary)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)] transition-colors"
          title="Duplicate block"
        >
          <Copy className="size-5" />
        </button>
        {/* Move to lesson */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMoveMenu((o) => !o)}
            className={`rounded-xl p-2.5 transition-colors ${
              showMoveMenu
                ? 'bg-indigo-500/15 text-indigo-400'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)]'
            }`}
            title="Move to another lesson"
          >
            <Layers className="size-5" />
          </button>
          {showMoveMenu && (
            <div className="absolute right-full top-0 mr-2 z-20 w-52 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-xl">
              <p className="border-b border-[var(--border-subtle)] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                Move to lesson
              </p>
              {lessons.filter((l) => l._id !== block.lessonId).length === 0 ? (
                <p className="px-3 py-2 text-xs text-[var(--text-muted)]">No other lessons</p>
              ) : (
                lessons
                  .filter((l) => l._id !== block.lessonId)
                  .map((l) => (
                    <button
                      key={l._id}
                      type="button"
                      onClick={async () => {
                        setShowMoveMenu(false);
                        await onMoveToLesson(l._id);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--card-bg-hover)] hover:text-[var(--text-primary)] last:rounded-b-xl"
                    >
                      {l.title}
                    </button>
                  ))
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => void onDelete()}
          className="rounded-xl bg-[var(--bg-tertiary)] p-2.5 text-[var(--text-tertiary)] hover:bg-red-500/15 hover:text-red-400 transition-colors"
          title="Delete block"
        >
          <Trash2 className="size-5" />
        </button>
      </div>
    </div>
  );
}

// ── InsertBetweenBtn ───────────────────────────────────────────────────────

function InsertBetweenBtn({ onClick, active }: { onClick: () => void; active?: boolean }) {
  return (
    <div className="group relative flex items-center py-1">
      <div className={`h-px flex-1 transition-colors ${active ? 'bg-indigo-500/60' : 'bg-[var(--border-subtle)] group-hover:bg-indigo-500/40'}`} />
      <button
        type="button"
        onClick={onClick}
        title={active ? 'Inserting here — pick a block type →' : 'Insert block here'}
        className={`mx-2 flex items-center justify-center rounded-full border p-0.5 transition-all ${
          active
            ? 'scale-110 border-indigo-500 bg-indigo-500/20 text-indigo-400 opacity-100'
            : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:scale-110 hover:border-indigo-500 hover:bg-indigo-500/10 hover:text-indigo-400'
        }`}
      >
        <Plus className="size-3.5" />
      </button>
      <div className={`h-px flex-1 transition-colors ${active ? 'bg-indigo-500/60' : 'bg-[var(--border-subtle)] group-hover:bg-indigo-500/40'}`} />
    </div>
  );
}

// ── BlockLibraryGroup ──────────────────────────────────────────────────────

function BlockLibraryGroup({
  group,
  blocks,
  onAdd,
  disabled,
}: {
  group: string;
  blocks: { type: BlockType; label: string; icon: React.ReactNode }[];
  onAdd: (type: BlockType) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-3 last:mb-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-1.5 flex w-full items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
      >
        <ChevronRight className={`size-3 shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        {group}
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-1.5">
          {blocks.map(({ type, label, icon }) => (
            <BlockTypeBtn
              key={type}
              type={type}
              label={label}
              icon={icon}
              onAdd={onAdd}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── BlockTypeBtn ───────────────────────────────────────────────────────────

function BlockTypeBtn({
  type,
  label,
  icon,
  onAdd,
  disabled,
}: {
  type: BlockType;
  label: string;
  icon: React.ReactNode;
  onAdd: (type: BlockType) => void;
  disabled: boolean;
}) {
  const [tipRect, setTipRect] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const description = BLOCK_DESCRIPTIONS[type];

  function handleMouseEnter() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setTipRect({ x: r.left + r.width / 2, y: r.top });
  }

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => onAdd(type)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setTipRect(null)}
        className="flex w-full flex-col items-center gap-1 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-1.5 py-2.5 text-center transition-colors hover:border-indigo-500 hover:bg-indigo-500/10 disabled:pointer-events-none disabled:opacity-40"
      >
        <span className="[&>svg]:size-4 text-[var(--text-tertiary)]">{icon}</span>
        <span className="text-[10px] font-medium leading-tight text-[var(--text-secondary)]">{label}</span>
      </button>
      {tipRect && description && createPortal(
        <div
          className="pointer-events-none fixed z-[9999] w-48 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-xl"
          style={{ left: tipRect.x, top: tipRect.y - 8, transform: 'translate(-50%, -100%)' }}
        >
          <p className="mb-0.5 text-[11px] font-semibold text-slate-800">{label}</p>
          <p className="text-[10px] leading-snug text-slate-500">{description}</p>
        </div>,
        document.body,
      )}
    </div>
  );
}

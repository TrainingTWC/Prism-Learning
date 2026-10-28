import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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
import { AlertCircle, Check, ChevronRight, GripVertical, Loader2, Play, Plus } from 'lucide-react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { formatTabTitle } from '../lib/editorNav';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { countIssues, runPreflight } from '../lib/preflight';
import type { PreflightIssue } from '../lib/preflight';
import { ModuleTopBar, TopBarTab } from '../components/studio/ModuleTopBar';
import { PresenceAvatars } from '../components/studio/PresenceAvatars';
import type { PresenceRow } from '../components/studio/PresenceAvatars';
import { CoverPicker } from '../components/studio/CoverPicker';

const TYPE_LABELS: Record<string, string> = {
  richText: 'Text',
  image: 'Image',
  video: 'Video',
  lottie: 'Animation',
  mcq: 'Quiz',
  trueFalse: 'True/false',
  accordion: 'Accordion',
  quote: 'Quote',
  callout: 'Callout',
  divider: 'Divider',
  flashcard: 'Flashcards',
  process: 'Process',
  tabs: 'Tabs',
  button: 'Button',
  customHtml: 'HTML',
  hotspots: 'Hotspots',
  gallery: 'Gallery',
  compare: 'Compare',
  audio: 'Audio',
  labeledGraphic: 'Labeled graphic',
  matching: 'Matching',
  sorting: 'Sorting',
  fillBlanks: 'Fill blanks',
  revealCards: 'Reveal cards',
  scenario: 'Scenario',
};

const MAX_CHIPS = 4;

interface LessonRowProps {
  lessonId: string;
  workspaceId: string;
  moduleId: string;
  index: number;
  title: string;
  chips: string[];
  here: PresenceRow[];
  issueCount: number;
}

function LessonRow({ lessonId, workspaceId, moduleId, index, title, chips, here, issueCount }: LessonRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lessonId });
  const shown = chips.slice(0, MAX_CHIPS);
  const extra = chips.length - shown.length;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-wrap items-center gap-3.5 rounded-[14px] border bg-white px-4 py-3.5 ${
        isDragging
          ? 'z-10 border-brand-line shadow-[0_12px_32px_rgba(23,23,28,0.14)]'
          : 'border-line hover:border-[#D4D4DC] hover:shadow-[0_2px_8px_rgba(23,23,28,0.05)]'
      }`}
    >
      <button
        type="button"
        aria-label={`Reorder ${title}`}
        className="flex cursor-grab touch-none text-[#A0A0AB] hover:text-ink-2 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <Link
        to="/w/$workspaceId/m/$moduleId"
        params={{ workspaceId, moduleId }}
        search={{ lesson: lessonId }}
        className="flex min-w-0 flex-1 basis-56 items-center gap-3.5 text-ink hover:text-ink"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#7B35C1] text-[15px] font-bold text-white">
          {index + 1}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="truncate text-[15px] font-semibold">{title || 'Untitled lesson'}</span>
          <span className="flex flex-wrap gap-1.5">
            {shown.length === 0 && <span className="text-[11px] text-ink-3">No blocks yet</span>}
            {shown.map((c) => (
              <span key={c} className="rounded-md bg-[#F3F3F6] px-2 py-0.5 text-[11px] text-ink-2">
                {c}
              </span>
            ))}
            {extra > 0 && (
              <span className="rounded-md bg-[#F3F3F6] px-2 py-0.5 text-[11px] text-ink-2">+{extra}</span>
            )}
          </span>
        </span>
      </Link>
      {here.length > 0 && <PresenceAvatars rows={here} size={24} max={3} />}
      {issueCount > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-[#FDF1E4] px-2 py-1 text-xs text-[#9A4A0B]">
          <AlertCircle className="size-3" />
          {issueCount} to fix
        </span>
      )}
    </div>
  );
}

export function ModuleOutlinePage() {
  const { workspaceId, moduleId } = useParams({ from: '/protected/w/$workspaceId/m/$moduleId/outline' });
  const modId = moduleId as Id<'modules'>;
  const navigate = useNavigate();

  const content = useQuery(api.modules.getWithContent, { moduleId: modId });
  const blocksRaw = useQuery(api.blocks.listByModule, { moduleId: modId });
  const presence = useQuery(api.presence.list, { moduleId: modId });

  const addLesson = useMutation(api.lessons.add);
  const reorderLessons = useMutation(api.lessons.reorder);
  const setDescription = useMutation(api.modules.setDescription);

  const [adding, setAdding] = useState(false);

  const lessons = useMemo(() => content?.lessons ?? [], [content]);
  const blocks = useMemo(() => blocksRaw ?? [], [blocksRaw]);

  useDocumentTitle(content ? formatTabTitle(['Outline', content.module.title]) : null);

  // ── Description: hydrate once, debounce-save, flush on blur/unmount ──
  const [desc, setDesc] = useState('');
  const hydrated = useRef(false);
  const latestDesc = useRef('');
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hydrated.current || !content) return;
    hydrated.current = true;
    const initial = content.module.description ?? '';
    latestDesc.current = initial;
    setDesc(initial);
  }, [content]);

  const flushDescription = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current) return;
    dirty.current = false;
    void setDescription({ moduleId: modId, description: latestDesc.current });
  }, [setDescription, modId]);

  useEffect(() => flushDescription, [flushDescription]);

  function handleDescChange(value: string) {
    setDesc(value);
    latestDesc.current = value;
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flushDescription, 600);
  }

  // ── Derived data ──
  const checks = useMemo(() => runPreflight(lessons, blocks), [lessons, blocks]);
  const issueTotal = countIssues(checks);
  const issuesByLesson = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of checks) {
      for (const i of c.issues) {
        if (i.lessonId) map.set(i.lessonId, (map.get(i.lessonId) ?? 0) + 1);
      }
    }
    return map;
  }, [checks]);
  const allIssues = useMemo(() => checks.flatMap((c) => c.issues), [checks]);

  const blocksByLesson = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const b of blocks) {
      const label = TYPE_LABELS[b.type] ?? b.type;
      const list = map.get(b.lessonId);
      if (!list) map.set(b.lessonId, [label]);
      else if (!list.includes(label)) list.push(label);
    }
    return map;
  }, [blocks]);

  const quizCount = useMemo(
    () => blocks.filter((b) => b.type === 'mcq' || b.type === 'trueFalse').length,
    [blocks],
  );

  const presenceByLesson = useMemo(() => {
    const map = new Map<string, PresenceRow[]>();
    for (const p of presence ?? []) {
      if (!p.activeLessonId) continue;
      const list = map.get(p.activeLessonId);
      if (list) list.push(p);
      else map.set(p.activeLessonId, [p]);
    }
    return map;
  }, [presence]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
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

  async function handleAddLesson() {
    setAdding(true);
    try {
      const id = await addLesson({ moduleId: modId });
      void navigate({
        to: '/w/$workspaceId/m/$moduleId',
        params: { workspaceId, moduleId },
        search: { lesson: id },
      });
    } finally {
      setAdding(false);
    }
  }

  if (content === undefined || blocksRaw === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ground">
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );
  }
  if (content === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ground text-ink-2">
        Module not found
      </div>
    );
  }

  const mod = content.module;
  const cs = mod.completionSettings;
  const passes = (cs?.completionCriteria ?? 'completed') === 'passed';

  return (
    <div className="flex h-screen flex-col bg-ground text-ink">
      <ModuleTopBar
        workspaceId={workspaceId}
        breadcrumb={
          <>
            <Link to="/w/$workspaceId/modules" params={{ workspaceId }} className="text-ink-3 hover:text-ink">
              Modules
            </Link>
            <ChevronRight className="size-3.5 text-[#A0A0AB]" />
            <span className="truncate font-semibold">{mod.title}</span>
          </>
        }
        tabs={
          <>
            <TopBarTab active>Outline</TopBarTab>
            <Link to="/w/$workspaceId/theme" params={{ workspaceId }}>
              <TopBarTab>Theme</TopBarTab>
            </Link>
            <Link to="/w/$workspaceId/m/$moduleId/publish" params={{ workspaceId, moduleId }}>
              <TopBarTab>Completion &amp; scoring</TopBarTab>
            </Link>
          </>
        }
        right={
          <>
            <PresenceAvatars rows={presence ?? []} />
            <Link
              to="/w/$workspaceId/m/$moduleId/preview"
              params={{ workspaceId, moduleId }}
              search={{}}
              className="flex h-9 items-center gap-2 rounded-[10px] border border-line bg-white px-3.5 text-sm font-medium text-ink hover:bg-hover"
            >
              <Play className="size-4" />
              Preview
            </Link>
            <Link
              to="/w/$workspaceId/m/$moduleId/publish"
              params={{ workspaceId, moduleId }}
              className="flex h-9 items-center rounded-[10px] bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-ink hover:text-white"
            >
              Publish
            </Link>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap gap-8 px-10 pb-16 pt-8">
          <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
            {/* Cover + description */}
            <section className="flex flex-wrap overflow-hidden rounded-[20px] border border-line bg-white">
              <CoverPicker moduleId={modId} title={mod.title} coverUrl={content.coverUrl} />
              <div className="flex flex-1 basis-80 flex-col gap-3.5 p-7">
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-2">
                  Description learners see first
                  <textarea
                    rows={4}
                    value={desc}
                    maxLength={1000}
                    onChange={(e) => handleDescChange(e.target.value)}
                    onBlur={flushDescription}
                    placeholder="What will learners get out of this module?"
                    className="resize-none rounded-xl border border-line px-3 py-2.5 text-sm font-normal leading-relaxed text-ink outline-none focus:border-brand"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Chip>
                    {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
                  </Chip>
                  <Chip>
                    {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}
                  </Chip>
                  <Chip>
                    {quizCount} quiz {quizCount === 1 ? 'question' : 'questions'}
                  </Chip>
                </div>
              </div>
            </section>

            {/* Lessons */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5 px-1 py-2">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-2">Lessons</h2>
                <span className="h-px flex-1 bg-line" />
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
                <SortableContext items={lessons.map((l) => l._id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2">
                    {lessons.map((lesson, i) => (
                      <LessonRow
                        key={lesson._id}
                        lessonId={lesson._id}
                        workspaceId={workspaceId}
                        moduleId={moduleId}
                        index={i}
                        title={lesson.title}
                        chips={blocksByLesson.get(lesson._id) ?? []}
                        here={presenceByLesson.get(lesson._id) ?? []}
                        issueCount={issuesByLesson.get(lesson._id) ?? 0}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <button
                type="button"
                disabled={adding}
                onClick={() => void handleAddLesson()}
                className="mt-1 flex h-12 items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-[#D4D4DC] bg-transparent text-sm text-ink-2 transition hover:bg-hover disabled:opacity-60"
              >
                {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Add lesson
              </button>
            </section>
          </main>

          <aside className="flex max-w-[360px] flex-[1_1_300px] flex-col gap-4">
            {/* Readiness */}
            <section className="rounded-[18px] border border-line bg-white p-5">
              <div className="mb-4 flex items-center gap-3">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                    issueTotal === 0 ? 'bg-[#EAF6EF] text-[#1A7F4B]' : 'bg-[#FDF1E4] text-[#9A4A0B]'
                  }`}
                >
                  {issueTotal === 0 ? <Check className="size-5" /> : <AlertCircle className="size-5" />}
                </span>
                <div>
                  <div className="text-[15px] font-semibold">
                    {issueTotal === 0 ? 'Ready to publish' : `${issueTotal} ${issueTotal === 1 ? 'thing' : 'things'} to fix first`}
                  </div>
                  <div className="text-[13px] text-ink-2">
                    {issueTotal === 0 ? 'All pre-flight checks pass' : 'Fix these before exporting'}
                  </div>
                </div>
              </div>
              {allIssues.length > 0 && (
                <div className="mb-3 flex flex-col gap-2">
                  {allIssues.map((issue, i) => (
                    <IssueRow key={`${issue.lessonId}-${issue.blockId ?? i}-${issue.message}`} issue={issue} workspaceId={workspaceId} moduleId={moduleId} />
                  ))}
                </div>
              )}
              <Link
                to="/w/$workspaceId/m/$moduleId/publish"
                params={{ workspaceId, moduleId }}
                className="text-[13px] font-medium"
              >
                Review &amp; publish
              </Link>
            </section>

            {/* Completion */}
            <section className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-white p-5 text-[13px]">
              <div className="text-[15px] font-semibold">Completion</div>
              <div className="flex justify-between gap-3">
                <span className="text-ink-2">Learner completes when</span>
                <span className="font-semibold">{passes ? 'Passes the quiz' : 'Reaches the end'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-ink-2">Pass mark</span>
                <span className="font-semibold">{cs?.passingScore ?? 80}%</span>
              </div>
              <Link
                to="/w/$workspaceId/m/$moduleId/publish"
                params={{ workspaceId, moduleId }}
                className="font-medium"
              >
                Edit completion rules
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[#F3F3F6] px-2.5 py-1 text-xs text-ink-2">{children}</span>;
}

function IssueRow({
  issue,
  workspaceId,
  moduleId,
}: {
  issue: PreflightIssue;
  workspaceId: string;
  moduleId: string;
}) {
  const body = (
    <>
      <AlertCircle className="mt-px size-4 shrink-0 text-[#9A4A0B]" />
      <span>{issue.message}</span>
      {issue.lessonId && <span className="ml-auto shrink-0 font-semibold text-link">Fix</span>}
    </>
  );
  const cls = 'flex gap-2.5 rounded-xl bg-[#FDF1E4] px-3 py-2.5 text-[13px] leading-snug text-[#5C2D06]';
  if (!issue.lessonId) return <div className={cls}>{body}</div>;
  return (
    <Link
      to="/w/$workspaceId/m/$moduleId"
      params={{ workspaceId, moduleId }}
      search={{ lesson: issue.lessonId }}
      className={`${cls} hover:text-[#5C2D06]`}
    >
      {body}
    </Link>
  );
}

import { Link } from '@tanstack/react-router';
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
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Id } from '~convex/_generated/dataModel';
import { PresenceAvatars, type PresenceRow } from '../studio/PresenceAvatars';
import type { EditorLesson } from './types';

interface OutlineRailProps {
  workspaceId: string;
  moduleId: string;
  lessons: EditorLesson[];
  activeLessonId: Id<'lessons'> | null;
  presence: readonly PresenceRow[];
  renamingLessonId: string | null;
  renameValue: string;
  onSelect: (id: Id<'lessons'>) => void;
  onStartRename: (lesson: EditorLesson) => void;
  onRename: (lessonId: Id<'lessons'>, title: string) => Promise<void>;
  onRenameChange: (v: string) => void;
  onCancelRename: () => void;
  onDelete: (lessonId: Id<'lessons'>) => Promise<void>;
  onReorder: (lessonIds: Id<'lessons'>[]) => Promise<void>;
  onAdd: () => Promise<void>;
}

export function OutlineRail({
  workspaceId,
  moduleId,
  lessons,
  activeLessonId,
  presence,
  renamingLessonId,
  renameValue,
  onSelect,
  onStartRename,
  onRename,
  onRenameChange,
  onCancelRename,
  onDelete,
  onReorder,
  onAdd,
}: OutlineRailProps) {
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
    await onReorder(reordered.map((l) => l._id));
  }

  return (
    <aside
      aria-label="Lesson outline"
      className="flex w-[264px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-white px-3 py-4"
    >
      <div className="flex items-center justify-between px-2 pb-2">
        <span className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-3">Outline</span>
        <Link
          to="/w/$workspaceId/m/$moduleId/outline"
          params={{ workspaceId, moduleId }}
          className="text-xs font-medium text-link hover:text-brand-ink"
        >
          Full view
        </Link>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e) => void handleDragEnd(e)}
      >
        <SortableContext items={lessons.map((l) => l._id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-0.5">
            {lessons.map((lesson, i) => (
              <SortableLesson
                key={lesson._id}
                lesson={lesson}
                index={i}
                isActive={activeLessonId === lesson._id}
                // For the ACTIVE lesson the canvas header renders its own inline
                // rename input (also autoFocus). Mounting both inputs at once makes
                // the second focus() blur the first, whose onBlur commits + closes
                // rename mode instantly. Suppress the rail input for the active
                // lesson so exactly one rename input ever mounts.
                isRenaming={renamingLessonId === lesson._id && lesson._id !== activeLessonId}
                renameValue={renameValue}
                here={presence.filter((p) => p.activeLessonId === lesson._id)}
                onSelect={() => onSelect(lesson._id)}
                onStartRename={() => onStartRename(lesson)}
                onRename={(title) => onRename(lesson._id, title)}
                onRenameChange={onRenameChange}
                onCancelRename={onCancelRename}
                onDelete={() => onDelete(lesson._id)}
              />
            ))}
            {lessons.length === 0 && (
              <li className="px-2 py-6 text-center text-sm text-ink-3">No lessons yet</li>
            )}
          </ul>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={() => void onAdd()}
        className="mt-2 flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[#D4D4DC] text-[13px] text-ink-2 hover:bg-hover"
      >
        <Plus className="size-4" /> Add lesson
      </button>
    </aside>
  );
}

function SortableLesson({
  lesson,
  index,
  isActive,
  isRenaming,
  renameValue,
  here,
  onSelect,
  onStartRename,
  onRename,
  onRenameChange,
  onCancelRename,
  onDelete,
}: {
  lesson: EditorLesson;
  index: number;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  here: readonly PresenceRow[];
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
      className={`group flex items-center gap-1.5 rounded-[10px] px-1.5 py-1.5 ${
        isActive ? 'bg-brand-soft text-brand-ink' : 'text-ink hover:bg-hover'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder lesson"
        className="shrink-0 cursor-grab touch-none p-0.5 text-ink-3 opacity-0 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
      >
        <GripVertical className="size-4" />
      </button>
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
          isActive ? 'bg-brand text-white' : 'bg-[#EDEDF1] text-ink-2'
        }`}
      >
        {index + 1}
      </span>

      {isRenaming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onRename(renameValue);
          }}
          className="min-w-0 flex-1"
        >
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={() => void onRename(renameValue)}
            onKeyDown={(e) => e.key === 'Escape' && onCancelRename()}
            className="w-full rounded-md border border-brand bg-white px-2 py-1 text-sm text-ink outline-none focus:ring-2 focus:ring-brand-line"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={onStartRename}
          className="min-w-0 flex-1 truncate text-left text-[13px] font-medium"
        >
          {lesson.title}
        </button>
      )}

      {!isRenaming && here.length > 0 && <PresenceAvatars rows={here} max={2} size={20} />}

      {!isRenaming && (
        <div className="flex shrink-0 items-center opacity-0 focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            onClick={onStartRename}
            className="rounded-md p-1 text-ink-3 hover:bg-white hover:text-ink"
            title="Rename"
            aria-label="Rename lesson"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void onDelete()}
            className="rounded-md p-1 text-ink-3 hover:bg-white hover:text-red-600"
            title="Delete"
            aria-label="Delete lesson"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
    </li>
  );
}

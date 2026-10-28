import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Copy, GripVertical, Layers, Trash2 } from 'lucide-react';
import { BlockRenderer, blockStyleToCss, hasBlockStyle, type Theme } from '@prism/renderer';
import type { Id } from '~convex/_generated/dataModel';
import { isBlockEmpty, toRendererBlock } from '../../lib/rendererBlocks';
import { BlockEditor } from './BlockEditor';
import { catalogEntry } from './blockCatalog';
import type { EditorBlock, EditorLesson } from './types';

interface CanvasBlockProps {
  block: EditorBlock;
  lessons: EditorLesson[];
  theme: Theme;
  resolveAsset: (id: string) => string;
  selected: boolean;
  /** Bumped by the inspector to force the uncontrolled editor to re-read its content. */
  editorEpoch: number;
  onSelect: () => void;
  onSave: (content: string) => void;
  onDuplicate: () => Promise<void>;
  onDelete: () => Promise<void>;
  onMoveToLesson: (targetLessonId: Id<'lessons'>) => Promise<void>;
  onSlashCommand: () => void;
}

export function CanvasBlock({
  block,
  lessons,
  theme,
  resolveAsset,
  selected,
  editorEpoch,
  onSelect,
  onSave,
  onDuplicate,
  onDelete,
  onMoveToLesson,
  onSlashCommand,
}: CanvasBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block._id,
  });
  const [moveOpen, setMoveOpen] = useState(false);
  const moveRef = useRef<HTMLDivElement>(null);
  const entry = catalogEntry(block.type);
  const label = entry?.label ?? block.type;

  useEffect(() => {
    if (!selected) setMoveOpen(false);
  }, [selected]);

  useEffect(() => {
    if (!moveOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moveRef.current && !moveRef.current.contains(e.target as Node)) setMoveOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [moveOpen]);

  const wrapperStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const rendererBlock = toRendererBlock(block);
  const empty = isBlockEmpty(block.type, block.content) || rendererBlock === null;
  const otherLessons = lessons.filter((l) => l._id !== block.lessonId);

  if (!selected) {
    return (
      <div
        ref={setNodeRef}
        style={wrapperStyle}
        data-canvas-block={block._id}
        role="button"
        tabIndex={0}
        aria-label={`Edit ${label} block`}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onSelect();
          }
        }}
        className="relative cursor-pointer rounded-[12px] outline outline-2 outline-transparent transition-[outline-color] hover:outline-line focus-visible:outline-brand-line"
      >
        {empty ? (
          <div className="rounded-[12px] border border-dashed border-line px-4 py-6 text-center font-sans text-sm text-ink-3">
            Empty {label} — click to edit
          </div>
        ) : (
          <div
            className="pointer-events-none select-none"
            style={blockStyleToCss(block.style)}
            data-prism-style={hasBlockStyle(block.style) ? '' : undefined}
          >
            <BlockRenderer block={rendererBlock} theme={theme} resolveAsset={resolveAsset} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={wrapperStyle}
      data-canvas-block={block._id}
      className="relative my-3 rounded-[12px] bg-white outline outline-2 outline-brand"
    >
      <span className="absolute -top-3 left-4 z-20 rounded-md bg-brand px-2 py-[3px] font-sans text-[11px] font-semibold text-white">
        {label}
      </span>
      <div className="absolute -top-[18px] right-4 z-20 flex gap-0.5 rounded-[10px] border border-line bg-white p-[3px] font-sans shadow-[0_4px_12px_rgba(23,23,28,0.08)]">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          title="Drag to reorder"
          className="flex size-[30px] cursor-grab touch-none items-center justify-center rounded-[7px] text-ink-2 hover:bg-hover"
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => void onDuplicate()}
          aria-label="Duplicate block"
          title="Duplicate block"
          className="flex size-[30px] items-center justify-center rounded-[7px] text-ink-2 hover:bg-hover"
        >
          <Copy className="size-4" />
        </button>
        <div className="relative" ref={moveRef}>
          <button
            type="button"
            onClick={() => setMoveOpen((o) => !o)}
            aria-label="Move to another lesson"
            title="Move to another lesson"
            aria-haspopup="menu"
            aria-expanded={moveOpen}
            className={`flex size-[30px] items-center justify-center rounded-[7px] ${
              moveOpen ? 'bg-brand-soft text-brand-ink' : 'text-ink-2 hover:bg-hover'
            }`}
          >
            <Layers className="size-4" />
          </button>
          {moveOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-1 w-56 rounded-[12px] border border-line bg-white py-1 shadow-xl"
            >
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                Move to lesson
              </p>
              {otherLessons.length === 0 ? (
                <p className="px-3 py-2 text-xs text-ink-3">No other lessons</p>
              ) : (
                otherLessons.map((l) => (
                  <button
                    key={l._id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMoveOpen(false);
                      void onMoveToLesson(l._id);
                    }}
                    className="block w-full truncate px-3 py-2 text-left text-sm text-ink-2 hover:bg-hover hover:text-ink"
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
          aria-label="Delete block"
          title="Delete block"
          className="flex size-[30px] items-center justify-center rounded-[7px] text-ink-2 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {/* Editors are designed for white backgrounds, so block style is not applied here. */}
      <div className="prism-editor-block p-2 font-sans text-slate-800">
        <BlockEditor
          key={`${block._id}:${editorEpoch}`}
          block={block}
          onSave={onSave}
          autoFocus
          onSlashCommand={onSlashCommand}
        />
      </div>
    </div>
  );
}

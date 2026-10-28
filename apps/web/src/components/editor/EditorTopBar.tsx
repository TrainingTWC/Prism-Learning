import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Check, ChevronDown, ChevronRight, Eye, Loader2, Pencil } from 'lucide-react';
import { ModuleTopBar } from '../studio/ModuleTopBar';
import { PresenceAvatars, type PresenceRow } from '../studio/PresenceAvatars';

interface EditorTopBarProps {
  workspaceId: string;
  moduleId: string;
  moduleTitle: string;
  lessonTitle: string | null;
  activeLessonId: string | null;
  saving: boolean;
  presence: readonly PresenceRow[];
  onRenameModule: (title: string) => Promise<void>;
}

export function EditorTopBar({
  workspaceId,
  moduleId,
  moduleTitle,
  lessonTitle,
  activeLessonId,
  saving,
  presence,
  onRenameModule,
}: EditorTopBarProps) {
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!previewOpen) return;
    const onDown = (e: MouseEvent) => {
      if (previewRef.current && !previewRef.current.contains(e.target as Node)) {
        setPreviewOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [previewOpen]);

  async function commitRename() {
    await onRenameModule(value);
    setRenaming(false);
  }

  const chevron = <ChevronRight className="size-3.5 shrink-0 text-[#A0A0AB]" aria-hidden="true" />;

  const breadcrumb = (
    <>
      <Link
        to="/w/$workspaceId/modules"
        params={{ workspaceId }}
        className="text-ink-3 hover:text-ink"
      >
        Modules
      </Link>
      {chevron}
      {renaming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void commitRename();
          }}
        >
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => void commitRename()}
            onKeyDown={(e) => e.key === 'Escape' && setRenaming(false)}
            className="w-64 rounded-lg border border-brand bg-white px-2.5 py-1 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-brand-line"
          />
        </form>
      ) : (
        <button
          type="button"
          title="Click to rename"
          onClick={() => {
            setValue(moduleTitle);
            setRenaming(true);
          }}
          className="group flex max-w-[260px] items-center gap-1.5 truncate text-ink-3 hover:text-ink"
        >
          <span className="truncate">{moduleTitle}</span>
          <Pencil className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
        </button>
      )}
      {lessonTitle && (
        <>
          {chevron}
          <span className="truncate font-semibold text-ink">{lessonTitle}</span>
        </>
      )}
    </>
  );

  const right = (
    <>
      <span
        role="status"
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
          saving ? 'bg-[#FFF4E0] text-[#9A5B00]' : 'bg-[#EAF6EF] text-[#1A7F4B]'
        }`}
      >
        {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
        {saving ? 'Saving…' : 'Saved'}
      </span>
      <PresenceAvatars rows={presence} size={30} />
      <div className="h-6 w-px bg-line" />
      <div className="relative" ref={previewRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={previewOpen}
          onClick={() => setPreviewOpen((o) => !o)}
          className="flex h-9 items-center gap-2 rounded-[10px] border border-line bg-white px-3.5 text-sm font-medium text-ink hover:bg-hover"
        >
          <Eye className="size-4" />
          Preview
          <ChevronDown className="size-3.5" />
        </button>
        {previewOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-64 rounded-[12px] border border-line bg-white p-1 shadow-xl"
          >
            <Link
              role="menuitem"
              to="/w/$workspaceId/m/$moduleId/preview"
              params={{ workspaceId, moduleId }}
              search={{ returnTo: activeLessonId ?? undefined }}
              onClick={() => setPreviewOpen(false)}
              className="flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm hover:bg-hover"
            >
              <span className="font-medium text-ink">From the beginning</span>
              <span className="text-xs text-ink-3">Start at lesson 1</span>
            </Link>
            {activeLessonId ? (
              <Link
                role="menuitem"
                to="/w/$workspaceId/m/$moduleId/preview"
                params={{ workspaceId, moduleId }}
                search={{ lesson: activeLessonId, returnTo: activeLessonId }}
                onClick={() => setPreviewOpen(false)}
                className="flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm hover:bg-hover"
              >
                <span className="font-medium text-ink">From this lesson</span>
                <span className="truncate text-xs text-ink-3">{lessonTitle}</span>
              </Link>
            ) : (
              <div
                aria-disabled="true"
                className="flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm opacity-50"
              >
                <span className="font-medium text-ink">From this lesson</span>
              </div>
            )}
          </div>
        )}
      </div>
      <Link
        to="/w/$workspaceId/m/$moduleId/publish"
        params={{ workspaceId, moduleId }}
        className="flex h-9 items-center rounded-[10px] bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-ink"
      >
        Publish
      </Link>
    </>
  );

  return <ModuleTopBar workspaceId={workspaceId} breadcrumb={breadcrumb} right={right} />;
}

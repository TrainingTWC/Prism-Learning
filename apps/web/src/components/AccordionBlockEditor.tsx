import { useState, useCallback, useEffect } from 'react';
import type { Id } from '~convex/_generated/dataModel';
import { ChevronDown, ChevronRight, Plus, Trash2, GripVertical } from 'lucide-react';
import { MediaUpload } from './MediaUpload';
import { InlineRichText } from './InlineRichText';

// ── Types ──────────────────────────────────────────────────────────────────
export type AccordionSection = {
  id: string;
  title: string;
  content: string;
  imageStorageId?: string;
  audioStorageId?: string;
};

export type AccordionPayload = {
  sections: AccordionSection[];
};

function uid() {
  return Math.random().toString(36).slice(2, 7);
}

function defaultPayload(): AccordionPayload {
  return {
    sections: [
      { id: uid(), title: '', content: '' },
      { id: uid(), title: '', content: '' },
    ],
  };
}

function parse(content?: string): AccordionPayload {
  if (!content) return defaultPayload();
  try {
    const raw = JSON.parse(content) as AccordionPayload;
    // Deduplicate section IDs — duplicate IDs cause both sections to open
    // simultaneously and sync their content when typed into.
    const seenIds = new Set<string>();
    const sections = (raw.sections ?? []).map((s) => {
      if (!s.id || seenIds.has(s.id)) return { ...s, id: uid() };
      seenIds.add(s.id);
      return s;
    });
    return { ...raw, sections };
  } catch {
    return defaultPayload();
  }
}

// ── Component ──────────────────────────────────────────────────────────────
export function AccordionBlockEditor({
  blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  // Parse once so both payload and expandedId use the same deduplicated IDs.
  const [payload, setPayload] = useState<AccordionPayload>(() => parse(initialContent));
  const [expandedId, setExpandedId] = useState<string | null>(
    () => parse(initialContent).sections[0]?.id ?? null,
  );

  // If the stored data had duplicate IDs, persist the fixed version immediately.
  useEffect(() => {
    if (!initialContent) return;
    try {
      const raw = JSON.parse(initialContent) as AccordionPayload;
      const ids = (raw.sections ?? []).map((s) => s.id);
      if (new Set(ids).size < ids.length) {
        onSave(JSON.stringify(payload));
      }
    } catch { /* not JSON, nothing to fix */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = useCallback(
    (next: AccordionPayload) => {
      setPayload(next);
      onSave(JSON.stringify(next));
    },
    [onSave],
  );

  function setTitle(id: string, title: string) {
    commit({
      sections: payload.sections.map((s) => (s.id === id ? { ...s, title } : s)),
    });
  }

  function setContent(id: string, content: string) {
    commit({
      sections: payload.sections.map((s) => (s.id === id ? { ...s, content } : s)),
    });
  }

  function setMedia(id: string, field: 'imageStorageId' | 'audioStorageId', value: string | null) {
    commit({
      sections: payload.sections.map((s) =>
        s.id === id ? { ...s, [field]: value ?? undefined } : s,
      ),
    });
  }

  function addSection() {
    if (payload.sections.length >= 10) return;
    const newId = uid();
    commit({ sections: [...payload.sections, { id: newId, title: '', content: '' }] });
    setExpandedId(newId);
  }

  function removeSection(id: string) {
    if (payload.sections.length <= 2) return;
    const remaining = payload.sections.filter((s) => s.id !== id);
    commit({ sections: remaining });
    if (expandedId === id) setExpandedId(remaining[0]?.id ?? null);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-amber-50/60 px-4 py-2.5">
        <ChevronDown className="size-4 text-amber-500 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-600">
          Accordion
        </span>
        <span className="ml-auto text-[11px] text-slate-400">
          {payload.sections.length}/10 sections
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {payload.sections.map((section, idx) => {
          const isOpen = expandedId === section.id;
          return (
            <div key={section.id} className="group">
              {/* Section header row */}
              <div className="flex items-center gap-2 px-3 py-2">
                <GripVertical className="size-3.5 text-slate-300 shrink-0 cursor-grab" />

                {/* Expand/collapse toggle */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : section.id)}
                  className="shrink-0 text-slate-400 hover:text-slate-600"
                >
                  {isOpen ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                </button>

                {/* Title input */}
                <input
                  type="text"
                  value={section.title}
                  onChange={(e) => setTitle(section.id, e.target.value)}
                  placeholder={`Section ${idx + 1} title…`}
                  className="flex-1 bg-transparent text-sm font-medium text-slate-700 placeholder-slate-400 outline-none"
                />

                <button
                  type="button"
                  onClick={() => removeSection(section.id)}
                  disabled={payload.sections.length <= 2}
                  className="shrink-0 text-slate-300 hover:text-red-400 disabled:opacity-30 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove section"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              {/* Content area */}
              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                    Content
                  </label>
                  <InlineRichText
                    value={section.content}
                    onChange={(html) => setContent(section.id, html)}
                    placeholder="Content revealed when the learner expands this section…"
                    multiline
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <MediaUpload
                      accept="image/*"
                      storageId={section.imageStorageId ?? null}
                      onChange={(id) => setMedia(section.id, 'imageStorageId', id)}
                      onClear={() => setMedia(section.id, 'imageStorageId', null)}
                    />
                    <MediaUpload
                      accept="audio/*"
                      storageId={section.audioStorageId ?? null}
                      onChange={(id) => setMedia(section.id, 'audioStorageId', id)}
                      onClear={() => setMedia(section.id, 'audioStorageId', null)}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add section */}
      {payload.sections.length < 10 && (
        <div className="border-t border-slate-100 px-4 py-2.5">
          <button
            type="button"
            onClick={addSection}
            className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800"
          >
            <Plus className="size-3.5" /> Add section
          </button>
        </div>
      )}
    </div>
  );
}

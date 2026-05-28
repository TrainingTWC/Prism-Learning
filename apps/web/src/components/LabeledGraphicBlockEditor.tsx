import { useRef, useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { Loader2, Upload, Tag, Trash2 } from 'lucide-react';

type Label = { id: string; xPct: number; yPct: number; text: string };
type Payload = { storageId: string; altText: string; labels: Label[] };

function parse(c?: string): Payload | null { if (!c) return null; try { return JSON.parse(c) as Payload; } catch { return null; } }
function uid() { return Math.random().toString(36).slice(2, 9); }

export function LabeledGraphicBlockEditor({
  blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const initial = parse(initialContent);
  const [storageId, setStorageId] = useState<string | null>(initial?.storageId ?? null);
  const [altText, setAltText] = useState(initial?.altText ?? '');
  const [labels, setLabels] = useState<Label[]>(initial?.labels ?? []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const url = useQuery(api.files.getFileUrl, storageId ? { storageId } : 'skip');

  useEffect(() => {
    if (storageId) onSave(JSON.stringify({ storageId, altText, labels }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageId, altText, labels]);

  const handleFile = useCallback(async (f: File) => {
    if (!f.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': f.type }, body: f });
      if (!res.ok) return;
      const { storageId: sid } = (await res.json()) as { storageId: string };
      setStorageId(sid);
    } finally { setUploading(false); }
  }, [generateUploadUrl]);

  function addLabel(e: React.MouseEvent<HTMLDivElement>) {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const l: Label = { id: uid(), xPct, yPct, text: `Label ${labels.length + 1}` };
    setLabels((ls) => [...ls, l]);
    setActiveId(l.id);
  }
  function update(id: string, patch: Partial<Label>) {
    setLabels((ls) => ls.map((l) => l.id === id ? { ...l, ...patch } : l));
  }
  function remove(id: string) {
    setLabels((ls) => ls.filter((l) => l.id !== id));
    if (activeId === id) setActiveId(null);
  }

  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  function onDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const l = labels.find((x) => x.id === id);
    if (!l) return;
    dragRef.current = { id, offsetX: e.clientX - (rect.left + (l.xPct / 100) * rect.width), offsetY: e.clientY - (rect.top + (l.yPct / 100) * rect.height) };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!dragRef.current || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - dragRef.current.offsetX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - dragRef.current.offsetY - rect.top) / rect.height) * 100;
    update(dragRef.current.id, { xPct: Math.max(0, Math.min(100, xPct)), yPct: Math.max(0, Math.min(100, yPct)) });
  }

  const active = labels.find((l) => l.id === activeId) ?? null;

  return (
    <div className="rounded-2xl border-2 border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden">
      <div className="flex items-center justify-between border-b-2 border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          <Tag className="size-4 text-amber-400" /> Labeled Graphic
        </div>
        <span className="text-xs text-[var(--text-muted)]">{labels.length} label{labels.length === 1 ? '' : 's'}</span>
      </div>

      <div className="p-4 space-y-3">
        {!storageId ? (
          <button type="button" onClick={() => ref.current?.click()} disabled={uploading} className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-sm font-semibold text-[var(--text-muted)] hover:border-amber-400 hover:text-amber-400">
            {uploading ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
            Upload base image
          </button>
        ) : (
          <>
            <div className="relative overflow-hidden rounded-xl border border-[var(--border-primary)] bg-black">
              {url ? (
                <div className="relative cursor-crosshair" onClick={addLabel}>
                  <img ref={imgRef} src={url} alt={altText} className="w-full select-none" draggable={false} />
                  {labels.map((l) => (
                    <div
                      key={l.id}
                      onPointerDown={(e) => onDown(e, l.id)}
                      onPointerMove={onMove}
                      onPointerUp={() => { dragRef.current = null; }}
                      onClick={(e) => { e.stopPropagation(); setActiveId(l.id); }}
                      style={{ left: `${l.xPct}%`, top: `${l.yPct}%` }}
                      className={`absolute flex -translate-x-1/2 -translate-y-1/2 cursor-move items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-lg ring-2 transition-all ${
                        activeId === l.id ? 'bg-amber-500 text-white ring-amber-500/40 scale-105' : 'bg-white text-slate-800 ring-amber-400/60 hover:scale-105'
                      }`}
                    >
                      <span className="size-1.5 rounded-full bg-amber-500" />
                      {l.text}
                    </div>
                  ))}
                </div>
              ) : <div className="flex h-48 items-center justify-center"><Loader2 className="size-5 animate-spin text-[var(--text-muted)]" /></div>}
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => ref.current?.click()} className="flex items-center gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--card-bg-hover)]">
                <Upload className="size-3.5" /> Replace
              </button>
              <input value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="Alt text" className="flex-1 rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-amber-400" />
            </div>

            {active && (
              <div className="rounded-xl border-2 border-amber-400/40 bg-[var(--bg-tertiary)] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Edit label</span>
                  <button type="button" onClick={() => remove(active.id)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-500/10">
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                </div>
                <input value={active.text} onChange={(e) => update(active.id, { text: e.target.value })} placeholder="Label text" className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-2 text-base font-semibold text-[var(--text-primary)] outline-none focus:border-amber-400" />
              </div>
            )}

            {!active && <p className="text-center text-xs text-[var(--text-muted)]">Click the image to place a label, or click a label to edit it</p>}
          </>
        )}
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
      </div>
    </div>
  );
}

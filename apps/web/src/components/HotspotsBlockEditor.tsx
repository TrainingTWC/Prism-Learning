import { useRef, useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { ImageIcon, Loader2, Upload, X, Plus, Trash2, Target } from 'lucide-react';

// ── Payload ────────────────────────────────────────────────────────────────
export type Hotspot = { id: string; xPct: number; yPct: number; title: string; body: string };
export type HotspotsPayload = {
  storageId: string;
  altText: string;
  hotspots: Hotspot[];
};

function parse(content?: string): HotspotsPayload | null {
  if (!content) return null;
  try { return JSON.parse(content) as HotspotsPayload; } catch { return null; }
}

function uid() { return Math.random().toString(36).slice(2, 9); }

export function HotspotsBlockEditor({
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
  const [hotspots, setHotspots] = useState<Hotspot[]>(initial?.hotspots ?? []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const url = useQuery(api.files.getFileUrl, storageId ? { storageId } : 'skip');

  // Persist on changes
  useEffect(() => {
    if (!storageId) return;
    onSave(JSON.stringify({ storageId, altText, hotspots }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageId, altText, hotspots]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
      if (!res.ok) throw new Error('Upload failed');
      const { storageId: sid } = (await res.json()) as { storageId: string };
      setStorageId(sid);
    } finally { setUploading(false); }
  }, [generateUploadUrl]);

  function addHotspotAt(e: React.MouseEvent<HTMLDivElement>) {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const newH: Hotspot = { id: uid(), xPct, yPct, title: `Hotspot ${hotspots.length + 1}`, body: '' };
    setHotspots((hs) => [...hs, newH]);
    setActiveId(newH.id);
  }

  function updateHotspot(id: string, patch: Partial<Hotspot>) {
    setHotspots((hs) => hs.map((h) => h.id === id ? { ...h, ...patch } : h));
  }

  function removeHotspot(id: string) {
    setHotspots((hs) => hs.filter((h) => h.id !== id));
    if (activeId === id) setActiveId(null);
  }

  // Drag a hotspot
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  function onDotPointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const h = hotspots.find((x) => x.id === id);
    if (!h) return;
    dragRef.current = {
      id,
      offsetX: e.clientX - (rect.left + (h.xPct / 100) * rect.width),
      offsetY: e.clientY - (rect.top + (h.yPct / 100) * rect.height),
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onDotPointerMove(e: React.PointerEvent) {
    if (!dragRef.current || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - dragRef.current.offsetX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - dragRef.current.offsetY - rect.top) / rect.height) * 100;
    updateHotspot(dragRef.current.id, {
      xPct: Math.max(0, Math.min(100, xPct)),
      yPct: Math.max(0, Math.min(100, yPct)),
    });
  }
  function onDotPointerUp() { dragRef.current = null; }

  const active = hotspots.find((h) => h.id === activeId) ?? null;

  return (
    <div className="rounded-2xl border-2 border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden">
      <div className="flex items-center justify-between border-b-2 border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          <Target className="size-4 text-rose-400" /> Hotspot Image
        </div>
        <span className="text-xs text-[var(--text-muted)]">{hotspots.length} hotspot{hotspots.length === 1 ? '' : 's'}</span>
      </div>

      <div className="p-4 space-y-4">
        {!storageId ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) void handleFile(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-sm transition-colors ${
              dragOver
                ? 'border-rose-400 bg-rose-500/10 text-rose-400'
                : 'border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:border-rose-400 hover:text-rose-400'
            }`}
          >
            {uploading ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
            <span className="mt-2 font-semibold">{uploading ? 'Uploading…' : 'Drop image or click to upload'}</span>
            <span className="mt-1 text-xs">Then click on the image to add hotspots</span>
          </div>
        ) : (
          <>
            <div className="relative overflow-hidden rounded-xl border border-[var(--border-primary)] bg-black">
              {url ? (
                <div className="relative cursor-crosshair" onClick={addHotspotAt}>
                  <img ref={imgRef} src={url} alt={altText} className="w-full select-none" draggable={false} />
                  {hotspots.map((h, idx) => (
                    <button
                      key={h.id}
                      type="button"
                      onPointerDown={(e) => onDotPointerDown(e, h.id)}
                      onPointerMove={onDotPointerMove}
                      onPointerUp={onDotPointerUp}
                      onClick={(e) => { e.stopPropagation(); setActiveId(h.id); }}
                      style={{ left: `${h.xPct}%`, top: `${h.yPct}%` }}
                      className={`absolute flex size-8 -translate-x-1/2 -translate-y-1/2 cursor-move items-center justify-center rounded-full text-xs font-bold text-white shadow-lg ring-4 transition-all ${
                        activeId === h.id ? 'bg-rose-500 ring-rose-500/30 scale-110' : 'bg-rose-400 ring-rose-400/20 hover:scale-110'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center text-[var(--text-muted)]"><Loader2 className="size-5 animate-spin" /></div>
              )}
            </div>

            {hotspots.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Select:</span>
                {hotspots.map((h, idx) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setActiveId(activeId === h.id ? null : h.id)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition-all ${
                      activeId === h.id
                        ? 'border-rose-400 bg-rose-500/10 text-rose-500'
                        : 'border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:border-rose-300 hover:text-rose-400'
                    }`}
                  >
                    <span className="flex size-4 items-center justify-center rounded-full bg-rose-400 text-[9px] font-bold text-white">{idx + 1}</span>
                    <span className="max-w-[5rem] truncate">{h.title || `Hotspot ${idx + 1}`}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--card-bg-hover)]">
                <Upload className="size-3.5" /> Replace
              </button>
              <input
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Alt text (for accessibility)"
                className="flex-1 rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-rose-400"
              />
            </div>

            {active && (
              <div className="rounded-xl border-2 border-rose-400/40 bg-[var(--bg-tertiary)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Editing hotspot</span>
                  <button type="button" onClick={() => removeHotspot(active.id)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-500/10">
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                </div>
                <input
                  value={active.title}
                  onChange={(e) => updateHotspot(active.id, { title: e.target.value })}
                  placeholder="Hotspot title"
                  className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-2 text-base font-semibold text-[var(--text-primary)] outline-none focus:border-rose-400"
                />
                <textarea
                  value={active.body}
                  onChange={(e) => updateHotspot(active.id, { body: e.target.value })}
                  placeholder="What appears when learner clicks this hotspot…"
                  rows={3}
                  className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-rose-400 resize-none"
                />
              </div>
            )}

            {!active && hotspots.length === 0 && (
              <p className="text-center text-xs text-[var(--text-muted)]">Click anywhere on the image to add a hotspot</p>
            )}
            {!active && hotspots.length > 0 && (
              <p className="text-center text-xs text-[var(--text-muted)]">Click a numbered dot to edit it, or click the image for another</p>
            )}
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
        />
      </div>
    </div>
  );
}

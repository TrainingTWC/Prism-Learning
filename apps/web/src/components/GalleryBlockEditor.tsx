import { useRef, useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { Loader2, Upload, Trash2, Plus, Images, LayoutGrid, GalleryHorizontal } from 'lucide-react';
import { CaptionEditor } from './CaptionEditor';

type Item = { storageId: string; altText: string; caption: string };
type Payload = { layout: 'carousel' | 'grid'; items: Item[] };

function parse(c?: string): Payload | null {
  if (!c) return null;
  try { return JSON.parse(c) as Payload; } catch { return null; }
}

function ResolvedThumb({ storageId }: { storageId: string }) {
  const url = useQuery(api.files.getFileUrl, { storageId });
  if (!url) return <div className="flex aspect-square items-center justify-center bg-[var(--bg-tertiary)]"><Loader2 className="size-4 animate-spin text-[var(--text-muted)]" /></div>;
  return <img src={url} alt="" className="aspect-square w-full object-cover" />;
}

export function GalleryBlockEditor({
  blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const initial = parse(initialContent);
  const [layout, setLayout] = useState<'carousel' | 'grid'>(initial?.layout ?? 'carousel');
  const [items, setItems] = useState<Item[]>(initial?.items ?? []);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  useEffect(() => {
    onSave(JSON.stringify({ layout, items }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, items]);

  const handleFiles = useCallback(async (files: FileList) => {
    setUploading(true);
    try {
      const uploaded: Item[] = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('image/')) continue;
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': f.type }, body: f });
        if (!res.ok) continue;
        const { storageId } = (await res.json()) as { storageId: string };
        uploaded.push({ storageId, altText: '', caption: '' });
      }
      setItems((it) => [...it, ...uploaded]);
    } finally { setUploading(false); }
  }, [generateUploadUrl]);

  function update(i: number, patch: Partial<Item>) {
    setItems((it) => it.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  }
  function remove(i: number) {
    setItems((it) => it.filter((_, idx) => idx !== i));
  }

  return (
    <div className="rounded-2xl border-2 border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden">
      <div className="flex items-center justify-between border-b-2 border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          <Images className="size-4 text-violet-400" /> Image Gallery
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-secondary)] p-0.5">
          <button type="button" onClick={() => setLayout('carousel')} className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${layout === 'carousel' ? 'bg-violet-500 text-white' : 'text-[var(--text-muted)]'}`}>
            <GalleryHorizontal className="size-3.5" /> Carousel
          </button>
          <button type="button" onClick={() => setLayout('grid')} className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${layout === 'grid' ? 'bg-violet-500 text-white' : 'text-[var(--text-muted)]'}`}>
            <LayoutGrid className="size-3.5" /> Grid
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {items.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {items.map((it, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
                <div className="relative">
                  <ResolvedThumb storageId={it.storageId} />
                  <button type="button" onClick={() => remove(i)} className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-red-500" title="Remove">
                    <Trash2 className="size-3" />
                  </button>
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 text-[10px] font-bold text-white">{i + 1}</span>
                </div>
                <div className="border-t border-[var(--border-primary)] p-1.5">
                  <CaptionEditor
                    value={it.caption}
                    onChange={(html) => update(i, { caption: html })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border-primary)] bg-[var(--bg-tertiary)] py-4 text-sm font-semibold text-[var(--text-muted)] hover:border-violet-400 hover:text-violet-400"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {uploading ? 'Uploading…' : 'Add images'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); }}
        />
      </div>
    </div>
  );
}

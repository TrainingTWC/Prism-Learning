import { useRef, useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { Loader2, Upload, Columns2, ArrowLeftRight } from 'lucide-react';

type Payload = { beforeStorageId: string; afterStorageId: string; beforeLabel: string; afterLabel: string };

function parse(c?: string): Payload | null { if (!c) return null; try { return JSON.parse(c) as Payload; } catch { return null; } }

function UploadSlot({ storageId, label, onUpload, accent }: { storageId: string | null; label: string; onUpload: (sid: string) => void; accent: string }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const url = useQuery(api.files.getFileUrl, storageId ? { storageId } : 'skip');

  async function handleFile(f: File) {
    if (!f.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': f.type }, body: f });
      if (!res.ok) return;
      const { storageId: sid } = (await res.json()) as { storageId: string };
      onUpload(sid);
    } finally { setUploading(false); }
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>{label}</span>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:border-[var(--text-tertiary)]"
      >
        {storageId && url ? (
          <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : uploading ? <Loader2 className="size-5 animate-spin" /> : <div className="flex flex-col items-center gap-1 text-xs"><Upload className="size-5" />Click to upload</div>}
      </button>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
    </div>
  );
}

export function CompareBlockEditor({
  blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const initial = parse(initialContent);
  const [before, setBefore] = useState<string | null>(initial?.beforeStorageId ?? null);
  const [after, setAfter] = useState<string | null>(initial?.afterStorageId ?? null);
  const [beforeLabel, setBeforeLabel] = useState(initial?.beforeLabel ?? 'Before');
  const [afterLabel, setAfterLabel] = useState(initial?.afterLabel ?? 'After');

  useEffect(() => {
    if (before && after) onSave(JSON.stringify({ beforeStorageId: before, afterStorageId: after, beforeLabel, afterLabel }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [before, after, beforeLabel, afterLabel]);

  return (
    <div className="rounded-2xl border-2 border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden">
      <div className="flex items-center justify-between border-b-2 border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          <ArrowLeftRight className="size-4 text-cyan-400" /> Before / After
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <UploadSlot storageId={before} label="Before" onUpload={setBefore} accent="#22d3ee" />
            <input value={beforeLabel} onChange={(e) => setBeforeLabel(e.target.value)} placeholder="Label" className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-cyan-400" />
          </div>
          <div className="space-y-2">
            <UploadSlot storageId={after} label="After" onUpload={setAfter} accent="#22d3ee" />
            <input value={afterLabel} onChange={(e) => setAfterLabel(e.target.value)} placeholder="Label" className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-cyan-400" />
          </div>
        </div>
        {(!before || !after) && (
          <p className="rounded-lg bg-cyan-500/10 px-3 py-2 text-center text-xs text-cyan-400">Upload both images to enable the slider preview</p>
        )}
      </div>
    </div>
  );
}

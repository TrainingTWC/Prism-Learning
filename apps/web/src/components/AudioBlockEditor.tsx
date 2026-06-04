import { useRef, useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { Loader2, Upload, Music, X } from 'lucide-react';

type Payload = { storageId: string; title: string; transcript: string };

function parse(c?: string): Payload | null { if (!c) return null; try { return JSON.parse(c) as Payload; } catch { return null; } }

export function AudioBlockEditor({
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
  const [title, setTitle] = useState(initial?.title ?? '');
  const [transcript, setTranscript] = useState(initial?.transcript ?? '');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const url = useQuery(api.files.getFileUrl, storageId ? { storageId } : 'skip');

  useEffect(() => {
    if (storageId) onSave(JSON.stringify({ storageId, title, transcript }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageId, title, transcript]);

  const handleFile = useCallback(async (f: File) => {
    if (!f.type.startsWith('audio/')) return;
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': f.type }, body: f });
      if (!res.ok) return;
      const { storageId: sid } = (await res.json()) as { storageId: string };
      setStorageId(sid);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
    } finally { setUploading(false); }
  }, [generateUploadUrl, title]);

  return (
    <div className="rounded-2xl border-2 border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden">
      <div className="flex items-center justify-between border-b-2 border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          <Music className="size-4 text-pink-400" /> Audio
        </div>
      </div>
      <div className="p-4 space-y-3">
        {!storageId ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => !uploading && ref.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && !uploading && ref.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f && !uploading) void handleFile(f);
            }}
            className={`flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-semibold transition-colors ${
              dragOver
                ? 'border-pink-400 bg-pink-400/10 text-pink-400'
                : 'border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:border-pink-400 hover:text-pink-400'
            }`}
          >
            {uploading ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
            {uploading ? 'Uploading…' : dragOver ? 'Drop to upload' : 'Upload audio file (MP3, WAV, M4A)'}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-3">
              {url && <audio src={url} controls className="flex-1" />}
              <button type="button" onClick={() => setStorageId(null)} className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400" title="Remove">
                <X className="size-4" />
              </button>
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Audio title"
              className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-2 text-base font-semibold text-[var(--text-primary)] outline-none focus:border-pink-400"
            />
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Transcript (optional — improves accessibility & SEO)"
              rows={3}
              className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-pink-400 resize-none"
            />
          </>
        )}
        <input ref={ref} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
      </div>
    </div>
  );
}

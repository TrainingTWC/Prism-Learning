import { useRef, useState, useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { Loader2, Upload, Video, X, Link as LinkIcon } from 'lucide-react';

// ── Payload ────────────────────────────────────────────────────────────────
export type VideoPayload = {
  /** 'embed' = YouTube/Vimeo URL  |  'storage' = Convex-stored file */
  srcType: 'embed' | 'storage';
  src: string;   // embed URL or storageId
  caption: string;
};

function parsePayload(content?: string): VideoPayload | null {
  if (!content) return null;
  try {
    return JSON.parse(content) as VideoPayload;
  } catch {
    return null;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getEmbedUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    // YouTube
    const yt = u.searchParams.get('v') ?? u.pathname.replace(/^\/embed\/|^\//, '');
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const id = u.hostname.includes('youtu.be')
        ? u.pathname.slice(1)
        : (u.searchParams.get('v') ?? '');
      if (id) return `https://www.youtube.com/embed/${id}?rel=0`;
    }
    // Vimeo
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    // Already an embed URL or other
    return raw;
  } catch {
    return null;
  }
}

// ── Storage video player ───────────────────────────────────────────────────
function StorageVideo({ storageId, caption }: { storageId: string; caption: string }) {
  const url = useQuery(api.files.getFileUrl, { storageId });

  if (url === undefined) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl bg-slate-100">
        <Loader2 className="size-5 animate-spin text-slate-400" />
      </div>
    );
  }
  if (url === null) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
        Video unavailable
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video src={url} controls className="w-full max-h-96 bg-black" />
      {caption && (
        <p className="px-3 py-1.5 text-center text-xs text-slate-500 bg-slate-50">{caption}</p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function VideoBlockEditor({
  blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const payload = parsePayload(initialContent);
  const [mode, setMode] = useState<'embed' | 'upload'>(
    payload?.srcType === 'storage' ? 'upload' : 'embed',
  );
  const [embedUrl, setEmbedUrl] = useState(
    payload?.srcType === 'embed' ? payload.src : '',
  );
  const [caption, setCaption] = useState(payload?.caption ?? '');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const deleteFile = useMutation(api.files.deleteFile);

  const storageId = payload?.srcType === 'storage' ? payload.src : null;

  const save = useCallback(
    (srcType: 'embed' | 'storage', src: string, cap: string) => {
      onSave(JSON.stringify({ srcType, src, caption: cap } satisfies VideoPayload));
    },
    [onSave],
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('video/')) return;
      setUploading(true);
      try {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!res.ok) throw new Error('Upload failed');
        const { storageId: newId } = (await res.json()) as { storageId: string };
        if (storageId) await deleteFile({ storageId });
        save('storage', newId, caption);
      } finally {
        setUploading(false);
      }
    },
    [generateUploadUrl, deleteFile, storageId, caption, save],
  );

  const handleClear = async () => {
    if (storageId) await deleteFile({ storageId });
    onSave('');
    setEmbedUrl('');
    setCaption('');
  };

  // ── Already has content ────────────────────────────────────────────────
  if (payload) {
    const embedSrc = payload.srcType === 'embed' ? getEmbedUrl(payload.src) : null;
    return (
      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="relative group">
          {payload.srcType === 'embed' && embedSrc ? (
            <div className="rounded-xl overflow-hidden border border-slate-200 aspect-video">
              <iframe
                src={embedSrc}
                title="Video embed"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
              {caption && (
                <p className="px-3 py-1.5 text-center text-xs text-slate-500 bg-slate-50">
                  {caption}
                </p>
              )}
            </div>
          ) : payload.srcType === 'storage' ? (
            <StorageVideo storageId={payload.src} caption={caption} />
          ) : null}
          <button
            type="button"
            onClick={() => void handleClear()}
            className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-opacity"
            title="Remove video"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <input
          type="text"
          placeholder="Caption…"
          value={caption}
          onChange={(e) => {
            setCaption(e.target.value);
            save(payload.srcType, payload.src, e.target.value);
          }}
          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
        />
      </div>
    );
  }

  // ── No content yet — show mode picker ─────────────────────────────────
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      {/* Mode tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 w-fit">
        <button
          type="button"
          onClick={() => setMode('embed')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            mode === 'embed'
              ? 'bg-white shadow-sm text-slate-800'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <LinkIcon className="size-3.5" /> URL embed
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            mode === 'upload'
              ? 'bg-white shadow-sm text-slate-800'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Upload className="size-3.5" /> Upload file
        </button>
      </div>

      {mode === 'embed' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (embedUrl.trim()) save('embed', embedUrl.trim(), caption);
          }}
          className="flex gap-2"
        >
          <input
            type="url"
            placeholder="Paste YouTube or Vimeo URL…"
            value={embedUrl}
            onChange={(e) => setEmbedUrl(e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
          />
          <button
            type="submit"
            disabled={!embedUrl.trim()}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            Embed
          </button>
        </form>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
          className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors ${
            dragOver
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40'
          }`}
        >
          {uploading ? (
            <Loader2 className="size-6 animate-spin text-indigo-500" />
          ) : (
            <>
              <div className="flex size-10 items-center justify-center rounded-full bg-white shadow-sm border border-slate-200">
                {dragOver ? <Upload className="size-5 text-indigo-500" /> : <Video className="size-5 text-slate-400" />}
              </div>
              <p className="text-sm font-medium text-slate-600">
                {dragOver ? 'Drop to upload' : 'Click or drag a video file'}
              </p>
              <p className="text-xs text-slate-400">MP4, WebM, MOV</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />
        </div>
      )}
    </div>
  );
}

import { useRef, useState, useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { Loader2, Upload, Zap, X, RotateCcw, Play } from 'lucide-react';

// ── Payload ────────────────────────────────────────────────────────────────
export type LottiePayload = {
  storageId: string;
  loop: boolean;
  autoplay: boolean;
};

function parsePayload(content?: string): LottiePayload | null {
  if (!content) return null;
  try {
    return JSON.parse(content) as LottiePayload;
  } catch {
    return null;
  }
}

// ── Player sub-component (resolves URL then renders) ───────────────────────
function LottiePlayer({
  storageId,
  loop,
  autoplay,
}: {
  storageId: string;
  loop: boolean;
  autoplay: boolean;
}) {
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
        Animation unavailable
      </div>
    );
  }

  return (
    <DotLottieReact
      src={url}
      loop={loop}
      autoplay={autoplay}
      style={{ width: '100%', maxHeight: 320 }}
    />
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function LottieBlockEditor({
  blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const payload = parsePayload(initialContent);
  const [loop, setLoop] = useState(payload?.loop ?? true);
  const [autoplay, setAutoplay] = useState(payload?.autoplay ?? true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const deleteFile = useMutation(api.files.deleteFile);

  const storageId = payload?.storageId ?? null;

  const save = useCallback(
    (sid: string, l: boolean, ap: boolean) => {
      onSave(JSON.stringify({ storageId: sid, loop: l, autoplay: ap } satisfies LottiePayload));
    },
    [onSave],
  );

  const handleFile = useCallback(
    async (file: File) => {
      const isLottie =
        file.name.endsWith('.json') ||
        file.name.endsWith('.lottie') ||
        file.type === 'application/json';
      if (!isLottie) return;

      setUploading(true);
      try {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'application/json' },
          body: file,
        });
        if (!res.ok) throw new Error('Upload failed');
        const { storageId: newId } = (await res.json()) as { storageId: string };
        if (storageId) await deleteFile({ storageId });
        save(newId, loop, autoplay);
      } finally {
        setUploading(false);
      }
    },
    [generateUploadUrl, deleteFile, storageId, loop, autoplay, save],
  );

  const handleClear = async () => {
    if (storageId) await deleteFile({ storageId });
    onSave('');
  };

  // ── Already has animation ────────────────────────────────────────────────
  if (storageId) {
    return (
      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="relative group rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
          <LottiePlayer storageId={storageId} loop={loop} autoplay={autoplay} />
          <button
            type="button"
            onClick={() => void handleClear()}
            className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-opacity"
            title="Remove animation"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => {
                setLoop(e.target.checked);
                save(storageId, e.target.checked, autoplay);
              }}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <RotateCcw className="size-3 text-slate-500" />
            <span className="text-xs text-slate-600">Loop</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(e) => {
                setAutoplay(e.target.checked);
                save(storageId, loop, e.target.checked);
              }}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <Play className="size-3 text-slate-500" />
            <span className="text-xs text-slate-600">Autoplay</span>
          </label>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="ml-auto text-xs text-indigo-600 hover:underline"
          >
            Replace
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.lottie,application/json"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>
    );
  }

  // ── Upload zone ────────────────────────────────────────────────────────
  return (
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
      className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors ${
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
            {dragOver ? <Upload className="size-5 text-indigo-500" /> : <Zap className="size-5 text-slate-400" />}
          </div>
          <p className="text-sm font-medium text-slate-600">
            {dragOver ? 'Drop to upload' : 'Click or drag a Lottie animation'}
          </p>
          <p className="text-xs text-slate-400">.json or .lottie file</p>
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.lottie,application/json"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

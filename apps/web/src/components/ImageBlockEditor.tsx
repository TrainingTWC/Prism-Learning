import { useRef, useState, useCallback } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { ImageIcon, Loader2, Sparkles, Upload, Wand2, X } from 'lucide-react';

// ── Payload type stored as JSON in block.content ───────────────────────────
export type ImagePayload = {
  storageId: string;
  altText: string;
  caption: string;
};

function parsePayload(content?: string): ImagePayload | null {
  if (!content) return null;
  try {
    return JSON.parse(content) as ImagePayload;
  } catch {
    return null;
  }
}

// ── AI image style presets (must match keys in convex/ai.ts) ───────────────
const STYLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'flat-vector', label: 'Flat vector' },
  { value: 'isometric', label: 'Isometric' },
  { value: '3d-render', label: '3D render' },
  { value: 'watercolor', label: 'Watercolor' },
  { value: 'line-art', label: 'Line art' },
  { value: 'minimalist', label: 'Minimalist' },
  { value: 'photographic', label: 'Photographic' },
];

// ── Sub-component: resolved image display ─────────────────────────────────
function ImageDisplay({
  storageId,
  altText,
  caption,
  onClear,
}: {
  storageId: string;
  altText: string;
  caption: string;
  onClear: () => void;
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
        Image unavailable
      </div>
    );
  }

  return (
    <div className="relative group rounded-xl overflow-hidden border border-slate-200">
      <img src={url} alt={altText || 'Block image'} className="w-full object-cover max-h-96" />
      {caption && (
        <p className="px-3 py-1.5 text-center text-xs text-slate-500 bg-slate-50">{caption}</p>
      )}
      <button
        type="button"
        onClick={onClear}
        className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-opacity"
        title="Remove image"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function ImageBlockEditor({
  blockId,
  moduleId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  moduleId?: Id<'modules'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const payload = parsePayload(initialContent);
  const [altText, setAltText] = useState(payload?.altText ?? '');
  const [caption, setCaption] = useState(payload?.caption ?? '');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState<'upload' | 'generate'>('upload');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('flat-vector');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const deleteFile = useMutation(api.files.deleteFile);
  const generateImage = useAction(api.ai.generateImage);

  const storageId = payload?.storageId ?? null;

  const save = useCallback(
    (sid: string, alt: string, cap: string) => {
      const p: ImagePayload = { storageId: sid, altText: alt, caption: cap };
      onSave(JSON.stringify(p));
    },
    [onSave],
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) return;
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

        // Delete old file if replacing
        if (storageId) {
          await deleteFile({ storageId });
        }
        save(newId, altText, caption);
      } finally {
        setUploading(false);
      }
    },
    [generateUploadUrl, deleteFile, storageId, altText, caption, save],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const handleClear = async () => {
    if (storageId) await deleteFile({ storageId });
    onSave('');
    setAltText('');
    setCaption('');
  };

  const handleGenerate = useCallback(async () => {
    if (!moduleId || !prompt.trim()) return;
    setGenerating(true);
    setGenError('');
    try {
      const { storageId: newId } = await generateImage({ moduleId, prompt: prompt.trim(), style });
      save(newId, altText || prompt.trim().slice(0, 120), caption);
    } catch (e) {
      const data = (e as { data?: unknown })?.data;
      setGenError(
        typeof data === 'string'
          ? data
          : e instanceof Error
            ? e.message
            : 'Generation failed',
      );
    } finally {
      setGenerating(false);
    }
  }, [moduleId, prompt, style, generateImage, save, altText, caption]);

  // ── Image already uploaded ──────────────────────────────────────────────
  if (storageId) {
    return (
      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <ImageDisplay
          storageId={storageId}
          altText={altText}
          caption={caption}
          onClear={() => void handleClear()}
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Alt text…"
            value={altText}
            onChange={(e) => {
              setAltText(e.target.value);
              if (storageId) save(storageId, e.target.value, caption);
            }}
            className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
          />
          <input
            type="text"
            placeholder="Caption…"
            value={caption}
            onChange={(e) => {
              setCaption(e.target.value);
              if (storageId) save(storageId, altText, e.target.value);
            }}
            className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
          />
        </div>
      </div>
    );
  }

  // ── Empty state: Upload / Generate tabs ─────────────────────────────────
  const canGenerate = !!moduleId;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      {canGenerate && (
        <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === 'upload' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Upload className="size-3.5" /> Upload
          </button>
          <button
            type="button"
            onClick={() => setMode('generate')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === 'generate' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sparkles className="size-3.5" /> Generate with AI
          </button>
        </div>
      )}

      {mode === 'upload' || !canGenerate ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => void handleDrop(e)}
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
                {dragOver ? <Upload className="size-5 text-indigo-500" /> : <ImageIcon className="size-5 text-slate-400" />}
              </div>
              <p className="text-sm font-medium text-slate-600">
                {dragOver ? 'Drop to upload' : 'Click or drag an image'}
              </p>
              <p className="text-xs text-slate-400">PNG, JPG, GIF, WebP</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleInputChange}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Describe the image to generate (e.g. 'a barista steaming milk at a modern espresso machine, warm tones')"
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
          />

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500">Style</label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
            >
              {STYLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {genError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-500">{genError}</p>
          )}

          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating || !prompt.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            {generating ? 'Generating…' : 'Generate image'}
          </button>
        </div>
      )}
    </div>
  );
}

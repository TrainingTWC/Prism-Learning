import { useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { toWebP } from '../../lib/toWebP';

interface CoverPickerProps {
  moduleId: Id<'modules'>;
  title: string;
  coverUrl: string | null | undefined;
}

/** Module cover: image or brand-purple title tile, with change / remove. */
export function CoverPicker({ moduleId, title, coverUrl }: CoverPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const setCover = useMutation(api.modules.setCover);
  const clearCover = useMutation(api.modules.clearCover);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const upload = await toWebP(file, 1600);
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': upload.type },
        body: upload,
      });
      if (!res.ok) throw new Error('Upload failed');
      const { storageId } = (await res.json()) as { storageId: string };
      await setCover({ moduleId, storageId: storageId as Id<'_storage'> });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not upload cover');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      await clearCover({ moduleId });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not remove cover');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-[240px] flex-1 basis-80 flex-col justify-between overflow-hidden bg-[#7B35C1] p-7 text-white">
      {coverUrl && (
        <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover" />
      )}
      {coverUrl && <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />}
      {!coverUrl && (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, #8C43D0 0%, #5E2A8E 100%)' }}
        />
      )}
      <span className="relative text-xs font-semibold uppercase tracking-[0.08em] opacity-85">Module cover</span>
      <span className="relative text-[30px] font-extrabold leading-[1.15]">{title}</span>
      <div className="relative flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-white/20 px-3 text-xs font-medium text-white backdrop-blur transition hover:bg-white/30 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {coverUrl ? 'Change cover' : 'Add cover image'}
        </button>
        {coverUrl && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleRemove()}
            className="flex h-8 items-center rounded-lg px-3 text-xs font-medium text-white/90 transition hover:bg-white/15 disabled:opacity-60"
          >
            Remove
          </button>
        )}
        {error && (
          <span className="rounded-md bg-red-600/90 px-2 py-1 text-xs font-medium" role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

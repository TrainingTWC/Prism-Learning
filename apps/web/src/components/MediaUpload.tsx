import { useRef } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { ImageIcon, Music, X, Upload } from 'lucide-react';

interface MediaUploadProps {
  accept: 'image/*' | 'audio/*';
  storageId: string | null;
  onChange: (storageId: string) => void;
  onClear: () => void;
  label?: string;
}

export function MediaUpload({ accept, storageId, onChange, onClear, label }: MediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const fileUrl = useQuery(
    api.files.getFileUrl,
    storageId ? { storageId: storageId as Id<'_storage'> } : 'skip',
  );

  const isImage = accept === 'image/*';

  async function handleFile(file: File) {
    const uploadUrl = await generateUploadUrl();
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    const { storageId: newId } = (await res.json()) as { storageId: string };
    onChange(newId);
  }

  if (storageId && fileUrl) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
        {isImage ? (
          <img src={fileUrl} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
        ) : (
          <Music className="size-4 text-slate-400 shrink-0" />
        )}
        <span className="text-xs text-slate-500 truncate flex-1">
          {isImage ? 'Image attached' : 'Audio attached'}
        </span>
        <button
          type="button"
          onClick={onClear}
          className="rounded p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Remove"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
      >
        {isImage ? <ImageIcon className="size-3.5" /> : <Music className="size-3.5" />}
        <Upload className="size-3" />
        {label ?? (isImage ? 'Add image' : 'Add audio')}
      </button>
    </>
  );
}

import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from '@tanstack/react-router';
import { useAction, useMutation } from 'convex/react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { Sparkles, ChevronLeft, Loader2, BookOpen, Zap, FileText, Upload, X } from 'lucide-react';

type ModuleType = 'microLearning' | 'course';
type Step = 'form' | 'generating' | 'error';
type SourceMode = 'describe' | 'upload';

type UploadedSourceFile = {
  storageId: string;
  name: string;
  type: string;
  size: number;
};

const GENERATING_MESSAGES = [
  'Thinking about your content…',
  'Structuring lessons…',
  'Creating lesson visuals…',
  'Writing explanations…',
  'Adding interactive questions…',
  'Polishing the module…',
];

export function BuildWithAIPage() {
  const { workspaceId } = useParams({ from: '/protected/w/$workspaceId/build-with-ai' });
  const navigate = useNavigate();
  const generateModule = useAction(api.ai.generateModule);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const deleteFile = useMutation(api.files.deleteFile);

  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [type, setType] = useState<ModuleType>('microLearning');
  const [description, setDescription] = useState('');
  const [sourceMode, setSourceMode] = useState<SourceMode>('describe');
  const [sourceFile, setSourceFile] = useState<UploadedSourceFile | null>(null);
  const [uploadingSource, setUploadingSource] = useState(false);
  const [dragOverSource, setDragOverSource] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState('');
  const [statusIdx, setStatusIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);

  const MAX_DESC = 1000;
  const canSubmit = Boolean(
    name.trim() &&
    objective.trim() &&
    (sourceMode === 'describe' ? description.trim() : sourceFile),
  );

  // Cycle through status messages while generating
  useEffect(() => {
    if (step === 'generating') {
      intervalRef.current = setInterval(() => {
        setStatusIdx((i) => Math.min(i + 1, GENERATING_MESSAGES.length - 1));
      }, 5000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setStatusIdx(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [step]);

  async function handleSourceFile(file: File) {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
    ];
    const isAllowed = allowed.includes(file.type) || file.type.startsWith('image/') || file.type.startsWith('video/') || /\.(docx|pdf|txt|md|csv|json)$/i.test(file.name);
    const maxBytes = 25 * 1024 * 1024;

    if (!isAllowed) {
      setError('Upload PDF, DOCX, TXT, Markdown, CSV, JSON, image, or video files. Legacy .doc files are not supported yet; save as .docx first.');
      setStep('error');
      return;
    }
    if (file.size > maxBytes) {
      setError('Source files must be 25 MB or smaller for this first version.');
      setStep('error');
      return;
    }

    setUploadingSource(true);
    setError('');
    setStep('form');

    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!res.ok) throw new Error('Upload failed');
      const { storageId } = (await res.json()) as { storageId: string };

      if (sourceFile) await deleteFile({ storageId: sourceFile.storageId });
      setSourceFile({ storageId, name: file.name, type: file.type || 'application/octet-stream', size: file.size });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setStep('error');
    } finally {
      setUploadingSource(false);
    }
  }

  async function clearSourceFile() {
    if (sourceFile) await deleteFile({ storageId: sourceFile.storageId });
    setSourceFile(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setStep('generating');
    setError('');

    try {
      const moduleId = await generateModule({
        workspaceId: workspaceId as Id<'workspaces'>,
        name: name.trim(),
        objective: objective.trim(),
        type,
        description: description.trim(),
        sourceFile: sourceMode === 'upload' && sourceFile ? sourceFile : undefined,
      });

      void navigate({
        to: '/w/$workspaceId/m/$moduleId',
        params: { workspaceId, moduleId: moduleId as string },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStep('error');
    }
  }

  // ── Generating screen ────────────────────────────────────────────────────
  if (step === 'generating') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-xs text-center">
          {/* Animated icon */}
          <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-indigo-100 animate-pulse" />
            <Sparkles className="relative size-9 text-indigo-600" />
          </div>

          <h2 className="text-xl font-bold text-slate-900">Building your module</h2>
          <p className="mt-2 text-sm text-slate-500 transition-all duration-500">
            {GENERATING_MESSAGES[statusIdx]}
          </p>

          {/* Progress dots */}
          <div className="mt-8 flex items-center justify-center gap-2">
            {GENERATING_MESSAGES.map((_, i) => (
              <span
                key={i}
                className={`block h-1.5 rounded-full transition-all duration-500 ${
                  i === statusIdx ? 'w-6 bg-indigo-500' : i < statusIdx ? 'w-1.5 bg-indigo-300' : 'w-1.5 bg-slate-200'
                }`}
              />
            ))}
          </div>

          <p className="mt-6 text-xs text-slate-400">
            Llama 3.3 is generating content — this usually takes 15–30 seconds.
          </p>
        </div>
      </div>
    );
  }

  // ── Form screen ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            to="/w/$workspaceId/modules"
            params={{ workspaceId }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-indigo-500" />
            <span className="text-sm font-semibold text-slate-800">Build with AI</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        {/* Hero */}
        <div className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600">
            <Sparkles className="size-3" />
            Powered by Llama 3.3 via Groq
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Generate a learning module</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Describe what you want to teach or upload a source document. Llama 3.3 will
            generate a full mobile-ready module with lesson visuals, explanations, and
            interactive questions for you.
          </p>
        </div>

        {/* Error banner */}
        {step === 'error' && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="mt-0.5 shrink-0 text-base">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
          {/* Module name */}
          <div>
            <label htmlFor="ai-name" className="mb-1.5 block text-sm font-medium text-slate-700">
              Module name
            </label>
            <input
              id="ai-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Introduction to Cybersecurity"
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            />
          </div>

          {/* Learning objective */}
          <div>
            <label htmlFor="ai-objective" className="mb-1.5 block text-sm font-medium text-slate-700">
              Learning objective
            </label>
            <input
              id="ai-objective"
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Learners will identify phishing emails and avoid common attacks"
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            />
          </div>

          {/* Type selector */}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Module type</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('microLearning')}
                className={`group flex flex-col gap-1 rounded-xl border-2 px-4 py-4 text-left transition ${
                  type === 'microLearning'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Zap
                    className={`size-4 ${type === 'microLearning' ? 'text-indigo-600' : 'text-slate-400'}`}
                  />
                  <span
                    className={`text-sm font-semibold ${
                      type === 'microLearning' ? 'text-indigo-700' : 'text-slate-700'
                    }`}
                  >
                    Micro-learning
                  </span>
                </div>
                <p
                  className={`text-xs leading-relaxed ${
                    type === 'microLearning' ? 'text-indigo-500' : 'text-slate-400'
                  }`}
                >
                  1–3 lessons · 5–10 min · focused topic
                </p>
              </button>

              <button
                type="button"
                onClick={() => setType('course')}
                className={`group flex flex-col gap-1 rounded-xl border-2 px-4 py-4 text-left transition ${
                  type === 'course'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BookOpen
                    className={`size-4 ${type === 'course' ? 'text-indigo-600' : 'text-slate-400'}`}
                  />
                  <span
                    className={`text-sm font-semibold ${
                      type === 'course' ? 'text-indigo-700' : 'text-slate-700'
                    }`}
                  >
                    Course
                  </span>
                </div>
                <p
                  className={`text-xs leading-relaxed ${
                    type === 'course' ? 'text-indigo-500' : 'text-slate-400'
                  }`}
                >
                  3–7 lessons · 20–40 min · comprehensive
                </p>
              </button>
            </div>
          </div>

          {/* Source mode */}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Source material</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSourceMode('describe')}
                className={`rounded-xl border-2 px-4 py-3 text-left transition ${
                  sourceMode === 'describe'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="size-4" />
                  Type a brief
                </div>
                <p className="mt-1 text-xs opacity-70">Use the 1000-character prompt below</p>
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('upload')}
                className={`rounded-xl border-2 px-4 py-3 text-left transition ${
                  sourceMode === 'upload'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="size-4" />
                  Upload source
                </div>
                <p className="mt-1 text-xs opacity-70">PDF, DOCX, text, images, or video</p>
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor="ai-description" className="text-sm font-medium text-slate-700">
                {sourceMode === 'upload' ? 'Additional guidance' : 'Description'}
              </label>
              <span
                className={`text-xs tabular-nums transition ${
                  description.length > MAX_DESC * 0.9
                    ? 'text-amber-500 font-medium'
                    : 'text-slate-400'
                }`}
              >
                {description.length} / {MAX_DESC}
              </span>
            </div>
            <textarea
              id="ai-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC))}
              placeholder={
                sourceMode === 'upload'
                  ? 'Optional: tell the AI what audience, tone, or emphasis to use with the uploaded source.'
                  : 'Describe the topic, target audience, tone, and any specific points you want covered. The more detail you provide, the better the output.'
              }
              required={sourceMode === 'describe'}
              rows={6}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            />
          </div>

          {sourceMode === 'upload' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Upload document or media
              </label>
              {sourceFile ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-indigo-600 shadow-sm">
                      <FileText className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{sourceFile.name}</p>
                      <p className="text-xs text-slate-500">
                        {(sourceFile.size / 1024 / 1024).toFixed(2)} MB · ready to use
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void clearSourceFile()}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-red-500"
                    aria-label="Remove source file"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => !uploadingSource && sourceInputRef.current?.click()}
                  onKeyDown={(e) => e.key === 'Enter' && sourceInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOverSource(true); }}
                  onDragLeave={() => setDragOverSource(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverSource(false);
                    const file = e.dataTransfer.files[0];
                    if (file) void handleSourceFile(file);
                  }}
                  className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 text-center transition-colors ${
                    dragOverSource
                      ? 'border-indigo-400 bg-indigo-50'
                      : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'
                  }`}
                >
                  {uploadingSource ? (
                    <Loader2 className="size-6 animate-spin text-indigo-500" />
                  ) : (
                    <>
                      <div className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                        <Upload className="size-5 text-slate-400" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        {dragOverSource ? 'Drop source file' : 'Click or drag a source file'}
                      </p>
                      <p className="max-w-md text-xs leading-5 text-slate-400">
                        PDF, DOCX, TXT, Markdown, CSV, JSON, image, or video up to 25 MB.
                        DOCX images/videos are imported as module assets when possible.
                      </p>
                    </>
                  )}
                  <input
                    ref={sourceInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.csv,.json,image/*,video/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleSourceFile(file);
                      e.target.value = '';
                    }}
                  />
                </div>
              )}
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Scanned PDFs and legacy .doc files may need OCR or conversion to DOCX before the AI can read their text.
              </p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-40 transition"
          >
            {step === 'error' ? (
              <>
                <Sparkles className="size-4" />
                Try again
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Generate module
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-400">
            Generation takes 15–30 seconds. The module will open automatically when ready.
          </p>
        </form>
      </main>
    </div>
  );
}

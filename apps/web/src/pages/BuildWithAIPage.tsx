import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { Sparkles, Loader2, BookOpen, Zap, FileText, Upload, X } from 'lucide-react';
import { PrismWorkspaceShell } from '../components/PrismWorkspaceShell';

type ModuleType = 'microLearning' | 'course';
type Step = 'form' | 'generating' | 'error';
type SourceMode = 'describe' | 'upload';

type UploadedSourceFile = {
  storageId: string;
  name: string;
  type: string;
  size: number;
  extractedText?: string;
};

const GENERATING_MESSAGES = [
  'Thinking about your content…',
  'Structuring lessons…',
  'Creating lesson visuals…',
  'Writing explanations…',
  'Adding interactive questions…',
  'Polishing the module…',
];

async function extractPdfText(file: File): Promise<string> {
  const [pdfjsLib, pdfWorker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.mjs?url'),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages: string[] = [];
  const maxPages = Math.min(pdf.numPages, 80);

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) pages.push(pageText);
  }

  return pages.join('\n\n').slice(0, 18000);
}

export function BuildWithAIPage() {
  const { workspaceId } = useParams({ from: '/protected/w/$workspaceId/build-with-ai' });
  const wsId = workspaceId as Id<'workspaces'>;
  const navigate = useNavigate();
  const workspace = useQuery(api.workspaces.getById, { workspaceId: wsId });
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
      const extractedText = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
        ? await extractPdfText(file)
        : undefined;
      if ((file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) && !extractedText?.trim()) {
        setError('I could not extract readable text from this PDF. It may be scanned or image-only. Try a text-based PDF or convert it with OCR first.');
        setStep('error');
        return;
      }

      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!res.ok) throw new Error('Upload failed');
      const { storageId } = (await res.json()) as { storageId: string };

      if (sourceFile) await deleteFile({ storageId: sourceFile.storageId });
      setSourceFile({ storageId, name: file.name, type: file.type || 'application/octet-stream', size: file.size, extractedText });
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
        workspaceId: wsId,
        name: name.trim(),
        objective: objective.trim(),
        type,
        description: description.trim(),
        sourceFile: sourceMode === 'upload' && sourceFile ? {
          storageId: sourceFile.storageId,
          name: sourceFile.name,
          type: sourceFile.type,
          size: sourceFile.size,
        } : undefined,
        sourceText: sourceMode === 'upload' ? sourceFile?.extractedText : undefined,
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
      <div className="prism-brand-screen flex min-h-screen flex-col items-center justify-center px-6">
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
    <PrismWorkspaceShell
      workspaceId={workspaceId}
      workspaceName={workspace?.name ?? 'Workspace'}
      workspaceRole={workspace?.role}
      active="build"
      overline="AI-native learning intelligence"
      title="Generate a learning module"
      subtitle="Describe what you want to teach or upload a source document. Llama 3.3 generates a complete mobile-ready module with visuals, explanations, and interactions."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>

        {/* Error banner */}
        {step === 'error' && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[var(--semantic-danger)]">
            <span className="mt-0.5 shrink-0 text-base">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="widget space-y-6 p-6">
          {/* Module name */}
          <div>
            <label htmlFor="ai-name" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Module name
            </label>
            <input
              id="ai-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Introduction to Cybersecurity"
              required
              className="w-full rounded-xl border px-4 py-3 text-sm transition"
            />
          </div>

          {/* Learning objective */}
          <div>
            <label htmlFor="ai-objective" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Learning objective
            </label>
            <input
              id="ai-objective"
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Learners will identify phishing emails and avoid common attacks"
              required
              className="w-full rounded-xl border px-4 py-3 text-sm transition"
            />
          </div>

          {/* Type selector */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Module type</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('microLearning')}
                className={`group flex flex-col gap-1 rounded-xl border-2 px-4 py-4 text-left transition ${
                  type === 'microLearning'
                    ? 'border-[var(--ember-400)] bg-[rgba(13,140,99,0.12)]'
                    : 'border-[var(--border-primary)] bg-white/[0.02] hover:border-[rgba(16,179,125,0.28)] hover:bg-[var(--card-bg-hover)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Zap
                    className={`size-4 ${type === 'microLearning' ? 'text-[var(--ember-400)]' : 'text-[var(--text-muted)]'}`}
                  />
                  <span
                    className={`text-sm font-semibold ${
                      type === 'microLearning' ? 'text-[var(--ember-400)]' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    Micro-learning
                  </span>
                </div>
                <p
                  className={`text-xs leading-relaxed ${
                    type === 'microLearning' ? 'text-[var(--ember-300)]' : 'text-[var(--text-tertiary)]'
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
                    ? 'border-[var(--ember-400)] bg-[rgba(13,140,99,0.12)]'
                    : 'border-[var(--border-primary)] bg-white/[0.02] hover:border-[rgba(16,179,125,0.28)] hover:bg-[var(--card-bg-hover)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BookOpen
                    className={`size-4 ${type === 'course' ? 'text-[var(--ember-400)]' : 'text-[var(--text-muted)]'}`}
                  />
                  <span
                    className={`text-sm font-semibold ${
                      type === 'course' ? 'text-[var(--ember-400)]' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    Course
                  </span>
                </div>
                <p
                  className={`text-xs leading-relaxed ${
                    type === 'course' ? 'text-[var(--ember-300)]' : 'text-[var(--text-tertiary)]'
                  }`}
                >
                  3–7 lessons · 20–40 min · comprehensive
                </p>
              </button>
            </div>
          </div>

          {/* Source mode */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Source material</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSourceMode('describe')}
                className={`rounded-xl border-2 px-4 py-3 text-left transition ${
                  sourceMode === 'describe'
                    ? 'border-[var(--ember-400)] bg-[rgba(13,140,99,0.12)] text-[var(--ember-400)]'
                    : 'border-[var(--border-primary)] bg-white/[0.02] text-[var(--text-secondary)] hover:border-[rgba(16,179,125,0.28)]'
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
                    ? 'border-[var(--ember-400)] bg-[rgba(13,140,99,0.12)] text-[var(--ember-400)]'
                    : 'border-[var(--border-primary)] bg-white/[0.02] text-[var(--text-secondary)] hover:border-[rgba(16,179,125,0.28)]'
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
              <label htmlFor="ai-description" className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {sourceMode === 'upload' ? 'Additional guidance' : 'Description'}
              </label>
              <span
                className={`text-xs tabular-nums transition ${
                  description.length > MAX_DESC * 0.9
                    ? 'font-medium text-[var(--semantic-warning)]'
                    : 'text-[var(--text-muted)]'
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
              className="w-full resize-none rounded-xl border px-4 py-3 text-sm transition"
            />
          </div>

          {sourceMode === 'upload' && (
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Upload document or media
              </label>
              {sourceFile ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(16,179,125,0.24)] bg-[rgba(13,140,99,0.1)] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="prism-icon-tile flex size-10 shrink-0 items-center justify-center rounded-full">
                      <FileText className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{sourceFile.name}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {(sourceFile.size / 1024 / 1024).toFixed(2)} MB · {sourceFile.extractedText ? 'text extracted' : 'ready to use'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void clearSourceFile()}
                    className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--card-bg-hover)] hover:text-[var(--semantic-danger)]"
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
                      ? 'border-[var(--ember-400)] bg-[rgba(13,140,99,0.1)]'
                      : 'border-[var(--border-primary)] bg-white/[0.02] hover:border-[rgba(16,179,125,0.3)] hover:bg-[rgba(13,140,99,0.08)]'
                  }`}
                >
                  {uploadingSource ? (
                    <Loader2 className="size-6 animate-spin text-[var(--ember-400)]" />
                  ) : (
                    <>
                      <div className="prism-icon-tile flex size-11 items-center justify-center rounded-full">
                        <Upload className="size-5" />
                      </div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {dragOverSource ? 'Drop source file' : 'Click or drag a source file'}
                      </p>
                      <p className="max-w-md text-xs leading-5 text-[var(--text-tertiary)]">
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
              <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                Scanned PDFs and legacy .doc files may need OCR or conversion to DOCX before the AI can read their text.
              </p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="prism-action-primary flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
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

          <p className="text-center text-xs text-[var(--text-muted)]">
            Generation takes 15–30 seconds. The module will open automatically when ready.
          </p>
        </form>
        </div>

        <aside className="space-y-4">
          <div className="widget p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Input coverage</p>
            <div className="mt-4 space-y-3 text-xs text-[var(--text-tertiary)]">
              <div className="flex items-center justify-between"><span>PDF text extraction</span><span className="text-[var(--ember-400)]">Live</span></div>
              <div className="flex items-center justify-between"><span>DOCX parsing</span><span className="text-[var(--ember-400)]">Live</span></div>
              <div className="flex items-center justify-between"><span>Generated visuals</span><span className="text-[var(--ember-400)]">SVG</span></div>
              <div className="flex items-center justify-between"><span>SCORM target</span><span className="text-[var(--obsidian-50)] font-mono-value">1.2</span></div>
            </div>
          </div>
          <div className="glass p-5">
            <p className="text-overline mb-3">Generation model</p>
            <p className="font-mono-value text-2xl font-bold text-[var(--obsidian-50)]">Llama 3.3</p>
            <p className="mt-3 text-xs leading-6 text-[var(--text-tertiary)]">Source documents are extracted before upload generation so module content is grounded in the provided file instead of only the form prompt.</p>
          </div>
        </aside>
      </div>
    </PrismWorkspaceShell>
  );
}

import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import {
  Sparkles, Loader2, BookOpen, Zap, FileText,
  Upload, X, ChevronRight, ChevronLeft, ArrowRight,
  Check, PenLine, FolderOpen,
} from 'lucide-react';
import { PrismWorkspaceShell } from '../components/PrismWorkspaceShell';

type ModuleType = 'microLearning' | 'course';
type Step = 'form' | 'generating' | 'error';
type SourceMode = 'describe' | 'upload';
type WizardStep = 1 | 2 | 3;

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

const WIZARD_STEPS = [
  { id: 1, label: 'Basics' },
  { id: 2, label: 'Source' },
  { id: 3, label: 'Generate' },
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
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [error, setError] = useState('');
  const [statusIdx, setStatusIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);

  const MAX_DESC = 1000;

  const step1Complete = Boolean(name.trim() && objective.trim());
  const step2Complete = Boolean(
    sourceMode === 'describe' ? description.trim() : sourceFile,
  );
  const canSubmit = step1Complete && step2Complete;

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
    const isAllowed =
      allowed.includes(file.type) ||
      file.type.startsWith('image/') ||
      file.type.startsWith('video/') ||
      /\.(docx|pdf|txt|md|csv|json)$/i.test(file.name);
    const maxBytes = 25 * 1024 * 1024;

    if (!isAllowed) {
      setError('Upload PDF, DOCX, TXT, Markdown, CSV, JSON, image, or video files.');
      setStep('error');
      return;
    }
    if (file.size > maxBytes) {
      setError('Source files must be 25 MB or smaller.');
      setStep('error');
      return;
    }

    setUploadingSource(true);
    setError('');
    setStep('form');

    try {
      const extractedText =
        file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
          ? await extractPdfText(file)
          : undefined;
      if (
        (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) &&
        !extractedText?.trim()
      ) {
        setError(
          'I could not extract readable text from this PDF. It may be scanned or image-only. Try a text-based PDF or convert it with OCR first.',
        );
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
      setSourceFile({
        storageId,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        extractedText,
      });
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

  async function handleSubmit() {
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
        sourceFile:
          sourceMode === 'upload' && sourceFile
            ? {
                storageId: sourceFile.storageId,
                name: sourceFile.name,
                type: sourceFile.type,
                size: sourceFile.size,
              }
            : undefined,
        sourceText: sourceMode === 'upload' ? sourceFile?.extractedText : undefined,
      });

      void navigate({
        to: '/w/$workspaceId/m/$moduleId',
        params: { workspaceId, moduleId: moduleId as string },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStep('error');
      setWizardStep(3);
    }
  }

  // ── Generating screen ─────────────────────────────────────────────
  if (step === 'generating') {
    return (
      <div className="prism-brand-screen flex min-h-screen flex-col items-center justify-center px-6">
        <div className="w-full max-w-xs text-center">
          <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-[rgba(13,140,99,0.15)] animate-pulse" />
            <Sparkles className="relative size-9 text-[var(--ember-400)]" />
          </div>

          <h2 className="text-xl font-bold text-[var(--text-primary)]">Building your module</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)] transition-all duration-500">
            {GENERATING_MESSAGES[statusIdx]}
          </p>

          <div className="mt-8 flex items-center justify-center gap-2">
            {GENERATING_MESSAGES.map((_, i) => (
              <span
                key={i}
                className={`block h-1.5 rounded-full transition-all duration-500 ${
                  i === statusIdx
                    ? 'w-6 bg-[var(--ember-400)]'
                    : i < statusIdx
                    ? 'w-1.5 bg-[var(--ember-300)]'
                    : 'w-1.5 bg-[var(--border-subtle)]'
                }`}
              />
            ))}
          </div>

          <p className="mt-6 text-xs text-[var(--text-muted)]">
            Llama 3.3 is generating content — this usually takes 15–30 seconds.
          </p>
        </div>
      </div>
    );
  }

  // ── Step wizard ───────────────────────────────────────────────────
  return (
    <PrismWorkspaceShell
      workspaceId={workspaceId}
      workspaceName={workspace?.name ?? 'Workspace'}
      workspaceRole={workspace?.role}
      active="build"
      overline="AI-native learning builder"
      title="Generate a learning module"
      subtitle="Answer a few quick questions and Llama 3.3 will build a complete, themed module."
    >
      <div className="mx-auto max-w-2xl">

        {/* Step progress indicator */}
        <div className="mb-8 flex items-center gap-0">
          {WIZARD_STEPS.map((s, idx) => (
            <div key={s.id} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => {
                  // Only allow navigating to completed steps
                  if (s.id < wizardStep || (s.id === 2 && step1Complete) || (s.id === 3 && step1Complete && step2Complete)) {
                    setWizardStep(s.id as WizardStep);
                  }
                }}
                className="flex items-center gap-2 group"
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                    wizardStep === s.id
                      ? 'bg-[var(--ember-400)] text-white'
                      : s.id < wizardStep
                      ? 'bg-[rgba(13,140,99,0.15)] text-[var(--ember-400)]'
                      : 'bg-[var(--card-bg-hover)] text-[var(--text-muted)]'
                  }`}
                >
                  {s.id < wizardStep ? <Check className="size-3.5" /> : s.id}
                </span>
                <span
                  className={`text-sm font-medium transition ${
                    wizardStep === s.id
                      ? 'text-[var(--text-primary)]'
                      : s.id < wizardStep
                      ? 'text-[var(--ember-400)]'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  {s.label}
                </span>
              </button>
              {idx < WIZARD_STEPS.length - 1 && (
                <div className="mx-3 flex-1 border-t border-dashed border-[var(--border-subtle)]" />
              )}
            </div>
          ))}
        </div>

        {/* Error banner */}
        {step === 'error' && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[var(--semantic-danger)]">
            <span className="mt-0.5 shrink-0">⚠️</span>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setStep('form')}
              className="ml-auto shrink-0"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* ── Step 1: Basics ── */}
        {wizardStep === 1 && (
          <div className="widget p-6 space-y-5 animate-fadeInUp">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">What are you teaching?</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Give your module a name and a clear learning goal.</p>
            </div>

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
                autoFocus
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
                className="w-full rounded-xl border px-4 py-3 text-sm transition"
              />
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                A clear "learners will…" statement produces better content.
              </p>
            </div>

            {/* Module type */}
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Module type</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('microLearning')}
                  className={`flex flex-col gap-2 rounded-xl border-2 px-4 py-4 text-left transition ${
                    type === 'microLearning'
                      ? 'border-[var(--ember-400)] bg-[rgba(13,140,99,0.1)]'
                      : 'border-[var(--border-primary)] bg-white/[0.02] hover:border-[rgba(16,179,125,0.28)] hover:bg-[var(--card-bg-hover)]'
                  }`}
                >
                  <Zap
                    className={`size-5 ${type === 'microLearning' ? 'text-[var(--ember-400)]' : 'text-[var(--text-muted)]'}`}
                  />
                  <div>
                    <p className={`text-sm font-semibold ${type === 'microLearning' ? 'text-[var(--ember-400)]' : 'text-[var(--text-primary)]'}`}>
                      Micro-learning
                    </p>
                    <p className={`mt-0.5 text-xs ${type === 'microLearning' ? 'text-[var(--ember-300)]' : 'text-[var(--text-tertiary)]'}`}>
                      1–3 lessons · 5–10 min
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setType('course')}
                  className={`flex flex-col gap-2 rounded-xl border-2 px-4 py-4 text-left transition ${
                    type === 'course'
                      ? 'border-[var(--ember-400)] bg-[rgba(13,140,99,0.1)]'
                      : 'border-[var(--border-primary)] bg-white/[0.02] hover:border-[rgba(16,179,125,0.28)] hover:bg-[var(--card-bg-hover)]'
                  }`}
                >
                  <BookOpen
                    className={`size-5 ${type === 'course' ? 'text-[var(--ember-400)]' : 'text-[var(--text-muted)]'}`}
                  />
                  <div>
                    <p className={`text-sm font-semibold ${type === 'course' ? 'text-[var(--ember-400)]' : 'text-[var(--text-primary)]'}`}>
                      Full course
                    </p>
                    <p className={`mt-0.5 text-xs ${type === 'course' ? 'text-[var(--ember-300)]' : 'text-[var(--text-tertiary)]'}`}>
                      3–7 lessons · 20–40 min
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={!step1Complete}
                onClick={() => setWizardStep(2)}
                className="prism-action-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-40"
              >
                Next: Source material
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Source ── */}
        {wizardStep === 2 && (
          <div className="widget p-6 space-y-5 animate-fadeInUp">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Where's the source material?</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Describe the topic yourself, or upload a document for the AI to extract from.</p>
            </div>

            {/* Mode selector */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSourceMode('describe')}
                className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition ${
                  sourceMode === 'describe'
                    ? 'border-[var(--ember-400)] bg-[rgba(13,140,99,0.1)]'
                    : 'border-[var(--border-primary)] bg-white/[0.02] hover:border-[rgba(16,179,125,0.28)] hover:bg-[var(--card-bg-hover)]'
                }`}
              >
                <PenLine className={`mt-0.5 size-4 shrink-0 ${sourceMode === 'describe' ? 'text-[var(--ember-400)]' : 'text-[var(--text-muted)]'}`} />
                <div>
                  <p className={`text-sm font-semibold ${sourceMode === 'describe' ? 'text-[var(--ember-400)]' : 'text-[var(--text-primary)]'}`}>
                    Write a brief
                  </p>
                  <p className={`mt-0.5 text-xs ${sourceMode === 'describe' ? 'text-[var(--ember-300)]' : 'text-[var(--text-tertiary)]'}`}>
                    Describe in your own words
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('upload')}
                className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition ${
                  sourceMode === 'upload'
                    ? 'border-[var(--ember-400)] bg-[rgba(13,140,99,0.1)]'
                    : 'border-[var(--border-primary)] bg-white/[0.02] hover:border-[rgba(16,179,125,0.28)] hover:bg-[var(--card-bg-hover)]'
                }`}
              >
                <FolderOpen className={`mt-0.5 size-4 shrink-0 ${sourceMode === 'upload' ? 'text-[var(--ember-400)]' : 'text-[var(--text-muted)]'}`} />
                <div>
                  <p className={`text-sm font-semibold ${sourceMode === 'upload' ? 'text-[var(--ember-400)]' : 'text-[var(--text-primary)]'}`}>
                    Upload a file
                  </p>
                  <p className={`mt-0.5 text-xs ${sourceMode === 'upload' ? 'text-[var(--ember-300)]' : 'text-[var(--text-tertiary)]'}`}>
                    PDF, DOCX, TXT, images…
                  </p>
                </div>
              </button>
            </div>

            {/* Description */}
            {sourceMode === 'describe' && (
              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <label htmlFor="ai-description" className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Describe the topic
                  </label>
                  <span className={`text-xs tabular-nums ${description.length > MAX_DESC * 0.9 ? 'font-medium text-[var(--semantic-warning)]' : 'text-[var(--text-muted)]'}`}>
                    {description.length} / {MAX_DESC}
                  </span>
                </div>
                <textarea
                  id="ai-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC))}
                  placeholder="Describe the topic, target audience, tone, and specific points to cover. More detail → better output."
                  rows={7}
                  autoFocus
                  className="w-full resize-none rounded-xl border px-4 py-3 text-sm transition"
                />
              </div>
            )}

            {/* Upload */}
            {sourceMode === 'upload' && (
              <div>
                {sourceFile ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(16,179,125,0.24)] bg-[rgba(13,140,99,0.1)] px-4 py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="prism-icon-tile flex size-10 shrink-0 items-center justify-center rounded-full">
                        <FileText className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{sourceFile.name}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {(sourceFile.size / 1024 / 1024).toFixed(2)} MB
                          {sourceFile.extractedText ? ' · text extracted' : ' · ready'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void clearSourceFile()}
                      className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--card-bg-hover)] hover:text-[var(--semantic-danger)]"
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
                    className={`flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 text-center transition-colors ${
                      dragOverSource
                        ? 'border-[var(--ember-400)] bg-[rgba(13,140,99,0.1)]'
                        : 'border-[var(--border-primary)] bg-white/[0.02] hover:border-[rgba(16,179,125,0.3)] hover:bg-[rgba(13,140,99,0.06)]'
                    }`}
                  >
                    {uploadingSource ? (
                      <>
                        <Loader2 className="size-7 animate-spin text-[var(--ember-400)]" />
                        <p className="text-sm text-[var(--text-muted)]">Uploading…</p>
                      </>
                    ) : (
                      <>
                        <div className="prism-icon-tile flex size-12 items-center justify-center rounded-full">
                          <Upload className="size-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {dragOverSource ? 'Drop file here' : 'Click or drag to upload'}
                          </p>
                          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                            PDF, DOCX, TXT, MD, CSV, JSON, image, or video · max 25 MB
                          </p>
                        </div>
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

                {/* Optional guidance when a file is uploaded */}
                {sourceFile && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <label htmlFor="ai-guidance" className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        Additional guidance <span className="font-normal normal-case tracking-normal opacity-60">(optional)</span>
                      </label>
                      <span className={`text-xs tabular-nums ${description.length > MAX_DESC * 0.9 ? 'font-medium text-[var(--semantic-warning)]' : 'text-[var(--text-muted)]'}`}>
                        {description.length} / {MAX_DESC}
                      </span>
                    </div>
                    <textarea
                      id="ai-guidance"
                      value={description}
                      onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC))}
                      placeholder="Tell the AI what audience, tone, or emphasis to apply when using this file."
                      rows={4}
                      className="w-full resize-none rounded-xl border px-4 py-3 text-sm transition"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-[var(--border-default)]"
              >
                <ChevronLeft className="size-4" /> Back
              </button>
              <button
                type="button"
                disabled={!step2Complete}
                onClick={() => setWizardStep(3)}
                className="prism-action-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-40"
              >
                Review & generate
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Review & Generate ── */}
        {wizardStep === 3 && (
          <div className="space-y-4 animate-fadeInUp">
            {/* Summary card */}
            <div className="widget divide-y divide-[var(--border-subtle)] overflow-hidden">
              <div className="px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Ready to generate</p>
                <p className="mt-1 text-base font-bold text-[var(--text-primary)]">{name}</p>
              </div>

              <div className="grid grid-cols-2 divide-x divide-[var(--border-subtle)]">
                <div className="px-5 py-4">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Objective</p>
                  <p className="text-sm text-[var(--text-secondary)]">{objective}</p>
                </div>
                <div className="px-5 py-4">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Type</p>
                  <p className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                    {type === 'microLearning' ? <Zap className="size-3.5 text-[var(--ember-400)]" /> : <BookOpen className="size-3.5 text-[var(--ember-400)]" />}
                    {type === 'microLearning' ? 'Micro-learning' : 'Full course'}
                  </p>
                </div>
              </div>

              <div className="px-5 py-4">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Source material</p>
                {sourceMode === 'upload' && sourceFile ? (
                  <p className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                    <FileText className="size-3.5 text-[var(--ember-400)]" />
                    {sourceFile.name}
                    {sourceFile.extractedText && <span className="text-xs text-[var(--text-muted)]"> text extracted</span>}
                  </p>
                ) : (
                  <p className="line-clamp-2 text-sm text-[var(--text-secondary)]">{description}</p>
                )}
              </div>
            </div>

            {/* Generate button */}
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
              className="prism-action-primary flex w-full items-center justify-center gap-2.5 rounded-xl py-4 text-base font-bold disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="size-5" />
              {step === 'error' ? 'Try again' : 'Generate module'}
              <ArrowRight className="size-4" />
            </button>

            <p className="text-center text-xs text-[var(--text-muted)]">
              Takes 15–30 seconds · Module opens automatically when ready
            </p>

            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-secondary)]"
              >
                <ChevronLeft className="size-4" /> Edit source material
              </button>
            </div>
          </div>
        )}
      </div>
    </PrismWorkspaceShell>
  );
}
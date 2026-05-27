import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from '@tanstack/react-router';
import { useAction } from 'convex/react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { Sparkles, ChevronLeft, Loader2, BookOpen, Zap } from 'lucide-react';

type ModuleType = 'microLearning' | 'course';
type Step = 'form' | 'generating' | 'error';

const GENERATING_MESSAGES = [
  'Thinking about your content…',
  'Structuring lessons…',
  'Writing explanations…',
  'Adding interactive questions…',
  'Polishing the module…',
];

export function BuildWithAIPage() {
  const { workspaceId } = useParams({ from: '/protected/w/$workspaceId/build-with-ai' });
  const navigate = useNavigate();
  const generateModule = useAction(api.ai.generateModule);

  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [type, setType] = useState<ModuleType>('microLearning');
  const [description, setDescription] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState('');
  const [statusIdx, setStatusIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const MAX_DESC = 1000;
  const canSubmit = name.trim() && objective.trim() && description.trim();

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
            Gemma 4 is generating content — this usually takes 15–30 seconds.
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
            Powered by Gemma 4
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Generate a learning module</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Describe what you want to teach and Gemma 4 will generate the full lesson
            structure, explanations, and interactive questions for you.
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

          {/* Description */}
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor="ai-description" className="text-sm font-medium text-slate-700">
                Description
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
              placeholder="Describe the topic, target audience, tone, and any specific points you want covered. The more detail you provide, the better the output."
              required
              rows={6}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            />
          </div>

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

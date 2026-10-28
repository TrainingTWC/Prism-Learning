import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from 'convex/react';
import { Link, useParams } from '@tanstack/react-router';
import { AlertTriangle, ArrowLeft, Check, Download, Loader2, RotateCcw, X } from 'lucide-react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import type { ExportOptions } from '../lib/scormExport';
import { formatTabTitle } from '../lib/editorNav';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { countIssues, runPreflight } from '../lib/preflight';
import {
  completionOptionsFromModule,
  completionPreviewCopy,
  scormFilename,
} from '../lib/exportData';
import type { CompletionState } from '../lib/exportData';
import { resolveWorkspaceTheme } from '../lib/workspaceTheme';
import { useScormExport } from '../lib/useScormExport';

type CopyKey = 'defaultTitle' | 'defaultBody' | 'passTitle' | 'passBody' | 'failTitle' | 'failBody';

const SCREENS: Array<{ id: CompletionState; label: string; title: CopyKey; body: CopyKey }> = [
  { id: 'pass', label: 'Pass', title: 'passTitle', body: 'passBody' },
  { id: 'fail', label: 'Fail', title: 'failTitle', body: 'failBody' },
  { id: 'none', label: 'No quiz', title: 'defaultTitle', body: 'defaultBody' },
];

function SectionHeading({ n, children, right }: { n: number; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="flex size-7 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-white">
        {n}
      </span>
      <h2 className="text-[17px] font-semibold">{children}</h2>
      {right}
    </div>
  );
}

export function PublishPage() {
  const { workspaceId, moduleId } = useParams({ from: '/protected/w/$workspaceId/m/$moduleId/publish' });
  const wsId = workspaceId as Id<'workspaces'>;
  const modId = moduleId as Id<'modules'>;

  const content = useQuery(api.modules.getWithContent, { moduleId: modId });
  const blocksRaw = useQuery(api.blocks.listByModule, { moduleId: modId });
  const workspace = useQuery(api.workspaces.getById, { workspaceId: wsId });
  const { exporting, warnings, dismissWarnings, persistCompletionSettings, exportScorm } = useScormExport({
    moduleId: modId,
    workspaceId: wsId,
  });

  // Hydrate ONCE when the module first loads; later subscription ticks never
  // overwrite what the author is typing.
  const [options, setOptions] = useState<ExportOptions>({ passingScore: 80, completionCriteria: 'completed' });
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current || !content) return;
    hydrated.current = true;
    setOptions(completionOptionsFromModule(content.module));
  }, [content]);

  const [screen, setScreen] = useState<CompletionState>('pass');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lessons = useMemo(() => content?.lessons ?? [], [content]);
  const blocks = useMemo(() => blocksRaw ?? [], [blocksRaw]);
  const checks = useMemo(() => runPreflight(lessons, blocks), [lessons, blocks]);
  const issueTotal = countIssues(checks);
  const quizCount = useMemo(
    () => blocks.filter((b) => b.type === 'mcq' || b.type === 'trueFalse').length,
    [blocks],
  );

  const theme = useMemo(() => resolveWorkspaceTheme(workspace?.theme), [workspace]);
  const title = content?.module.title ?? '';
  useDocumentTitle(content ? formatTabTitle(['Publish', title]) : null);

  if (content === undefined || blocksRaw === undefined || workspace === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ground">
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );
  }
  if (content === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ground text-ink-2">Module not found</div>
    );
  }

  const active = SCREENS.find((s) => s.id === screen)!;
  const stock = completionPreviewCopy(title, undefined, screen);
  const live = completionPreviewCopy(title, options.completionCopy, screen);
  const sampleScore = screen === 'pass' ? '8/10' : screen === 'fail' ? '5/10' : null;
  const topBg = screen === 'fail' ? '#26143D' : theme.primary;
  const passes = options.completionCriteria === 'passed';
  const correctNeeded = Math.ceil((quizCount * options.passingScore) / 100);

  function setCopy(key: CopyKey, value: string) {
    setSaved(false);
    setOptions((o) => ({ ...o, completionCopy: { ...o.completionCopy, [key]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await persistCompletionSettings(options);
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  // Persist first, then export: keeps an exported module and its learner
  // preview in agreement.
  async function handleDownload() {
    setError(null);
    try {
      await persistCompletionSettings(options);
      await exportScorm(options);
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Export failed');
    }
  }

  const cardCls = 'rounded-[18px] border border-line bg-white p-6';
  const radioCard = (on: boolean) =>
    `flex flex-col items-start gap-1.5 rounded-[14px] p-4 text-left text-ink transition ${
      on ? 'border-2 border-brand bg-[#F8F2FD]' : 'border border-line bg-white hover:border-[#D4D4DC]'
    }`;

  return (
    <div className="flex h-screen flex-col bg-ground text-ink">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-2.5">
        <Link
          to="/w/$workspaceId/m/$moduleId"
          params={{ workspaceId, moduleId }}
          search={{}}
          className="flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-sm text-ink-2 hover:bg-hover hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Back to editing
        </Link>
        <span className="truncate text-[15px] font-semibold">Publish &ldquo;{title}&rdquo;</span>
        <div className="flex-1" />
        <Link
          to="/w/$workspaceId/m/$moduleId/outline"
          params={{ workspaceId, moduleId }}
          className="text-[13px] font-medium"
        >
          Outline
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap gap-7 px-10 pb-16 pt-8">
          <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
            {/* 1 Pre-flight */}
            <section className={cardCls}>
              <div className="mb-4">
                <SectionHeading
                  n={1}
                  right={
                    <span
                      className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ${
                        issueTotal === 0 ? 'bg-[#EAF6EF] text-[#1A7F4B]' : 'bg-[#FDF1E4] text-[#9A4A0B]'
                      }`}
                    >
                      {issueTotal === 0 ? 'All clear' : `${issueTotal} ${issueTotal === 1 ? 'warning' : 'warnings'}`}
                    </span>
                  }
                >
                  Pre-flight checks
                </SectionHeading>
              </div>
              <div className="flex flex-col">
                {checks.map((c) =>
                  c.ok ? (
                    <CheckRow key={c.id} ok text={c.label} />
                  ) : (
                    c.issues.map((issue, i) => (
                      <CheckRow
                        key={`${c.id}-${i}`}
                        ok={false}
                        text={issue.message}
                        fix={issue.lessonId ? { workspaceId, moduleId, lessonId: issue.lessonId } : undefined}
                      />
                    ))
                  ),
                )}
              </div>
            </section>

            {/* 2 Completion */}
            <section className={`${cardCls} flex flex-col gap-4`}>
              <SectionHeading n={2}>Completion &amp; scoring</SectionHeading>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
                <button
                  type="button"
                  onClick={() => {
                    setSaved(false);
                    setOptions((o) => ({ ...o, completionCriteria: 'completed' }));
                    setScreen('none');
                  }}
                  aria-pressed={!passes}
                  className={radioCard(!passes)}
                >
                  <span className="text-sm font-semibold">Learner reaches the end</span>
                  <span className="text-[13px] leading-snug text-ink-2">
                    Reports &ldquo;completed&rdquo; when the last lesson is opened.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSaved(false);
                    setOptions((o) => ({ ...o, completionCriteria: 'passed' }));
                    setScreen('pass');
                  }}
                  aria-pressed={passes}
                  className={radioCard(passes)}
                >
                  <span className="text-sm font-semibold">Learner passes the quiz</span>
                  <span className="text-[13px] leading-snug text-ink-2">
                    {quizCount > 0
                      ? `Reports “passed” or “failed” using all ${quizCount} scored ${quizCount === 1 ? 'question' : 'questions'}.`
                      : 'Reports “passed” or “failed”. Add quiz questions so there is something to score.'}
                  </span>
                </button>
              </div>
              <label className="flex max-w-xl flex-col gap-2 text-[13px] font-semibold text-ink-2">
                <span className="flex justify-between">
                  Pass mark
                  <span className="text-ink">
                    {options.passingScore}%{quizCount > 0 ? ` · ${correctNeeded} of ${quizCount} correct` : ''}
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={options.passingScore}
                  onChange={(e) => {
                    setSaved(false);
                    setOptions((o) => ({ ...o, passingScore: Number(e.target.value) }));
                  }}
                  className="accent-brand"
                />
                <span className="text-xs font-normal leading-relaxed text-ink-3">
                  This is the learner&apos;s end-of-module quiz result &mdash; correct answers &divide; total quiz
                  questions. Quiz questions never reveal right/wrong to the learner; only the final score does.
                </span>
              </label>
            </section>

            {/* 3 Completion screen */}
            <section className={`${cardCls} flex flex-col gap-4`}>
              <SectionHeading
                n={3}
                right={
                  <div role="tablist" className="ml-auto flex gap-1 rounded-[10px] bg-[#F3F3F6] p-[3px]">
                    {SCREENS.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        role="tab"
                        aria-selected={screen === s.id}
                        onClick={() => setScreen(s.id)}
                        className={`h-[30px] rounded-lg px-3 text-[13px] ${
                          screen === s.id ? 'bg-white font-semibold shadow-sm' : 'text-ink-2'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                }
              >
                Completion screen
              </SectionHeading>
              <p className="text-xs text-ink-3">
                Leave a field blank to keep the default copy shown as its placeholder.
              </p>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-2">
                Title
                <input
                  type="text"
                  value={options.completionCopy?.[active.title] ?? ''}
                  onChange={(e) => setCopy(active.title, e.target.value)}
                  placeholder={stock.title}
                  className="h-10 rounded-[10px] border border-line px-3 text-sm font-normal text-ink outline-none focus:border-brand"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-2">
                Message
                <textarea
                  rows={2}
                  value={options.completionCopy?.[active.body] ?? ''}
                  onChange={(e) => setCopy(active.body, e.target.value)}
                  placeholder={stock.body}
                  className="resize-none rounded-[10px] border border-line px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-brand"
                />
              </label>
            </section>
          </main>

          {/* Right: live preview + package */}
          <aside className="flex max-w-[420px] flex-[1_1_340px] flex-col gap-4">
            <div className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-2">Learner sees</div>
            <div className="overflow-hidden rounded-[18px] border border-line bg-white">
              <div
                className="flex flex-col items-center gap-3 px-6 py-8 text-center text-white"
                style={{ background: topBg, fontFamily: `'${theme.headingFont}', system-ui, sans-serif` }}
              >
                <span
                  className="flex size-16 items-center justify-center rounded-full border-[3px] border-white/30"
                  style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.primary})` }}
                >
                  {screen === 'fail' ? <RotateCcw className="size-7" /> : <Check className="size-7" strokeWidth={3} />}
                </span>
                <span className="text-2xl font-extrabold">{live.title}</span>
                {sampleScore && <span className="text-sm opacity-90">Your score: {sampleScore}</span>}
              </div>
              <div className="flex flex-col gap-4 px-6 pb-6 pt-5">
                <p className="m-0 whitespace-pre-wrap text-[15px] leading-relaxed text-[#4A3F58]">{live.body}</p>
                <span
                  className="flex h-11 items-center justify-center rounded-[10px] text-sm font-semibold text-white"
                  style={{ background: theme.primary }}
                >
                  Done
                </span>
              </div>
            </div>

            <section className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Package</span>
              </div>
              <div className="rounded-[10px] bg-[#F3F3F6] p-[3px]">
                <span className="flex h-8 items-center justify-center rounded-lg bg-white text-[13px] font-semibold shadow-sm">
                  SCORM 1.2
                </span>
              </div>
              <div className="break-all text-[13px] text-ink-2">{scormFilename(title)}</div>
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700" role="alert">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving || exporting}
                  onClick={() => void handleSave()}
                  className="flex h-[46px] items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-hover disabled:opacity-60"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4 text-[#1A7F4B]" /> : null}
                  {saved ? 'Saved' : 'Save settings'}
                </button>
                <button
                  type="button"
                  disabled={exporting || saving}
                  onClick={() => void handleDownload()}
                  className="flex h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-brand text-[15px] font-semibold text-white hover:bg-brand-ink disabled:opacity-60"
                >
                  {exporting ? <Loader2 className="size-[18px] animate-spin" /> : <Download className="size-[18px]" />}
                  {exporting ? 'Building…' : 'Download SCORM package'}
                </button>
              </div>
              <span className="text-xs leading-relaxed text-ink-3">
                Saves these settings with the module, so the next export and the learner preview match.
              </span>
            </section>
          </aside>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-amber-500/40 bg-white px-4 py-3 shadow-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div className="flex-1 text-sm text-ink">
              <p className="font-semibold">Export completed with warnings</p>
              <ul className="mt-1 list-disc pl-4 text-ink-2">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
            <button type="button" onClick={dismissWarnings} aria-label="Dismiss warnings" className="text-ink-3 hover:text-ink-2">
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckRow({
  ok,
  text,
  fix,
}: {
  ok: boolean;
  text: string;
  fix?: { workspaceId: string; moduleId: string; lessonId: string };
}) {
  return (
    <div className="flex items-center gap-3 border-t border-[#F0F0F3] py-[11px] text-sm first:border-t-0">
      <span
        className={`flex size-[22px] shrink-0 items-center justify-center rounded-full ${
          ok ? 'bg-[#EAF6EF] text-[#1A7F4B]' : 'bg-[#FDF1E4] text-[#9A4A0B]'
        }`}
      >
        {ok ? <Check className="size-[13px]" strokeWidth={3} /> : <span className="text-[13px] font-bold leading-none">!</span>}
      </span>
      <span className="flex-1">{text}</span>
      {fix && (
        <Link
          to="/w/$workspaceId/m/$moduleId"
          params={{ workspaceId: fix.workspaceId, moduleId: fix.moduleId }}
          search={{ lesson: fix.lessonId }}
          className="text-[13px] font-semibold"
        >
          Fix
        </Link>
      )}
    </div>
  );
}

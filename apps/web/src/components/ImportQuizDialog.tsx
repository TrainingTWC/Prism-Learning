import { useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import {
  X,
  Upload,
  Download,
  Loader2,
  ClipboardList,
  FileSpreadsheet,
  AlertTriangle,
  Check,
} from 'lucide-react';
import {
  parseQuizCsv,
  parsedQuestionToMcq,
  piQuestionToMcq,
  isConvertible,
  downloadSampleCsv,
  type ParsedQuestion,
  type PIQuestion,
} from '~/lib/quizCsv';

type Tab = 'checklist' | 'csv';

type PIProgram = {
  id: string;
  name: string;
  sections: Array<{ id: string; title: string; questions: PIQuestion[] }>;
};

export function ImportQuizDialog({
  workspaceId,
  moduleId,
  lessonId,
  onClose,
  onImported,
}: {
  workspaceId: Id<'workspaces'>;
  moduleId: Id<'modules'>;
  lessonId: Id<'lessons'>;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const listPrograms = useAction(api.analytics.listPIPrograms);
  const addMany = useMutation(api.blocks.addMany);

  const [tab, setTab] = useState<Tab>('checklist');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Checklist tab ──
  const [programs, setPrograms] = useState<PIProgram[] | null>(null);
  const [programId, setProgramId] = useState('');
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());

  // ── CSV tab ──
  const [csvQuestions, setCsvQuestions] = useState<ParsedQuestion[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvName, setCsvName] = useState('');

  const program = programs?.find((p) => p.id === programId) ?? null;

  async function loadPrograms() {
    setBusy(true);
    setError(null);
    try {
      const res = await listPrograms({ workspaceId });
      setPrograms(res);
      if (res.length > 0) {
        setProgramId(res[0]!.id);
        setSelectedSections(new Set(res[0]!.sections.map((s) => s.id)));
      }
    } catch (e: unknown) {
      const err = e as { data?: string; message?: string };
      setError(err.data ?? err.message ?? 'Could not load checklists from Prism Intelligence');
    } finally {
      setBusy(false);
    }
  }

  function selectProgram(id: string) {
    setProgramId(id);
    const p = programs?.find((x) => x.id === id);
    setSelectedSections(new Set(p?.sections.map((s) => s.id) ?? []));
  }

  function toggleSection(id: string) {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Questions that will actually be imported from the chosen sections
  const checklistPicked = (program?.sections ?? [])
    .filter((s) => selectedSections.has(s.id))
    .flatMap((s) => s.questions);
  const convertible = checklistPicked.filter(isConvertible);
  const skipped = checklistPicked.length - convertible.length;
  const reviewCount = convertible.map(piQuestionToMcq).filter((r) => r.needsReview).length;

  function handleFile(file: File) {
    setCsvName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const { questions, errors } = parseQuizCsv(String(reader.result ?? ''));
      setCsvQuestions(questions);
      setCsvErrors(errors);
    };
    reader.onerror = () => setError('Could not read that file');
    reader.readAsText(file);
  }

  async function handleImport() {
    setBusy(true);
    setError(null);
    try {
      const blocks =
        tab === 'checklist'
          ? convertible.map((q) => ({ type: 'mcq' as const, content: piQuestionToMcq(q).content }))
          : csvQuestions.map((q) => ({ type: 'mcq' as const, content: parsedQuestionToMcq(q) }));

      if (blocks.length === 0) {
        setError('Nothing to import.');
        return;
      }
      await addMany({ lessonId, moduleId, blocks });
      onImported(blocks.length);
      onClose();
    } catch (e: unknown) {
      const err = e as { data?: string; message?: string };
      setError(err.data ?? err.message ?? 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  const importCount = tab === 'checklist' ? convertible.length : csvQuestions.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-bold text-slate-800">Import quiz questions</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 px-5 pt-3">
          {(
            [
              { id: 'checklist' as const, label: 'From Intelligence', icon: ClipboardList },
              { id: 'csv' as const, label: 'From CSV', icon: FileSpreadsheet },
            ]
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setError(null);
                }}
                className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-semibold ${
                  tab === t.id
                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="size-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'checklist' ? (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-slate-500">
                Pull an audit checklist from Prism Intelligence and turn its questions into scored
                quiz blocks. Because the quiz then lives inside this module, results are reported to
                your LMS through SCORM — unlike an external guest link.
              </p>

              {!programs && (
                <button
                  type="button"
                  onClick={() => void loadPrograms()}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ClipboardList className="size-3.5" />}
                  Load checklists
                </button>
              )}

              {programs && programs.length === 0 && (
                <p className="text-xs text-slate-500">No checklists found for the linked company.</p>
              )}

              {programs && programs.length > 0 && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Checklist
                    </span>
                    <select
                      value={programId}
                      onChange={(e) => selectProgram(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none"
                    >
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div>
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Sections
                    </span>
                    <div className="space-y-1">
                      {(program?.sections ?? []).map((s) => {
                        const usable = s.questions.filter(isConvertible).length;
                        return (
                          <label
                            key={s.id}
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={selectedSections.has(s.id)}
                              onChange={() => toggleSection(s.id)}
                            />
                            <span className="flex-1 truncate text-slate-700">{s.title}</span>
                            <span className="text-[11px] text-slate-400">
                              {usable}/{s.questions.length} usable
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {skipped > 0 && (
                    <p className="flex items-start gap-1.5 text-[11px] text-amber-600">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                      {skipped} question{skipped === 1 ? '' : 's'} will be skipped — free-text
                      answers can't be auto-scored.
                    </p>
                  )}
                  {reviewCount > 0 && (
                    <p className="flex items-start gap-1.5 text-[11px] text-amber-600">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                      {reviewCount} question{reviewCount === 1 ? ' has' : 's have'} a guessed correct
                      answer — audit checklists don't record one. Review them after importing.
                    </p>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-indigo-300 hover:bg-indigo-50">
                  <Upload className="size-3.5" />
                  Choose CSV file
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = '';
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => downloadSampleCsv()}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <Download className="size-3.5" />
                  Download sample template
                </button>
              </div>

              {csvName && (
                <p className="text-[11px] text-slate-500">
                  {csvName} — {csvQuestions.length} question
                  {csvQuestions.length === 1 ? '' : 's'} ready
                </p>
              )}

              <div className="rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
                <p className="mb-1 font-semibold text-slate-600">Expected columns</p>
                <code className="block break-words text-[10px] text-slate-500">
                  question, optionA, optionB, optionC, optionD, optionE, optionF, correct, feedback,
                  multiSelect
                </code>
                <p className="mt-1.5">
                  <strong>correct</strong> takes the option letter(s) — <code>B</code>, or{' '}
                  <code>A,C</code> for multiple answers (which turns on multi-select
                  automatically). Only <code>question</code>, two options and{' '}
                  <code>correct</code> are required.
                </p>
              </div>

              {csvQuestions.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Preview
                  </span>
                  {csvQuestions.slice(0, 5).map((q, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 px-3 py-2">
                      <p className="text-xs font-medium text-slate-700">{q.question}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {q.options.map((o, j) => (
                          <span
                            key={j}
                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                              o.isCorrect
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {o.isCorrect && <Check className="mr-0.5 inline size-2.5" />}
                            {o.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {csvQuestions.length > 5 && (
                    <p className="text-[11px] text-slate-400">
                      …and {csvQuestions.length - 5} more
                    </p>
                  )}
                </div>
              )}

              {csvErrors.length > 0 && (
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
                    <AlertTriangle className="size-3" />
                    {csvErrors.length} row{csvErrors.length === 1 ? '' : 's'} skipped
                  </p>
                  <ul className="space-y-0.5">
                    {csvErrors.slice(0, 8).map((e, i) => (
                      <li key={i} className="text-[10px] text-amber-700">
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-slate-200 px-5 py-3">
          <span className="text-[11px] text-slate-500">
            {importCount > 0
              ? `${importCount} question${importCount === 1 ? '' : 's'} will be added to this lesson`
              : 'Nothing selected yet'}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={busy || importCount === 0}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

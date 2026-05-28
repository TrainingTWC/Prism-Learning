import { useState, useEffect } from 'react';
import type { Id } from '~convex/_generated/dataModel';
import { Type } from 'lucide-react';

type Payload = { template: string; answers: Record<string, string> };

function parse(c?: string): Payload | null { if (!c) return null; try { return JSON.parse(c) as Payload; } catch { return null; } }
function extractKeys(t: string): string[] {
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const ks = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) ks.add(m[1]!);
  return Array.from(ks);
}

export function FillBlanksBlockEditor({
  blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const initial = parse(initialContent);
  const [template, setTemplate] = useState(initial?.template ?? 'The capital of France is {{city}}.');
  const [answers, setAnswers] = useState<Record<string, string>>(initial?.answers ?? {});

  const keys = extractKeys(template);

  useEffect(() => {
    const trimmed: Record<string, string> = {};
    for (const k of keys) trimmed[k] = answers[k] ?? '';
    onSave(JSON.stringify({ template, answers: trimmed }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, answers]);

  return (
    <div className="rounded-2xl border-2 border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden">
      <div className="flex items-center justify-between border-b-2 border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          <Type className="size-4 text-orange-400" /> Fill in the Blanks
        </div>
        <span className="text-xs text-[var(--text-muted)]">{keys.length} blank{keys.length === 1 ? '' : 's'}</span>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Template — wrap blanks in <code className="rounded bg-orange-500/20 px-1.5 py-0.5 text-orange-300">{'{{key}}'}</code>
          </label>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-2 text-base text-[var(--text-primary)] outline-none focus:border-orange-400 font-mono resize-none"
            placeholder="e.g. The {{planet}} is the third planet from the {{star}}."
          />
        </div>
        {keys.length === 0 ? (
          <p className="rounded-lg bg-orange-500/10 px-3 py-2 text-center text-xs text-orange-300">No blanks detected — add <code>{'{{key}}'}</code> placeholders to your template</p>
        ) : (
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Correct Answers</span>
            <div className="grid grid-cols-2 gap-2">
              {keys.map((k) => (
                <div key={k} className="flex items-center gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2">
                  <code className="shrink-0 text-xs font-bold text-orange-400">{k}:</code>
                  <input
                    value={answers[k] ?? ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [k]: e.target.value }))}
                    placeholder="Answer"
                    className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

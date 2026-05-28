import { useState, useEffect } from 'react';
import type { Id } from '~convex/_generated/dataModel';
import { GitBranch, Plus, Trash2, Flag } from 'lucide-react';

type Choice = { id: string; label: string; nextNodeId: string | null };
type Node = { id: string; title: string; body: string; choices: Choice[]; isEnding: boolean };
type Payload = { startNodeId: string; nodes: Node[] };

function parse(c?: string): Payload | null { if (!c) return null; try { return JSON.parse(c) as Payload; } catch { return null; } }
function uid() { return Math.random().toString(36).slice(2, 9); }

function makeDefault(): Payload {
  const startId = uid();
  const endId = uid();
  return {
    startNodeId: startId,
    nodes: [
      { id: startId, title: 'Opening', body: 'You arrive at the scene…', isEnding: false, choices: [{ id: uid(), label: 'Take action', nextNodeId: endId }] },
      { id: endId, title: 'Ending', body: 'The scenario concludes.', isEnding: true, choices: [] },
    ],
  };
}

export function ScenarioBlockEditor({
  blockId,
  initialContent,
  onSave,
}: {
  blockId: Id<'blocks'>;
  initialContent?: string;
  onSave: (content: string) => void;
}) {
  const initial = parse(initialContent) ?? makeDefault();
  const [nodes, setNodes] = useState<Node[]>(initial.nodes);
  const [startNodeId, setStartNodeId] = useState(initial.startNodeId);
  const [activeId, setActiveId] = useState<string>(initial.startNodeId);

  useEffect(() => {
    onSave(JSON.stringify({ startNodeId, nodes }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startNodeId, nodes]);

  const active = nodes.find((n) => n.id === activeId) ?? nodes[0]!;

  function updateNode(id: string, patch: Partial<Node>) {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, ...patch } : n));
  }
  function addNode() {
    const id = uid();
    setNodes((ns) => [...ns, { id, title: `Node ${ns.length + 1}`, body: '', choices: [], isEnding: false }]);
    setActiveId(id);
  }
  function removeNode(id: string) {
    if (nodes.length <= 1) return;
    setNodes((ns) => ns.filter((n) => n.id !== id).map((n) => ({ ...n, choices: n.choices.map((c) => c.nextNodeId === id ? { ...c, nextNodeId: null } : c) })));
    if (startNodeId === id) setStartNodeId(nodes.find((n) => n.id !== id)!.id);
    if (activeId === id) setActiveId(nodes.find((n) => n.id !== id)!.id);
  }
  function addChoice(nodeId: string) {
    updateNode(nodeId, { choices: [...active.choices, { id: uid(), label: '', nextNodeId: null }] });
  }

  return (
    <div className="rounded-2xl border-2 border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden">
      <div className="flex items-center justify-between border-b-2 border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          <GitBranch className="size-4 text-emerald-400" /> Branching Scenario
        </div>
        <span className="text-xs text-[var(--text-muted)]">{nodes.length} nodes</span>
      </div>

      <div className="grid grid-cols-[240px_1fr]">
        {/* Node list */}
        <div className="border-r border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-3 space-y-1.5 max-h-[500px] overflow-y-auto">
          {nodes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setActiveId(n.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${activeId === n.id ? 'bg-emerald-500 text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--card-bg-hover)]'}`}
            >
              {startNodeId === n.id && <Flag className="size-3 shrink-0" />}
              {n.isEnding && <span className="shrink-0">🏁</span>}
              <span className="flex-1 truncate font-semibold">{n.title || '(untitled)'}</span>
              <span className="shrink-0 opacity-50">{n.choices.length}↗</span>
            </button>
          ))}
          <button type="button" onClick={addNode} className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[var(--border-primary)] py-2 text-xs font-semibold text-[var(--text-muted)] hover:border-emerald-400 hover:text-emerald-400">
            <Plus className="size-3.5" /> Add node
          </button>
        </div>

        {/* Node detail */}
        <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
          <div className="flex items-center gap-2">
            <input value={active.title} onChange={(e) => updateNode(active.id, { title: e.target.value })} placeholder="Node title" className="flex-1 rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-2 text-base font-bold text-[var(--text-primary)] outline-none focus:border-emerald-400" />
            <button type="button" onClick={() => setStartNodeId(active.id)} disabled={startNodeId === active.id} className={`flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-bold ${startNodeId === active.id ? 'bg-emerald-500 text-white' : 'border border-[var(--border-primary)] text-[var(--text-muted)] hover:border-emerald-400'}`}>
              <Flag className="size-3.5" /> Start
            </button>
            <button type="button" onClick={() => removeNode(active.id)} disabled={nodes.length <= 1} className="rounded-md p-2 text-red-400 hover:bg-red-500/10 disabled:opacity-30"><Trash2 className="size-4" /></button>
          </div>

          <textarea value={active.body} onChange={(e) => updateNode(active.id, { body: e.target.value })} placeholder="Scenario text…" rows={4} className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-400 resize-none" />

          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={active.isEnding} onChange={(e) => updateNode(active.id, { isEnding: e.target.checked, choices: e.target.checked ? [] : active.choices })} className="accent-emerald-500" />
            <span className="text-[var(--text-secondary)]">This is an ending node (no further choices)</span>
          </label>

          {!active.isEnding && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Choices</span>
                <button type="button" onClick={() => addChoice(active.id)} className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20"><Plus className="size-3" /> Add choice</button>
              </div>
              {active.choices.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-2">
                  <input value={c.label} onChange={(e) => updateNode(active.id, { choices: active.choices.map((x) => x.id === c.id ? { ...x, label: e.target.value } : x) })} placeholder="Choice label" className="flex-1 rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-400" />
                  <span className="text-xs text-[var(--text-muted)]">→</span>
                  <select value={c.nextNodeId ?? ''} onChange={(e) => updateNode(active.id, { choices: active.choices.map((x) => x.id === c.id ? { ...x, nextNodeId: e.target.value || null } : x) })} className="rounded-lg border border-[var(--border-primary)] bg-[var(--input-bg)] px-2 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-emerald-400">
                    <option value="">— pick next —</option>
                    {nodes.filter((n) => n.id !== active.id).map((n) => <option key={n.id} value={n.id}>{n.title || '(untitled)'}</option>)}
                  </select>
                  <button type="button" onClick={() => updateNode(active.id, { choices: active.choices.filter((x) => x.id !== c.id) })} className="rounded-md p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="size-3.5" /></button>
                </div>
              ))}
              {active.choices.length === 0 && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-300">No choices — learner will be stuck here. Add choices or mark as ending.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

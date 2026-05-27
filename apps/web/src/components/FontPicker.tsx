import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Monitor, Search } from 'lucide-react';

// ── Local Font Access API types (not yet in standard TS DOM lib) ──────────

declare global {
  interface Window {
    queryLocalFonts?: (options?: { postscriptNames?: string[] }) => Promise<FontData[]>;
  }
  interface FontData {
    family: string;
    fullName: string;
    postscriptName: string;
    style: string;
  }
}

// ── Curated fallback list ─────────────────────────────────────────────────
// Covers common Windows, macOS, and web-safe fonts.

const CURATED_FONTS = [
  // Sans-serif
  'Arial', 'Arial Black', 'Calibri', 'Candara', 'Century Gothic',
  'Franklin Gothic Medium', 'Gill Sans', 'Helvetica', 'Helvetica Neue',
  'Impact', 'Inter', 'Lucida Grande', 'Lucida Sans Unicode', 'Microsoft Sans Serif',
  'Montserrat', 'Nunito', 'Open Sans', 'Optima', 'Poppins', 'Raleway',
  'Roboto', 'Segoe UI', 'Source Sans Pro', 'Tahoma', 'Trebuchet MS',
  'Ubuntu', 'Verdana',
  // Serif
  'Cambria', 'Didot', 'Garamond', 'Georgia', 'Merriweather',
  'Palatino', 'Palatino Linotype', 'Playfair Display', 'Times New Roman',
  // Monospace
  'Cascadia Code', 'Consolas', 'Courier New', 'Fira Code', 'Inconsolata',
  'Lucida Console', 'Menlo', 'Monaco', 'SF Mono', 'Source Code Pro',
  // Cursive / Display
  'Brush Script MT', 'Comic Sans MS', 'Copperplate', 'Papyrus',
].sort();

// ── Hook ──────────────────────────────────────────────────────────────────

type FontLoadState = 'idle' | 'loading' | 'loaded' | 'denied' | 'unavailable';

export interface UseLocalFontsResult {
  fonts: string[];
  state: FontLoadState;
  requestFonts: () => Promise<void>;
}

export function useLocalFonts(): UseLocalFontsResult {
  const [fonts, setFonts] = useState<string[]>(CURATED_FONTS);
  const [state, setState] = useState<FontLoadState>(
    typeof window !== 'undefined' && window.queryLocalFonts ? 'idle' : 'unavailable',
  );

  const requestFonts = useCallback(async () => {
    if (!window.queryLocalFonts) {
      setState('unavailable');
      return;
    }
    setState('loading');
    try {
      const all = await window.queryLocalFonts();
      const families = [...new Set(all.map((f) => f.family))].sort();
      setFonts(families);
      setState('loaded');
    } catch {
      setState('denied');
    }
  }, []);

  // Auto-load if permission was already granted (best-effort)
  useEffect(() => {
    if (state !== 'idle') return;
    navigator.permissions
      // @ts-expect-error — "local-fonts" not in lib types yet
      ?.query({ name: 'local-fonts' })
      .then((status: { state: string }) => {
        if (status.state === 'granted') void requestFonts();
      })
      .catch(() => { /* permissions API unavailable */ });
  }, [state, requestFonts]);

  return { fonts, state, requestFonts };
}

// ── FontPicker component ──────────────────────────────────────────────────

interface FontPickerProps {
  label: string;
  value: string;
  onChange: (font: string) => void;
}

export function FontPicker({ label, value, onChange }: FontPickerProps) {
  const { fonts, state, requestFonts } = useLocalFonts();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query
    ? fonts.filter((f) => f.toLowerCase().includes(query.toLowerCase()))
    : fonts;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      <span className="text-xs font-medium text-slate-600">{label}</span>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
      >
        <span style={{ fontFamily: value }}>{value}</span>
        <ChevronDown className={`size-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl">
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="size-3.5 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search fonts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Load system fonts banner */}
          {state !== 'loaded' && state !== 'unavailable' && (
            <div className="border-b border-slate-100 px-3 py-2">
              <button
                type="button"
                onClick={() => void requestFonts()}
                disabled={state === 'loading'}
                className="flex w-full items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-left text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
              >
                <Monitor className="size-3.5 shrink-0" />
                {state === 'loading' ? 'Loading fonts…' : state === 'denied' ? 'Permission denied — showing common fonts' : 'Load all fonts installed on this computer'}
              </button>
            </div>
          )}
          {state === 'loaded' && (
            <div className="border-b border-slate-100 px-3 py-1.5">
              <span className="text-[10px] text-slate-400">{fonts.length} system fonts loaded</span>
            </div>
          )}

          {/* Font list */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-slate-400">No fonts match "{query}"</p>
            ) : (
              filtered.map((font) => (
                <button
                  key={font}
                  type="button"
                  onClick={() => { onChange(font); setOpen(false); setQuery(''); }}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                    font === value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                  }`}
                >
                  <span style={{ fontFamily: font }}>{font}</span>
                  {font === value && <span className="text-xs text-indigo-400">✓</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

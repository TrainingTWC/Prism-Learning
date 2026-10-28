import type { ReactNode } from 'react';
import { useMutation } from 'convex/react';
import type { BlockBackground, BlockSpacing, BlockStyle, BlockWidth, Theme } from '@prism/renderer';
import { api } from '~convex/_generated/api';
import { catalogEntry } from './blockCatalog';
import type { EditorBlock } from './types';

interface BlockSettingsProps {
  block: EditorBlock;
  theme: Theme;
  /** Persist new block content (layout options) and re-mount the uncontrolled editor. */
  onUpdateContent: (blockId: EditorBlock['_id'], content: string) => Promise<void>;
  /** Wraps a save promise so the top bar can show "Saving…". */
  track: <T>(p: Promise<T>) => Promise<T>;
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; swatch?: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-xs font-semibold text-ink-2">{label}</p>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1 rounded-[10px] bg-ground p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs ${
              value === o.value
                ? 'bg-white font-semibold text-brand-ink shadow-sm'
                : 'text-ink-2 hover:bg-hover'
            }`}
          >
            {o.swatch}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function parseObject(content?: string): Record<string, unknown> {
  if (!content) return {};
  try {
    const p: unknown = JSON.parse(content);
    return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const LAYOUT_DEFAULTS: Record<string, Record<string, unknown>> = {
  callout: { variant: 'info', title: '', body: '' },
  button: { label: '', url: '', style: 'primary', align: 'left' },
  divider: { style: 'line', label: '' },
  gallery: { layout: 'carousel', items: [] },
};

const WIDTHS: { value: BlockWidth; label: string }[] = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'standard', label: 'Standard' },
  { value: 'wide', label: 'Wide' },
  { value: 'full', label: 'Full' },
];
const SPACINGS: { value: BlockSpacing | 'auto'; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'none', label: 'None' },
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
];

export function BlockSettings({ block, theme, onUpdateContent, track }: BlockSettingsProps) {
  const updateStyle = useMutation(api.blocks.updateStyle);

  const entry = catalogEntry(block.type);
  const Icon = entry?.icon;
  const style: BlockStyle = block.style ?? {};
  const width = style.width ?? 'standard';
  const background = style.background ?? 'none';
  const spacing: BlockSpacing | 'auto' = style.spacing ?? 'auto';

  function setStyle<K extends keyof BlockStyle>(field: K, value: BlockStyle[K]) {
    void track(updateStyle({ blockId: block._id, style: { ...block.style, [field]: value } }));
  }

  function setSpacing(value: BlockSpacing | 'auto') {
    if (value === 'auto') {
      // Rebuild the style without the spacing key (do not send undefined).
      const { spacing: _omit, ...rest } = block.style ?? {};
      void _omit;
      void track(updateStyle({ blockId: block._id, style: rest }));
    } else {
      setStyle('spacing', value);
    }
  }

  const layoutDefaults = LAYOUT_DEFAULTS[block.type];
  const payload = layoutDefaults ? { ...layoutDefaults, ...parseObject(block.content) } : {};

  function setLayout(field: string, value: string) {
    void track(onUpdateContent(block._id, JSON.stringify({ ...payload, [field]: value })));
  }

  function str(field: string): string {
    const v = payload[field];
    return typeof v === 'string' ? v : '';
  }

  const bgOptions: { value: BlockBackground; label: string; swatch?: ReactNode }[] = [
    { value: 'none', label: 'None', swatch: <Swatch color="#ffffff" /> },
    { value: 'tint', label: 'Tint', swatch: <Swatch color={`color-mix(in srgb, ${theme.primary} 8%, #ffffff)`} /> },
    { value: 'primary', label: 'Primary', swatch: <Swatch color={theme.primary} /> },
    { value: 'accent', label: 'Accent', swatch: <Swatch color={`color-mix(in srgb, ${theme.accent} 16%, #ffffff)`} /> },
    { value: 'dark', label: 'Dark', swatch: <Swatch color="#17171C" /> },
  ];

  return (
    <div className="font-sans text-ink">
      <div className="flex items-center gap-2.5 border-b border-line p-4">
        {Icon && (
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{entry?.label ?? block.type}</p>
          <p className="truncate text-xs text-ink-3">{entry?.description}</p>
        </div>
      </div>

      <div className="p-4">
        {layoutDefaults && (
          <>
            {block.type === 'callout' && (
              <Segmented
                label="Variant"
                value={str('variant') as 'info'}
                options={[
                  { value: 'info', label: 'Info' },
                  { value: 'warning', label: 'Warning' },
                  { value: 'success', label: 'Success' },
                  { value: 'tip', label: 'Tip' },
                ]}
                onChange={(v) => setLayout('variant', v)}
              />
            )}
            {block.type === 'button' && (
              <>
                <Segmented
                  label="Alignment"
                  value={str('align') as 'left'}
                  options={[
                    { value: 'left', label: 'Left' },
                    { value: 'center', label: 'Center' },
                    { value: 'right', label: 'Right' },
                  ]}
                  onChange={(v) => setLayout('align', v)}
                />
                <Segmented
                  label="Button style"
                  value={str('style') as 'primary'}
                  options={[
                    { value: 'primary', label: 'Primary' },
                    { value: 'outline', label: 'Outline' },
                    { value: 'ghost', label: 'Ghost' },
                  ]}
                  onChange={(v) => setLayout('style', v)}
                />
              </>
            )}
            {block.type === 'divider' && (
              <Segmented
                label="Divider style"
                value={str('style') as 'line'}
                options={[
                  { value: 'line', label: 'Line' },
                  { value: 'space', label: 'Space' },
                  { value: 'dots', label: 'Dots' },
                ]}
                onChange={(v) => setLayout('style', v)}
              />
            )}
            {block.type === 'gallery' && (
              <Segmented
                label="Gallery layout"
                value={str('layout') as 'carousel'}
                options={[
                  { value: 'carousel', label: 'Carousel' },
                  { value: 'grid', label: 'Grid' },
                ]}
                onChange={(v) => setLayout('layout', v)}
              />
            )}
          </>
        )}

        {layoutDefaults && (
          <p className="mb-2 border-t border-line pt-4 text-xs font-semibold uppercase tracking-[0.04em] text-ink-3">
            Style
          </p>
        )}
        <Segmented label="Content width" value={width} options={WIDTHS} onChange={(v) => setStyle('width', v)} />
        <Segmented label="Background" value={background} options={bgOptions} onChange={(v) => setStyle('background', v)} />
        <Segmented label="Spacing" value={spacing} options={SPACINGS} onChange={setSpacing} />
        <p className="text-xs text-ink-3">Styles come from your workspace theme.</p>
      </div>
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-3 shrink-0 rounded-full border border-black/15"
      style={{ background: color }}
    />
  );
}

import type { CSSProperties } from 'react';

/**
 * Per-block presentation style. Single source of truth for style -> CSS:
 * the renderer (React inline styles) and the SCORM exporter (CSS string) both
 * derive from the same ordered list of [cssProperty, value] pairs, so they can
 * never drift. All values come from fixed literal tables — no author string is
 * ever interpolated into CSS.
 */
export type BlockWidth = 'narrow' | 'standard' | 'wide' | 'full';
export type BlockBackground = 'none' | 'tint' | 'primary' | 'accent' | 'dark';
export type BlockSpacing = 'none' | 's' | 'm' | 'l';

export interface BlockStyle {
  width?: BlockWidth;
  background?: BlockBackground;
  spacing?: BlockSpacing;
}

type CssPair = readonly [string, string];

const SPACING_VALUE: Record<BlockSpacing, string> = {
  none: '0',
  s: '16px',
  m: '32px',
  l: '64px',
};

const BACKGROUND_VALUE: Record<Exclude<BlockBackground, 'none'>, string> = {
  tint: 'color-mix(in srgb, var(--prism-primary) 8%, #ffffff)',
  accent: 'color-mix(in srgb, var(--prism-accent) 16%, #ffffff)',
  primary: 'var(--prism-primary)',
  dark: '#17171C',
};

const BLEED_FULL = 'calc(var(--prism-block-bleed, 0px) * -1)';

/**
 * Resolved vertical spacing: explicit spacing (including 'none' = 0) wins; a
 * background without explicit spacing defaults to 'm'; otherwise undefined.
 */
function resolvedSpacing(style?: BlockStyle): string | undefined {
  if (!style) return undefined;
  if (style.spacing && style.spacing in SPACING_VALUE) return SPACING_VALUE[style.spacing];
  if (style.background && style.background in BACKGROUND_VALUE) return SPACING_VALUE.m;
  return undefined;
}

/** Ordered [cssProperty (kebab-case or custom prop), value] pairs. */
function blockStylePairs(style?: BlockStyle): CssPair[] {
  const pairs: CssPair[] = [];
  if (!style) return pairs;

  switch (style.width) {
    case 'narrow':
      pairs.push(['max-width', '30rem'], ['margin-left', 'auto'], ['margin-right', 'auto']);
      break;
    case 'wide':
    case 'full':
      pairs.push(['margin-left', BLEED_FULL], ['margin-right', BLEED_FULL]);
      break;
    default:
      break;
  }

  const full = style.width === 'full';
  const spacing = resolvedSpacing(style);
  const bg =
    style.background && style.background in BACKGROUND_VALUE
      ? (style.background as Exclude<BlockBackground, 'none'>)
      : undefined;

  if (bg) {
    const side = full ? 'var(--prism-block-bleed, 0px)' : '1.5rem';
    const vertical = spacing ?? SPACING_VALUE.m;
    pairs.push(
      ['background', BACKGROUND_VALUE[bg]],
      ['padding-top', vertical],
      ['padding-bottom', vertical],
      ['padding-left', side],
      ['padding-right', side],
      ['border-radius', full ? '0' : 'var(--prism-radius, 0.5rem)'],
    );
    if (bg === 'primary' || bg === 'dark') {
      pairs.push(
        ['color', '#ffffff'],
        ['--prism-heading-color', '#ffffff'],
        ['--prism-body-color', 'rgba(255,255,255,0.88)'],
        ['--prism-text', '#ffffff'],
        ['--prism-text-2', 'rgba(255,255,255,0.88)'],
        ['--prism-text-muted', 'rgba(255,255,255,0.72)'],
      );
    }
  } else {
    if (spacing !== undefined) {
      pairs.push(['padding-top', spacing], ['padding-bottom', spacing]);
    }
    if (full) pairs.push(['border-radius', '0']);
  }

  return pairs;
}

function camelize(prop: string): string {
  return prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function hasBlockStyle(style?: BlockStyle): boolean {
  return blockStylePairs(style).length > 0;
}

/** True when a vertical spacing is in effect (explicit, incl. none, or via background). */
export function hasBlockSpacing(style?: BlockStyle): boolean {
  return resolvedSpacing(style) !== undefined;
}

export function blockStyleToCss(style?: BlockStyle): CSSProperties {
  const out: Record<string, string> = {};
  for (const [prop, value] of blockStylePairs(style)) {
    out[prop.startsWith('--') ? prop : camelize(prop)] = value;
  }
  return out as CSSProperties;
}

export function blockStyleToCssString(style?: BlockStyle): string {
  return blockStylePairs(style)
    .map(([prop, value]) => `${prop}:${value};`)
    .join('');
}

/** React props for the marker attributes on a styled block wrapper. */
export function blockStyleAttrs(style?: BlockStyle): Record<string, string> {
  const out: Record<string, string> = {};
  if (hasBlockStyle(style)) out['data-prism-style'] = '';
  if (hasBlockSpacing(style)) out['data-prism-spacing'] = '';
  return out;
}

/** HTML attribute string equivalent of blockStyleAttrs (leading space, or ''). */
export function blockStyleAttrString(style?: BlockStyle): string {
  let out = '';
  if (hasBlockStyle(style)) out += ' data-prism-style';
  if (hasBlockSpacing(style)) out += ' data-prism-spacing';
  return out;
}

/** Shared base rules for styled blocks (canvas <style> and SCORM styles.css). */
export const BLOCK_STYLE_BASE_CSS =
  '[data-prism-style]{box-sizing:border-box}[data-prism-spacing]>*{margin-top:0!important;margin-bottom:0!important}';

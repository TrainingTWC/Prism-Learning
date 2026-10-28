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

const SPACING_VALUE: Record<'s' | 'm' | 'l', string> = {
  s: '0.75rem',
  m: '1.5rem',
  l: '3rem',
};

const BACKGROUND_VALUE: Record<Exclude<BlockBackground, 'none'>, string> = {
  tint: 'color-mix(in srgb, var(--prism-primary) 8%, #ffffff)',
  accent: 'color-mix(in srgb, var(--prism-accent) 16%, #ffffff)',
  primary: 'var(--prism-primary)',
  dark: '#17171C',
};

const BLEED_HALF = 'calc(var(--prism-block-bleed, 0px) * -0.5)';
const BLEED_FULL = 'calc(var(--prism-block-bleed, 0px) * -1)';

/** Ordered [cssProperty (kebab-case or custom prop), value] pairs. */
function blockStylePairs(style?: BlockStyle): CssPair[] {
  const pairs: CssPair[] = [];
  if (!style) return pairs;

  switch (style.width) {
    case 'narrow':
      pairs.push(['max-width', '36rem'], ['margin-left', 'auto'], ['margin-right', 'auto']);
      break;
    case 'wide':
      pairs.push(['margin-left', BLEED_HALF], ['margin-right', BLEED_HALF]);
      break;
    case 'full':
      pairs.push(['margin-left', BLEED_FULL], ['margin-right', BLEED_FULL]);
      break;
    default:
      break;
  }

  const spacing =
    style.spacing === 's' || style.spacing === 'm' || style.spacing === 'l'
      ? SPACING_VALUE[style.spacing]
      : undefined;
  const bg =
    style.background && style.background !== 'none' ? style.background : undefined;

  if (bg) {
    const vertical = spacing ?? '1.5rem';
    pairs.push(
      ['background', BACKGROUND_VALUE[bg]],
      ['padding-top', vertical],
      ['padding-bottom', vertical],
      ['padding-left', '1.5rem'],
      ['padding-right', '1.5rem'],
      ['border-radius', 'var(--prism-radius, 0.5rem)'],
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
  } else if (spacing) {
    pairs.push(['padding-top', spacing], ['padding-bottom', spacing]);
  }

  return pairs;
}

function camelize(prop: string): string {
  return prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function hasBlockStyle(style?: BlockStyle): boolean {
  return blockStylePairs(style).length > 0;
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

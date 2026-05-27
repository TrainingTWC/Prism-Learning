import type { Theme } from './types';

const headingSizeMap: Record<string, string> = {
  sm: '1.25rem',
  md: '1.5rem',
  lg: '1.875rem',
  xl: '2.25rem',
};

const bodySizeMap: Record<string, string> = {
  sm: '0.875rem',
  md: '1rem',
  lg: '1.125rem',
};

const lineHeightMap: Record<string, string> = {
  tight: '1.25',
  normal: '1.5',
  relaxed: '1.625',
  loose: '2',
};

const radiusMap: Record<string, string> = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
};

/**
 * Map a Theme to CSS custom-properties for inline `style`.
 * Single source of truth for theme → CSS, used by authoring preview AND SCORM export.
 */
export function tokensToCss(theme: Theme): React.CSSProperties {
  return {
    ['--prism-primary' as string]: theme.primary,
    ['--prism-accent' as string]: theme.accent,
    ['--prism-correct' as string]: theme.correct ?? '#16a34a',
    ['--prism-incorrect' as string]: theme.incorrect ?? '#dc2626',
    ['--prism-heading-color' as string]: theme.headingTextColor ?? '#1e293b',
    ['--prism-body-color' as string]: theme.bodyTextColor ?? '#475569',
    ['--prism-font-heading' as string]: theme.headingFont,
    ['--prism-font-body' as string]: theme.bodyFont,
    ['--prism-heading-size' as string]: headingSizeMap[theme.headingSize ?? 'lg'] ?? '1.875rem',
    ['--prism-heading-weight' as string]: theme.headingWeight ?? '700',
    ['--prism-body-size' as string]: bodySizeMap[theme.bodySize ?? 'md'] ?? '1rem',
    ['--prism-line-height' as string]: lineHeightMap[theme.lineHeight ?? 'relaxed'] ?? '1.625',
    ['--prism-radius' as string]: radiusMap[theme.borderRadius ?? 'md'] ?? '0.5rem',
  } as React.CSSProperties;
}

/** Produce a CSS string (for SCORM `<style>` tags) from the theme tokens. */
export function tokensToCssString(theme: Theme): string {
  const vars = tokensToCss(theme) as Record<string, string>;
  const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`);
  return `:root {\n${lines.join('\n')}\n}`;
}

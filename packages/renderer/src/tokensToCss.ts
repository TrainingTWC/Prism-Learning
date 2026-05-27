import type { Theme } from './types';

/**
 * Map a Theme to a CSS custom-property string suitable for inline `style`.
 * Single source of truth for theme → CSS — used by authoring preview AND
 * by the SCORM export (Phase 8 will inline this as `theme.css`).
 */
export function tokensToCss(theme: Theme): React.CSSProperties {
  return {
    // CSS custom properties are typed as string-indexed in React.CSSProperties.
    ['--prism-primary' as string]: theme.primary,
    ['--prism-accent' as string]: theme.accent,
    ['--prism-font-heading' as string]: theme.headingFont,
    ['--prism-font-body' as string]: theme.bodyFont,
  } as React.CSSProperties;
}

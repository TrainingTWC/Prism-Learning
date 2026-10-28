import type { Theme } from '@prism/renderer';
import type { ExportTheme } from './scormExport';

/**
 * Default workspace theme: Prism purple + amber accent.
 *
 * Note: workspaces that never saved a theme now render and export purple
 * instead of the old indigo fallback. This is an explicit product decision.
 */
export const DEFAULT_WORKSPACE_THEME: Theme = {
  primary: '#7B35C1',
  accent: '#E8A33D',
  headingFont: 'Inter',
  bodyFont: 'Inter',
};

/** Overlay a (possibly partial / missing) stored theme on the defaults. */
export function resolveWorkspaceTheme(t?: Partial<Theme> | null): Theme {
  const out: Record<string, unknown> = { ...DEFAULT_WORKSPACE_THEME };
  if (t) {
    for (const [key, value] of Object.entries(t)) {
      if (value !== undefined && value !== null) out[key] = value;
    }
  }
  return out as unknown as Theme;
}

/** The four fields the SCORM exporter / preview HTML needs. */
export function toExportTheme(t?: Partial<Theme> | null): ExportTheme {
  const r = resolveWorkspaceTheme(t);
  return {
    primary: r.primary,
    accent: r.accent,
    headingFont: r.headingFont,
    bodyFont: r.bodyFont,
  };
}

export const DEFAULT_TAB_TITLE = 'Prism Authoring';

export type EditorSearch = { lesson?: string };
export type PreviewSearch = { lesson?: string; returnTo?: string };

export function formatTabTitle(parts: ReadonlyArray<string | null | undefined>): string {
  const cleaned = parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter((p) => p.length > 0);
  return [...cleaned, DEFAULT_TAB_TITLE].join(' · ');
}

export function resolveLessonId<T extends string>(
  lessons: ReadonlyArray<{ _id: T }>,
  requested: string | null | undefined,
): T | null {
  if (lessons.length === 0) return null;
  const match = requested ? lessons.find((l) => l._id === requested) : undefined;
  return (match ?? lessons[0]!)._id;
}

export function resolveLessonIndex(
  lessons: ReadonlyArray<{ _id: string }>,
  requested: string | null | undefined,
): number {
  if (!requested) return 0;
  const idx = lessons.findIndex((l) => l._id === requested);
  return idx >= 0 ? idx : 0;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export function parseEditorSearch(search: Record<string, unknown>): EditorSearch {
  return { lesson: str(search.lesson) };
}

export function parsePreviewSearch(search: Record<string, unknown>): PreviewSearch {
  return { lesson: str(search.lesson), returnTo: str(search.returnTo) };
}

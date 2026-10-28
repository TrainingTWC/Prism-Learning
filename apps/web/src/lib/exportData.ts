import type { BlockStyle } from '@prism/renderer/block-style';
import type { CompletionCopy, ExportBlock, ExportModule, ExportOptions } from './scormExport';

interface ModuleLike {
  _id: string;
  title: string;
  completionSettings?: {
    passingScore?: number;
    completionCriteria?: 'completed' | 'passed';
    defaultTitle?: string;
    defaultBody?: string;
    passTitle?: string;
    passBody?: string;
    failTitle?: string;
    failBody?: string;
  } | null;
}

interface LessonLike {
  _id: string;
  title: string;
}

interface BlockLike {
  _id: string;
  lessonId: string;
  type: string;
  content?: string;
  style?: BlockStyle;
}

/** Group blocks by lesson (lesson order, block order preserved) into the exporter's shape. */
export function buildExportModule(
  module: ModuleLike,
  lessons: readonly LessonLike[],
  blocks: readonly BlockLike[],
  coverUrl?: string | null,
): ExportModule {
  const byLesson = new Map<string, ExportBlock[]>();
  for (const b of blocks) {
    const mapped: ExportBlock = { id: b._id, type: b.type, content: b.content ?? '' };
    if (b.style) mapped.style = b.style;
    const list = byLesson.get(b.lessonId);
    if (list) list.push(mapped);
    else byLesson.set(b.lessonId, [mapped]);
  }
  const out: ExportModule = {
    id: module._id,
    title: module.title,
    lessons: lessons.map((l) => ({ id: l._id, title: l.title, blocks: byLesson.get(l._id) ?? [] })),
  };
  if (coverUrl) out.coverUrl = coverUrl;
  return out;
}

/** Hydrate publish-page settings from the persisted module doc. */
export function completionOptionsFromModule(mod: Pick<ModuleLike, 'completionSettings'> | null | undefined): ExportOptions {
  const cs = mod?.completionSettings;
  return {
    passingScore: cs?.passingScore ?? 80,
    completionCriteria: cs?.completionCriteria ?? 'completed',
    completionCopy: {
      defaultTitle: cs?.defaultTitle,
      defaultBody: cs?.defaultBody,
      passTitle: cs?.passTitle,
      passBody: cs?.passBody,
      failTitle: cs?.failTitle,
      failBody: cs?.failBody,
    },
  };
}

export type CompletionState = 'pass' | 'fail' | 'none';

/** Title/body the learner sees: authored (trimmed) copy or the stock export strings. */
export function completionPreviewCopy(
  moduleTitle: string,
  copy: CompletionCopy | undefined,
  state: CompletionState,
): { title: string; body: string } {
  const clean = (s: string | undefined) => {
    const t = s?.trim();
    return t ? t : undefined;
  };
  if (state === 'pass') {
    return {
      title: clean(copy?.passTitle) ?? 'You passed!',
      body: clean(copy?.passBody) ?? `You met the required score for ${moduleTitle}. Nice work!`,
    };
  }
  if (state === 'fail') {
    return {
      title: clean(copy?.failTitle) ?? 'Not quite there yet',
      body:
        clean(copy?.failBody) ??
        `You didn't reach the required score for ${moduleTitle} this time. Review the material and try again.`,
    };
  }
  return {
    title: clean(copy?.defaultTitle) ?? 'You crushed it!',
    body:
      clean(copy?.defaultBody) ??
      `That's a wrap on ${moduleTitle}. Your progress has been saved. Keep it up!`,
  };
}

/** Same slug rule the old export dialog used. */
export function scormFilename(title: string): string {
  const slug = title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  return `${slug}_scorm12.zip`;
}

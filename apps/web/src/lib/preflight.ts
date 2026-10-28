/**
 * Lite pre-flight checks shown on the outline readiness card and the publish page.
 * Pure: takes plain lesson/block rows, parses block JSON defensively.
 */

export interface PreflightLesson {
  _id: string;
  title: string;
}

export interface PreflightBlock {
  _id: string;
  lessonId: string;
  type: string;
  content?: string;
}

export interface PreflightIssue {
  lessonId: string;
  lessonTitle: string;
  blockId?: string;
  message: string;
}

export interface PreflightCheck {
  id: 'content' | 'answers' | 'alt';
  label: string;
  ok: boolean;
  issues: PreflightIssue[];
}

function parse(content: string | undefined): Record<string, unknown> | null {
  if (!content) return null;
  try {
    const v: unknown = JSON.parse(content);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const blank = (v: unknown): boolean => typeof v !== 'string' || v.trim() === '';

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function runPreflight(
  lessons: readonly PreflightLesson[],
  blocks: readonly PreflightBlock[],
): PreflightCheck[] {
  const byLesson = new Map<string, PreflightBlock[]>();
  for (const b of blocks) {
    const list = byLesson.get(b.lessonId);
    if (list) list.push(b);
    else byLesson.set(b.lessonId, [b]);
  }

  // ── content ──
  const contentIssues: PreflightIssue[] = [];
  if (lessons.length === 0) {
    contentIssues.push({ lessonId: '', lessonTitle: '', message: 'Add at least one lesson' });
  }
  lessons.forEach((lesson, i) => {
    if ((byLesson.get(lesson._id) ?? []).length === 0) {
      contentIssues.push({
        lessonId: lesson._id,
        lessonTitle: lesson.title,
        message: `Lesson ${i + 1}: no content yet`,
      });
    }
  });
  const content: PreflightCheck = {
    id: 'content',
    label: `All ${lessons.length} ${plural(lessons.length, 'lesson has', 'lessons have')} content`,
    ok: contentIssues.length === 0,
    issues: contentIssues,
  };

  // ── answers ──
  const answerIssues: PreflightIssue[] = [];
  let scored = 0;
  lessons.forEach((lesson, li) => {
    let q = 0;
    for (const b of byLesson.get(lesson._id) ?? []) {
      if (b.type !== 'mcq' && b.type !== 'trueFalse') continue;
      q += 1;
      scored += 1;
      const p = parse(b.content);
      let valid = false;
      if (b.type === 'mcq') {
        const opts = p?.options;
        valid =
          Array.isArray(opts) &&
          opts.some((o) => !!o && typeof o === 'object' && (o as { isCorrect?: unknown }).isCorrect === true);
      } else {
        valid = typeof p?.correctAnswer === 'boolean';
      }
      if (!valid) {
        answerIssues.push({
          lessonId: lesson._id,
          lessonTitle: lesson.title,
          blockId: b._id,
          message: `Lesson ${li + 1}, question ${q} has no correct answer`,
        });
      }
    }
  });
  const answers: PreflightCheck = {
    id: 'answers',
    label:
      scored === 0
        ? 'No scored questions'
        : `${scored} scored ${plural(scored, 'question has', 'questions each have')} a correct answer`,
    ok: answerIssues.length === 0,
    issues: answerIssues,
  };

  // ── alt text ──
  const altIssues: PreflightIssue[] = [];
  lessons.forEach((lesson, li) => {
    let missing = 0;
    let firstBlock: string | undefined;
    for (const b of byLesson.get(lesson._id) ?? []) {
      const p = parse(b.content);
      if (!p) continue;
      let n = 0;
      if (b.type === 'image' || b.type === 'hotspots' || b.type === 'labeledGraphic') {
        if (typeof p.storageId === 'string' && p.storageId && blank(p.altText)) n = 1;
      } else if (b.type === 'gallery' && Array.isArray(p.items)) {
        for (const it of p.items) {
          const item = it as { storageId?: unknown; altText?: unknown } | null;
          if (item && typeof item.storageId === 'string' && item.storageId && blank(item.altText)) n += 1;
        }
      }
      if (n > 0) {
        missing += n;
        firstBlock ??= b._id;
      }
    }
    if (missing > 0) {
      altIssues.push({
        lessonId: lesson._id,
        lessonTitle: lesson.title,
        blockId: firstBlock,
        message: `Lesson ${li + 1}: ${missing} ${plural(missing, 'image', 'images')} missing alt text`,
      });
    }
  });
  const alt: PreflightCheck = {
    id: 'alt',
    label: 'Images have alt text',
    ok: altIssues.length === 0,
    issues: altIssues,
  };

  return [content, answers, alt];
}

/** Total number of failed issues across all checks. */
export function countIssues(checks: readonly PreflightCheck[]): number {
  return checks.reduce((n, c) => n + c.issues.length, 0);
}

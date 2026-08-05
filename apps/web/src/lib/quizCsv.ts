/**
 * CSV import for multiple-choice quiz blocks.
 *
 * Expected columns (header row required, case/space-insensitive):
 *   question, optionA…optionF, correct, feedback, multiSelect
 *
 * `correct` holds the letters of the correct option(s) — "B", or "A,C" for a
 * multi-answer question. `multiSelect` is inferred when more than one letter
 * is given, so the column is optional.
 */

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export type ParsedQuestion = {
  question: string;
  options: Array<{ text: string; isCorrect: boolean; feedback: string }>;
  multiSelect: boolean;
};

export type CsvParseResult = {
  questions: ParsedQuestion[];
  /** Human-readable problems, one per offending row */
  errors: string[];
};

/**
 * Minimal RFC-4180 CSV reader: handles quoted fields, embedded commas and
 * newlines, and "" escapes. Enough for spreadsheet exports; we deliberately
 * avoid pulling in a parser dependency for one import path.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  // Strip a UTF-8 BOM — Excel adds one and it corrupts the first header cell.
  const src = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      // Swallow the \n of a \r\n pair
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/[\s_-]/g, '');

export function parseQuizCsv(text: string): CsvParseResult {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (rows.length === 0) return { questions: [], errors: ['The file is empty.'] };

  const header = rows[0]!.map(normalizeHeader);
  const col = (name: string) => header.indexOf(normalizeHeader(name));

  const qIdx = col('question');
  if (qIdx === -1) {
    return {
      questions: [],
      errors: ['No "question" column found. Download the sample template for the expected format.'],
    };
  }

  const optIdx = OPTION_LETTERS.map((l) => col(`option${l}`));
  if (optIdx.every((i) => i === -1)) {
    return {
      questions: [],
      errors: ['No "optionA"…"optionF" columns found. Download the sample template.'],
    };
  }

  const correctIdx = col('correct');
  const feedbackIdx = col('feedback');
  const multiIdx = col('multiselect');

  const questions: ParsedQuestion[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    const cell = (i: number) => (i >= 0 && i < row.length ? (row[i] ?? '').trim() : '');
    const lineNo = r + 1; // 1-based, counting the header

    const question = cell(qIdx);
    if (!question) {
      errors.push(`Row ${lineNo}: skipped — no question text.`);
      continue;
    }

    const optionTexts = optIdx.map((i) => cell(i));
    const present = optionTexts
      .map((text, i) => ({ text, letter: OPTION_LETTERS[i]! }))
      .filter((o) => o.text !== '');

    if (present.length < 2) {
      errors.push(`Row ${lineNo}: skipped — needs at least 2 options.`);
      continue;
    }

    const correctLetters = new Set(
      cell(correctIdx)
        .split(/[,;/\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    );

    if (correctLetters.size === 0) {
      errors.push(`Row ${lineNo}: skipped — no correct answer given.`);
      continue;
    }

    const unknown = [...correctLetters].filter(
      (l) => !present.some((o) => o.letter === l),
    );
    if (unknown.length > 0) {
      errors.push(
        `Row ${lineNo}: skipped — "correct" refers to ${unknown.join(', ')}, which has no option text.`,
      );
      continue;
    }

    const feedback = cell(feedbackIdx);
    const multiRaw = cell(multiIdx).toLowerCase();
    const multiSelect =
      multiRaw === 'true' || multiRaw === 'yes' || multiRaw === '1'
        ? true
        : multiRaw === 'false' || multiRaw === 'no' || multiRaw === '0'
          ? false
          : correctLetters.size > 1; // infer when the column is absent/blank

    questions.push({
      question,
      options: present.map((o) => ({
        text: o.text,
        isCorrect: correctLetters.has(o.letter),
        // Attach the explanation to the correct option, matching how the
        // MCQ block shows per-option feedback.
        feedback: correctLetters.has(o.letter) ? feedback : '',
      })),
      multiSelect,
    });
  }

  if (questions.length === 0 && errors.length === 0) {
    errors.push('No usable rows found.');
  }

  return { questions, errors };
}

/** Serialize one CSV field, quoting only when necessary. */
function csvField(s: string) {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const SAMPLE_CSV_ROWS: string[][] = [
  ['question', 'optionA', 'optionB', 'optionC', 'optionD', 'correct', 'feedback', 'multiSelect'],
  [
    'What is the first step of the 5 Whys technique?',
    'Assign blame to a team member',
    'Clearly define the problem statement',
    'Implement a fix immediately',
    'Escalate to the area manager',
    'B',
    'You cannot ask "why" usefully until the problem is stated clearly.',
    'FALSE',
  ],
  [
    'Which of these make a goal SMART? (choose all that apply)',
    'Specific',
    'Speculative',
    'Measurable',
    'Motivational',
    'A,C',
    'SMART = Specific, Measurable, Achievable, Relevant, Time-bound.',
    'TRUE',
  ],
  [
    'A customer says their drink is wrong. What should the barista do first?',
    'Explain why the recipe is correct',
    'Apologise and offer to remake it',
    'Ask them to fill in a feedback form',
    'Call the store manager',
    'B',
    'Acknowledge and fix it first — recovery beats justification.',
    'FALSE',
  ],
];

export function buildSampleCsv(): string {
  return SAMPLE_CSV_ROWS.map((r) => r.map(csvField).join(',')).join('\r\n');
}

/** Trigger a browser download of the sample template. */
export function downloadSampleCsv(filename = 'prism-quiz-template.csv') {
  // Prefix a BOM so Excel opens the UTF-8 content with the right encoding.
  const blob = new Blob([`\uFEFF${buildSampleCsv()}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Prism Intelligence checklist → quiz conversion ────────────────────────

export type PIQuestion = {
  id: string;
  text: string;
  questionType: string;
  order?: number;
  weight?: number;
  options?: Array<{ label: string; value: string; score?: number }>;
};

/** Question types we can turn into a scored quiz block. */
export function isConvertible(q: PIQuestion): boolean {
  if (!q.text?.trim()) return false;
  if (q.questionType === 'TEXT') return false; // free text can't be auto-scored
  return (q.options?.length ?? 0) >= 2;
}

/**
 * Convert a PI checklist question into an MCQ payload.
 *
 * Audit checklists don't record a "correct" answer, so the correct option is a
 * best guess: the highest-scoring option when PI supplies per-option scores,
 * otherwise the affirmative/compliant answer. `needsReview` marks the ones an
 * author should confirm.
 */
export function piQuestionToMcq(q: PIQuestion): {
  content: string;
  needsReview: boolean;
} {
  const opts = (q.options ?? []).filter((o) => (o.label ?? '').trim() !== '');
  // "N/A" is never a meaningful quiz answer
  const usable = opts.filter((o) => !/^n\/?a$/i.test(o.label.trim()));
  const pool = usable.length >= 2 ? usable : opts;

  const scored = pool.filter((o) => typeof o.score === 'number');
  let correctIdx = -1;
  let needsReview = true;

  if (scored.length > 0) {
    const best = scored.reduce((a, b) => ((b.score ?? 0) > (a.score ?? 0) ? b : a));
    correctIdx = pool.indexOf(best);
    needsReview = false;
  } else {
    correctIdx = pool.findIndex((o) => /^(yes|compliant|pass|satisfactory)$/i.test(o.label.trim()));
    if (correctIdx === -1) correctIdx = 0;
  }

  const payload = {
    question: q.text.trim(),
    options: pool.map((o, i) => ({
      id: `opt-${i}`,
      text: o.label.trim(),
      isCorrect: i === correctIdx,
      feedback: '',
    })),
    multiSelect: false,
    showFeedback: true,
  };

  return { content: JSON.stringify(payload), needsReview };
}

/** Build an MCQ block payload from a parsed CSV row. */
export function parsedQuestionToMcq(q: ParsedQuestion): string {
  return JSON.stringify({
    question: q.question,
    options: q.options.map((o, i) => ({
      id: `opt-${i}`,
      text: o.text,
      isCorrect: o.isCorrect,
      feedback: o.feedback,
    })),
    multiSelect: q.multiSelect,
    showFeedback: true,
  });
}

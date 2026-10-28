import { describe, it, expect } from 'vitest';
import { runPreflight } from './preflight';

const lessons = [
  { _id: 'l1', title: 'One' },
  { _id: 'l2', title: 'Two' },
];

const mcq = (id: string, lessonId: string, correct: boolean) => ({
  _id: id,
  lessonId,
  type: 'mcq',
  content: JSON.stringify({
    question: 'q',
    options: [
      { id: 'a', text: 'A', isCorrect: correct },
      { id: 'b', text: 'B', isCorrect: false },
    ],
  }),
});

describe('runPreflight', () => {
  it('returns three checks in order', () => {
    const checks = runPreflight(lessons, [
      { _id: 'b1', lessonId: 'l1', type: 'richText', content: '<p>x</p>' },
      { _id: 'b2', lessonId: 'l2', type: 'richText', content: '<p>y</p>' },
    ]);
    expect(checks.map((c) => c.id)).toEqual(['content', 'answers', 'alt']);
    expect(checks[0]!.label).toBe('All 2 lessons have content');
    expect(checks.every((c) => c.ok)).toBe(true);
    expect(checks[1]!.label).toBe('No scored questions');
  });

  it('flags lessons with no blocks', () => {
    const checks = runPreflight(lessons, [{ _id: 'b1', lessonId: 'l1', type: 'richText' }]);
    expect(checks[0]!.ok).toBe(false);
    expect(checks[0]!.issues).toEqual([
      { lessonId: 'l2', lessonTitle: 'Two', message: 'Lesson 2: no content yet' },
    ]);
  });

  it('flags zero lessons', () => {
    const checks = runPreflight([], []);
    expect(checks[0]!.issues.map((i) => i.message)).toEqual(['Add at least one lesson']);
  });

  it('flags mcq without a correct option and numbers questions per lesson', () => {
    const checks = runPreflight(lessons, [
      mcq('q1', 'l1', true),
      mcq('q2', 'l1', false),
      { _id: 'q3', lessonId: 'l2', type: 'mcq', content: 'not json' },
      { _id: 'q4', lessonId: 'l2', type: 'mcq', content: '{"options":[]}' },
    ]);
    const answers = checks[1]!;
    expect(answers.ok).toBe(false);
    expect(answers.label).toBe('4 scored questions each have a correct answer');
    expect(answers.issues.map((i) => i.message)).toEqual([
      'Lesson 1, question 2 has no correct answer',
      'Lesson 2, question 1 has no correct answer',
      'Lesson 2, question 2 has no correct answer',
    ]);
    expect(answers.issues[0]!.blockId).toBe('q2');
  });

  it('counts mcq and trueFalse together and validates correctAnswer', () => {
    const checks = runPreflight(lessons, [
      mcq('q1', 'l1', true),
      { _id: 't1', lessonId: 'l1', type: 'trueFalse', content: '{"statement":"s","correctAnswer":false}' },
      { _id: 't2', lessonId: 'l1', type: 'trueFalse', content: '{"statement":"s"}' },
    ]);
    expect(checks[1]!.issues.map((i) => i.message)).toEqual(['Lesson 1, question 3 has no correct answer']);
  });

  it('flags images and gallery items without alt text, one issue per lesson', () => {
    const checks = runPreflight(lessons, [
      { _id: 'i1', lessonId: 'l1', type: 'image', content: '{"storageId":"s1","altText":"  "}' },
      { _id: 'i2', lessonId: 'l1', type: 'image', content: '{"storageId":"s2","altText":"ok"}' },
      { _id: 'i3', lessonId: 'l1', type: 'hotspots', content: '{"storageId":"s3"}' },
      {
        _id: 'g1',
        lessonId: 'l2',
        type: 'gallery',
        content: JSON.stringify({ items: [{ storageId: 's', altText: '' }, { storageId: 't', altText: 'x' }] }),
      },
      { _id: 'e1', lessonId: 'l2', type: 'image', content: '{"altText":""}' },
    ]);
    const alt = checks[2]!;
    expect(alt.ok).toBe(false);
    expect(alt.issues.map((i) => i.message)).toEqual([
      'Lesson 1: 2 images missing alt text',
      'Lesson 2: 1 image missing alt text',
    ]);
  });
});

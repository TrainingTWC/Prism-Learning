import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildPreviewHtml, buildScormPackage, type ExportModule, type ExportTheme } from './scormExport';

const theme: ExportTheme = {
  primary: '#4f46e5',
  accent: '#8b5cf6',
  headingFont: 'Inter',
  bodyFont: 'Inter',
};

function mcqBlock(id: string): ExportModule['lessons'][number]['blocks'][number] {
  return {
    id,
    type: 'mcq',
    content: JSON.stringify({
      question: 'What is 2 + 2?',
      options: [
        { id: 'o1', text: '4', isCorrect: true, feedback: 'ZZFEEDBACKZZ correct answer' },
        { id: 'o2', text: '5', isCorrect: false, feedback: 'ZZFEEDBACKZZ wrong answer' },
      ],
      multiSelect: false,
      showFeedback: true,
    }),
  };
}

function trueFalseBlock(id: string): ExportModule['lessons'][number]['blocks'][number] {
  return {
    id,
    type: 'trueFalse',
    content: JSON.stringify({
      statement: 'The sky is blue.',
      correctAnswer: true,
      trueFeedback: 'ZZFEEDBACKZZ true feedback',
      falseFeedback: 'ZZFEEDBACKZZ false feedback',
    }),
  };
}

function makeSingleLessonModule(): ExportModule {
  return {
    id: 'mod1',
    title: 'Test Module',
    lessons: [
      {
        id: 'l0',
        title: 'Lesson 1',
        blocks: [mcqBlock('b1'), trueFalseBlock('b2')],
      },
    ],
  };
}

function makeTwoLessonModule(): ExportModule {
  return {
    id: 'mod2',
    title: 'Two Lesson Module',
    lessons: [
      { id: 'l0', title: 'Lesson 1', blocks: [mcqBlock('b1')] },
      { id: 'l1', title: 'Lesson 2', blocks: [trueFalseBlock('b2')] },
    ],
  };
}

function makeNoQuizModule(): ExportModule {
  return {
    id: 'mod3',
    title: 'No Quiz Module',
    lessons: [
      {
        id: 'l0',
        title: 'Lesson 1',
        blocks: [{ id: 'b1', type: 'richText', content: '<p>Just some text.</p>' }],
      },
    ],
  };
}

describe('scormExport quiz rendering (no-reveal runtime)', () => {
  it('Test 1: emits no retry button or "Try again" text', () => {
    const mod = makeSingleLessonModule();
    const html = buildPreviewHtml(mod, 0, {}, theme);
    expect(html).not.toContain('prism-retry');
    expect(html).not.toContain('Try again');
  });

  it('Test 2: emits no per-option feedback markup or data attributes', () => {
    const mod = makeSingleLessonModule();
    const html = buildPreviewHtml(mod, 0, {}, theme);
    expect(html).not.toContain('prism-opt-feedback');
    expect(html).not.toContain('data-feedback=');
    expect(html).not.toContain('data-tf=');
    expect(html).not.toContain('data-ff=');
  });

  it('Test 3: emits no reveal copy or assessment-mode data attribute', () => {
    const mod = makeSingleLessonModule();
    const html = buildPreviewHtml(mod, 0, {}, theme);
    expect(html).not.toContain('Nailed it');
    expect(html).not.toContain('Not quite');
    expect(html).not.toContain('data-assessment');
  });

  it('Test 4: keeps the DOM contract needed for silent scoring', () => {
    const mod = makeSingleLessonModule();
    const html = buildPreviewHtml(mod, 0, {}, theme);
    expect(html).toContain('prism-submit');
    expect(html).toContain('prism-opt');
    expect(html).toContain('data-correct=');
    expect(html).toContain('prism-tf-btns');
  });

  it('Test 5: authored feedback strings never appear in the output', () => {
    const mod = makeSingleLessonModule();
    const html = buildPreviewHtml(mod, 0, {}, theme);
    expect(html).not.toContain('ZZFEEDBACKZZ');
  });
});

describe('scormExport module-wide quiz score', () => {
  it('Test 6: <body> carries data-quiz-total counted across ALL lessons', () => {
    const mod = makeTwoLessonModule();
    const html = buildPreviewHtml(mod, 0, {}, theme);
    expect(html).toContain('data-quiz-total="2"');
  });

  it('Test 7: preview output contains the score element hook', () => {
    const mod = makeTwoLessonModule();
    const html = buildPreviewHtml(mod, 0, {}, theme);
    expect(html).toContain('data-prism-score');
  });

  it('Test 8: exported lesson_0.html carries quiz-total/passing/criteria/score hook', async () => {
    const mod = makeTwoLessonModule();
    const result = await buildScormPackage(
      mod,
      theme,
      { passingScore: 80, completionCriteria: 'passed' },
      async () => '',
    );
    const zip = await JSZip.loadAsync(result.blob);
    const lesson0 = await zip.file('lesson_0.html')!.async('string');
    expect(lesson0).toContain('data-quiz-total="2"');
    expect(lesson0).toContain('data-passing="80"');
    expect(lesson0).toContain('data-criteria="passed"');
    expect(lesson0).toContain('data-prism-score');
  });

  it('Test 9: no reveal/retry/feedback markup anywhere in the exported package', async () => {
    const mod = makeTwoLessonModule();
    const result = await buildScormPackage(
      mod,
      theme,
      { passingScore: 80, completionCriteria: 'passed' },
      async () => '',
    );
    const zip = await JSZip.loadAsync(result.blob);
    const lesson0 = await zip.file('lesson_0.html')!.async('string');
    const lesson1 = await zip.file('lesson_1.html')!.async('string');
    const interactionJs = await zip.file('assets/interaction.js')!.async('string');
    for (const content of [lesson0, lesson1, interactionJs]) {
      expect(content).not.toContain('Try again');
      expect(content).not.toContain('Nailed it');
      expect(content).not.toContain('Not quite —');
      expect(content).not.toContain('prism-opt-feedback');
    }
  });

  it('Test 10: a module with zero quiz blocks emits data-quiz-total="0" and still builds', async () => {
    const mod = makeNoQuizModule();
    const html = buildPreviewHtml(mod, 0, {}, theme);
    expect(html).toContain('data-quiz-total="0"');

    const result = await buildScormPackage(
      mod,
      theme,
      { passingScore: 80, completionCriteria: 'completed' },
      async () => '',
    );
    const zip = await JSZip.loadAsync(result.blob);
    const lesson0 = await zip.file('lesson_0.html')!.async('string');
    expect(lesson0).toContain('data-quiz-total="0"');
  });
});

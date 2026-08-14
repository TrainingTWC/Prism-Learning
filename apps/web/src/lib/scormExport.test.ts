import { describe, it, expect } from 'vitest';
import { buildPreviewHtml, type ExportModule, type ExportTheme } from './scormExport';

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

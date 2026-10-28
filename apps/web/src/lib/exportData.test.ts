import { describe, it, expect } from 'vitest';
import {
  buildExportModule,
  completionOptionsFromModule,
  completionPreviewCopy,
  scormFilename,
} from './exportData';
import { presenceColor, PRESENCE_PALETTE, initials } from './presenceColor';

describe('buildExportModule', () => {
  const module = { _id: 'm1', title: 'Mod' };
  const lessons = [
    { _id: 'l1', title: 'One' },
    { _id: 'l2', title: 'Two' },
  ];
  const blocks = [
    { _id: 'b1', lessonId: 'l2', type: 'richText', content: '<p>x</p>' },
    { _id: 'b2', lessonId: 'l1', type: 'callout', content: '{}', style: { width: 'wide' as const } },
    { _id: 'b3', lessonId: 'l2', type: 'divider' },
  ];

  it('groups blocks by lesson in lesson order and keeps block order', () => {
    const out = buildExportModule(module, lessons, blocks);
    expect(out.lessons.map((l) => l.id)).toEqual(['l1', 'l2']);
    expect(out.lessons[0]!.blocks.map((b) => b.id)).toEqual(['b2']);
    expect(out.lessons[1]!.blocks.map((b) => b.id)).toEqual(['b1', 'b3']);
  });

  it('maps type, content and style; empty content becomes empty string', () => {
    const out = buildExportModule(module, lessons, blocks);
    expect(out.lessons[0]!.blocks[0]).toEqual({
      id: 'b2',
      type: 'callout',
      content: '{}',
      style: { width: 'wide' },
    });
    expect(out.lessons[1]!.blocks[1]).toEqual({ id: 'b3', type: 'divider', content: '' });
  });

  it('sets coverUrl only when provided', () => {
    expect('coverUrl' in buildExportModule(module, lessons, blocks)).toBe(false);
    expect('coverUrl' in buildExportModule(module, lessons, blocks, null)).toBe(false);
    expect(buildExportModule(module, lessons, blocks, 'https://x/y.webp').coverUrl).toBe('https://x/y.webp');
  });
});

describe('completionOptionsFromModule', () => {
  it('defaults to 80 / completed with empty copy', () => {
    const o = completionOptionsFromModule({});
    expect(o.passingScore).toBe(80);
    expect(o.completionCriteria).toBe('completed');
    expect(o.completionCopy?.passTitle).toBeUndefined();
  });

  it('hydrates persisted settings', () => {
    const o = completionOptionsFromModule({
      completionSettings: { passingScore: 65, completionCriteria: 'passed', passTitle: 'Yay', failBody: 'Nope' },
    });
    expect(o.passingScore).toBe(65);
    expect(o.completionCriteria).toBe('passed');
    expect(o.completionCopy).toMatchObject({ passTitle: 'Yay', failBody: 'Nope' });
  });
});

describe('completionPreviewCopy', () => {
  it('uses stock strings when nothing authored', () => {
    expect(completionPreviewCopy('Safety', undefined, 'pass')).toEqual({
      title: 'You passed!',
      body: 'You met the required score for Safety. Nice work!',
    });
    expect(completionPreviewCopy('Safety', {}, 'fail')).toEqual({
      title: 'Not quite there yet',
      body: "You didn't reach the required score for Safety this time. Review the material and try again.",
    });
    expect(completionPreviewCopy('Safety', {}, 'none')).toEqual({
      title: 'You crushed it!',
      body: "That's a wrap on Safety. Your progress has been saved. Keep it up!",
    });
  });

  it('prefers trimmed authored values and ignores blanks', () => {
    const copy = { passTitle: '  Great  ', passBody: '   ', defaultTitle: 'Done' };
    expect(completionPreviewCopy('M', copy, 'pass').title).toBe('Great');
    expect(completionPreviewCopy('M', copy, 'pass').body).toBe('You met the required score for M. Nice work!');
    expect(completionPreviewCopy('M', copy, 'none').title).toBe('Done');
  });
});

describe('scormFilename', () => {
  it('slugs like the old export dialog', () => {
    expect(scormFilename('My Module: Intro')).toBe('my_module_intro_scorm12.zip');
  });
});

describe('presenceColor', () => {
  it('is deterministic and within the palette', () => {
    expect(PRESENCE_PALETTE).toHaveLength(8);
    for (const id of ['a', 'user_123', 'zzzzzzzz', '']) {
      expect(presenceColor(id)).toBe(presenceColor(id));
      expect(PRESENCE_PALETTE).toContain(presenceColor(id));
    }
  });

  it('derives initials', () => {
    expect(initials('Priya Raman')).toBe('PR');
    expect(initials('amrit')).toBe('AM');
    expect(initials('jo@x.com')).toBe('JO');
    expect(initials('  ')).toBe('?');
  });
});

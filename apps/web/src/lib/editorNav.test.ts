import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TAB_TITLE,
  formatTabTitle,
  resolveLessonId,
  resolveLessonIndex,
  parseEditorSearch,
  parsePreviewSearch,
} from './editorNav';

describe('formatTabTitle', () => {
  it('formats a single part', () => {
    expect(formatTabTitle(['Safety Basics'])).toBe('Safety Basics · Prism Authoring');
  });
  it('formats multiple parts', () => {
    expect(formatTabTitle(['Preview', 'Safety Basics'])).toBe(
      'Preview · Safety Basics · Prism Authoring',
    );
  });
  it('drops blank and nullish parts', () => {
    expect(formatTabTitle([undefined, '  ', null])).toBe('Prism Authoring');
  });
  it('has default title', () => {
    expect(DEFAULT_TAB_TITLE).toBe('Prism Authoring');
  });
});

describe('resolveLessonId', () => {
  it('returns requested when present', () => {
    expect(resolveLessonId([{ _id: 'a' }, { _id: 'b' }], 'b')).toBe('b');
  });
  it('falls back to first for unknown', () => {
    expect(resolveLessonId([{ _id: 'a' }, { _id: 'b' }], 'zzz')).toBe('a');
  });
  it('falls back to first for undefined', () => {
    expect(resolveLessonId([{ _id: 'a' }], undefined)).toBe('a');
  });
  it('returns null for empty', () => {
    expect(resolveLessonId([], 'a')).toBeNull();
  });
});

describe('resolveLessonIndex', () => {
  const ls = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }];
  it('finds index', () => expect(resolveLessonIndex(ls, 'c')).toBe(2));
  it('unknown -> 0', () => expect(resolveLessonIndex(ls, 'x')).toBe(0));
  it('undefined -> 0', () => expect(resolveLessonIndex(ls, undefined)).toBe(0));
  it('empty -> 0', () => expect(resolveLessonIndex([], 'a')).toBe(0));
});

describe('parseEditorSearch', () => {
  it('keeps string', () => expect(parseEditorSearch({ lesson: 'abc' })).toEqual({ lesson: 'abc' }));
  it('drops non-string', () =>
    expect(parseEditorSearch({ lesson: 5 })).toEqual({ lesson: undefined }));
  it('drops empty', () => expect(parseEditorSearch({ lesson: '' })).toEqual({ lesson: undefined }));
});

describe('parsePreviewSearch', () => {
  it('keeps strings, drops junk', () =>
    expect(parsePreviewSearch({ lesson: 'x', returnTo: 'y', junk: 1 })).toEqual({
      lesson: 'x',
      returnTo: 'y',
    }));
  it('drops invalid', () =>
    expect(parsePreviewSearch({ lesson: 1, returnTo: '' })).toEqual({
      lesson: undefined,
      returnTo: undefined,
    }));
});

import { describe, it, expect } from 'vitest';
import {
  EDITOR_TO_RENDERER_TYPE,
  collectStorageIds,
  isBlockEmpty,
  toRendererBlock,
} from './rendererBlocks';
import { DEFAULT_WORKSPACE_THEME, resolveWorkspaceTheme, toExportTheme } from './workspaceTheme';

const EXPECTED: Record<string, string> = {
  richText: 'rich-text',
  image: 'image',
  video: 'video',
  lottie: 'lottie',
  mcq: 'mcq',
  trueFalse: 'true-false',
  accordion: 'accordion',
  quote: 'quote',
  callout: 'callout',
  divider: 'divider',
  flashcard: 'flashcard',
  process: 'process',
  tabs: 'tabs',
  button: 'button',
  customHtml: 'custom-html',
  hotspots: 'hotspots',
  gallery: 'gallery',
  compare: 'compare',
  audio: 'audio',
  labeledGraphic: 'labeled-graphic',
  matching: 'matching',
  sorting: 'sorting',
  fillBlanks: 'fill-blanks',
  revealCards: 'reveal-cards',
  scenario: 'scenario',
};

describe('toRendererBlock', () => {
  it('maps all 25 schema types', () => {
    expect(Object.keys(EXPECTED)).toHaveLength(25);
    expect(EDITOR_TO_RENDERER_TYPE).toEqual(EXPECTED);
    for (const [editor, renderer] of Object.entries(EXPECTED)) {
      expect(toRendererBlock({ _id: 'b1', type: editor, content: 'x' })?.type).toBe(renderer);
    }
  });

  it('uses _id, defaults content to empty string and passes style through', () => {
    const style = { width: 'narrow' as const };
    expect(toRendererBlock({ _id: 'abc', type: 'callout', style })).toEqual({
      id: 'abc',
      type: 'callout',
      content: '',
      style,
    });
    expect(toRendererBlock({ _id: 'abc', type: 'callout', content: '{}' })).not.toHaveProperty('style');
  });

  it('returns null for unknown types', () => {
    expect(toRendererBlock({ _id: 'a', type: 'nope' })).toBeNull();
  });
});

describe('collectStorageIds', () => {
  it('collects every referenced id, de-duplicated', () => {
    const blocks = [
      { type: 'image', content: JSON.stringify({ storageId: 's1' }) },
      { type: 'image', content: JSON.stringify({ storageId: 's1' }) },
      { type: 'video', content: JSON.stringify({ srcType: 'storage', src: 'v1' }) },
      { type: 'video', content: JSON.stringify({ srcType: 'embed', src: 'https://youtu.be/x' }) },
      { type: 'compare', content: JSON.stringify({ beforeStorageId: 'b1', afterStorageId: 'a1' }) },
      { type: 'gallery', content: JSON.stringify({ items: [{ storageId: 'g1' }, { storageId: 'g2' }] }) },
      {
        type: 'flashcard',
        content: JSON.stringify({
          cards: [
            {
              frontImageStorageId: 'f1',
              frontAudioStorageId: 'f2',
              backImageStorageId: 'f3',
              backAudioStorageId: 'f4',
              imageStorageId: 'f5',
              audioStorageId: 'f6',
            },
          ],
        }),
      },
      { type: 'tabs', content: JSON.stringify({ tabs: [{ imageStorageId: 't1', audioStorageId: 't2' }] }) },
      {
        type: 'accordion',
        content: JSON.stringify({ sections: [{ imageStorageId: 'c1', audioStorageId: 'c2' }] }),
      },
      { type: 'richText', content: '<p>not json</p>' },
      { type: 'divider' },
    ];
    expect(collectStorageIds(blocks).sort()).toEqual(
      ['s1', 'v1', 'b1', 'a1', 'g1', 'g2', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 't1', 't2', 'c1', 'c2'].sort(),
    );
  });

  it('returns an empty array when nothing is referenced', () => {
    expect(collectStorageIds([])).toEqual([]);
  });
});

describe('isBlockEmpty', () => {
  it('treats missing or empty content as empty', () => {
    expect(isBlockEmpty('mcq')).toBe(true);
    expect(isBlockEmpty('mcq', '')).toBe(true);
  });

  it('richText', () => {
    expect(isBlockEmpty('richText', '<p></p>')).toBe(true);
    expect(isBlockEmpty('richText', '<p>Hello</p>')).toBe(false);
  });

  it('media blocks need a storageId', () => {
    for (const type of ['image', 'hotspots', 'labeledGraphic', 'lottie', 'audio']) {
      expect(isBlockEmpty(type, JSON.stringify({ altText: 'x' }))).toBe(true);
      expect(isBlockEmpty(type, JSON.stringify({ storageId: 's' }))).toBe(false);
    }
  });

  it('video needs a src', () => {
    expect(isBlockEmpty('video', JSON.stringify({ src: '' }))).toBe(true);
    expect(isBlockEmpty('video', JSON.stringify({ src: 'https://x' }))).toBe(false);
  });

  it('gallery needs items', () => {
    expect(isBlockEmpty('gallery', JSON.stringify({ items: [] }))).toBe(true);
    expect(isBlockEmpty('gallery', JSON.stringify({ items: [{ storageId: 'a' }] }))).toBe(false);
  });

  it('compare needs at least one image id', () => {
    expect(isBlockEmpty('compare', JSON.stringify({}))).toBe(true);
    expect(isBlockEmpty('compare', JSON.stringify({ beforeStorageId: 'a' }))).toBe(false);
  });

  it('normal authored blocks are not empty', () => {
    expect(isBlockEmpty('mcq', JSON.stringify({ question: 'Q' }))).toBe(false);
    expect(isBlockEmpty('callout', JSON.stringify({ body: 'hi' }))).toBe(false);
  });
});

describe('workspaceTheme', () => {
  it('falls back to the purple default', () => {
    expect(resolveWorkspaceTheme(undefined)).toMatchObject({
      primary: '#7B35C1',
      accent: '#E8A33D',
      headingFont: 'Inter',
      bodyFont: 'Inter',
    });
    expect(resolveWorkspaceTheme(null)).toEqual(DEFAULT_WORKSPACE_THEME);
  });

  it('uses workspace values when present', () => {
    const full = {
      primary: '#111111',
      accent: '#222222',
      headingFont: 'Lora',
      bodyFont: 'Roboto',
      correct: '#00ff00',
      borderRadius: 'lg',
    };
    expect(resolveWorkspaceTheme(full)).toEqual(full);
  });

  it('ignores undefined values', () => {
    expect(resolveWorkspaceTheme({ primary: undefined, accent: '#333333' })).toMatchObject({
      primary: '#7B35C1',
      accent: '#333333',
    });
  });

  it('toExportTheme picks exactly four fields', () => {
    const out = toExportTheme({
      primary: '#111111',
      accent: '#222222',
      headingFont: 'Lora',
      bodyFont: 'Roboto',
      correct: '#00ff00',
    });
    expect(out).toEqual({
      primary: '#111111',
      accent: '#222222',
      headingFont: 'Lora',
      bodyFont: 'Roboto',
    });
    expect(toExportTheme(undefined).primary).toBe('#7B35C1');
  });
});

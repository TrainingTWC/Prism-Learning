import { describe, expect, it } from 'vitest';
import type { Id } from '~convex/_generated/dataModel';
import {
  BLOCK_CATALOG,
  CATEGORIES,
  QUICK_PICKS,
  filterCatalog,
  insertionAfterOrder,
} from './blockCatalog';

const bid = (s: string) => s as Id<'blocks'>;

describe('BLOCK_CATALOG', () => {
  it('has exactly the 24 editor block types (everything except revealCards)', () => {
    const types = BLOCK_CATALOG.map((e) => e.type).sort();
    expect(types).toEqual(
      [
        'richText', 'image', 'video', 'lottie', 'mcq', 'trueFalse', 'accordion', 'quote',
        'callout', 'divider', 'flashcard', 'process', 'tabs', 'button', 'customHtml',
        'hotspots', 'gallery', 'compare', 'audio', 'labeledGraphic', 'matching', 'sorting',
        'fillBlanks', 'scenario',
      ].sort(),
    );
    expect(BLOCK_CATALOG).toHaveLength(24);
    for (const e of BLOCK_CATALOG) {
      expect(e.label).toBeTruthy();
      expect(e.description).toBeTruthy();
      expect(e.icon).toBeTruthy();
      expect(e.category).toBeTruthy();
    }
  });

  it('orders the 7 categories and groups types correctly', () => {
    expect(CATEGORIES.map((c) => c.label)).toEqual([
      'Text', 'Media', 'Interactive', 'Knowledge check', 'Scenario', 'Structure', 'Advanced',
    ]);
    const byCat = (id: string) => BLOCK_CATALOG.filter((e) => e.category === id).map((e) => e.type);
    expect(byCat('text')).toEqual(['richText', 'quote', 'callout']);
    expect(byCat('media')).toEqual(['image', 'video', 'audio', 'lottie', 'gallery', 'compare']);
    expect(byCat('interactive')).toEqual([
      'flashcard', 'hotspots', 'labeledGraphic', 'matching', 'sorting', 'fillBlanks',
    ]);
    expect(byCat('knowledge')).toEqual(['mcq', 'trueFalse']);
    expect(byCat('scenario')).toEqual(['scenario']);
    expect(byCat('structure')).toEqual(['accordion', 'tabs', 'process', 'divider', 'button']);
    expect(byCat('advanced')).toEqual(['customHtml']);
  });
});

describe('filterCatalog', () => {
  it('returns everything for an empty query', () => {
    expect(filterCatalog('', 'all')).toHaveLength(24);
  });
  it('matches quiz / question to the knowledge-check blocks', () => {
    for (const q of ['quiz', 'question', 'QUIZ']) {
      const types = filterCatalog(q, 'all').map((e) => e.type);
      expect(types).toContain('mcq');
      expect(types).toContain('trueFalse');
    }
  });
  it('filters by category', () => {
    expect(filterCatalog('', 'media')).toHaveLength(6);
    expect(filterCatalog('image', 'knowledge')).toHaveLength(0);
  });
});

describe('QUICK_PICKS', () => {
  it('is Text, Image, Callout, Question', () => {
    expect(QUICK_PICKS).toEqual([
      { type: 'richText', label: 'Text' },
      { type: 'image', label: 'Image' },
      { type: 'callout', label: 'Callout' },
      { type: 'mcq', label: 'Question' },
    ]);
  });
});

describe('insertionAfterOrder', () => {
  const blocks = [
    { _id: bid('a'), order: 1000 },
    { _id: bid('b'), order: 2000 },
  ];
  it('end -> undefined', () => {
    expect(insertionAfterOrder(blocks, 'end')).toBeUndefined();
  });
  it('start -> first.order - 2000, undefined when empty', () => {
    expect(insertionAfterOrder(blocks, 'start')).toBe(-1000);
    expect(insertionAfterOrder([], 'start')).toBeUndefined();
  });
  it('afterBlockId -> that block order', () => {
    expect(insertionAfterOrder(blocks, { afterBlockId: bid('b') })).toBe(2000);
    expect(insertionAfterOrder(blocks, { afterBlockId: bid('a') })).toBe(1000);
  });
});

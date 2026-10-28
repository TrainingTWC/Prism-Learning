import { describe, it, expect } from 'vitest';
import {
  blockStyleToCss,
  blockStyleToCssString,
  hasBlockStyle,
  type BlockStyle,
} from '@prism/renderer/block-style';

const LIGHT_ON_DARK = {
  color: '#ffffff',
  '--prism-heading-color': '#ffffff',
  '--prism-body-color': 'rgba(255,255,255,0.88)',
  '--prism-text': '#ffffff',
  '--prism-text-2': 'rgba(255,255,255,0.88)',
  '--prism-text-muted': 'rgba(255,255,255,0.72)',
};

describe('blockStyle defaults', () => {
  const defaults: Array<BlockStyle | undefined> = [
    undefined,
    {},
    { width: 'standard', background: 'none', spacing: 'none' },
  ];

  it.each(defaults)('produces nothing for %j', (style) => {
    expect(blockStyleToCss(style)).toEqual({});
    expect(blockStyleToCssString(style)).toBe('');
    expect(hasBlockStyle(style)).toBe(false);
  });
});

describe('blockStyle width', () => {
  it('narrow', () => {
    expect(blockStyleToCss({ width: 'narrow' })).toEqual({
      maxWidth: '36rem',
      marginLeft: 'auto',
      marginRight: 'auto',
    });
    expect(blockStyleToCssString({ width: 'narrow' })).toBe(
      'max-width:36rem;margin-left:auto;margin-right:auto;',
    );
    expect(hasBlockStyle({ width: 'narrow' })).toBe(true);
  });

  it('wide', () => {
    expect(blockStyleToCss({ width: 'wide' })).toEqual({
      marginLeft: 'calc(var(--prism-block-bleed, 0px) * -0.5)',
      marginRight: 'calc(var(--prism-block-bleed, 0px) * -0.5)',
    });
  });

  it('full', () => {
    expect(blockStyleToCss({ width: 'full' })).toEqual({
      marginLeft: 'calc(var(--prism-block-bleed, 0px) * -1)',
      marginRight: 'calc(var(--prism-block-bleed, 0px) * -1)',
    });
  });
});

describe('blockStyle spacing', () => {
  it.each([
    ['s', '0.75rem'],
    ['m', '1.5rem'],
    ['l', '3rem'],
  ] as const)('%s -> vertical padding %s only', (spacing, value) => {
    expect(blockStyleToCss({ spacing })).toEqual({ paddingTop: value, paddingBottom: value });
    expect(blockStyleToCssString({ spacing })).toBe(`padding-top:${value};padding-bottom:${value};`);
  });
});

describe('blockStyle background', () => {
  it('tint', () => {
    expect(blockStyleToCss({ background: 'tint' })).toEqual({
      background: 'color-mix(in srgb, var(--prism-primary) 8%, #ffffff)',
      paddingTop: '1.5rem',
      paddingBottom: '1.5rem',
      paddingLeft: '1.5rem',
      paddingRight: '1.5rem',
      borderRadius: 'var(--prism-radius, 0.5rem)',
    });
  });

  it('accent', () => {
    expect(blockStyleToCss({ background: 'accent' }).background).toBe(
      'color-mix(in srgb, var(--prism-accent) 16%, #ffffff)',
    );
  });

  it('primary and dark switch text to light', () => {
    const primary = blockStyleToCss({ background: 'primary' });
    expect(primary.background).toBe('var(--prism-primary)');
    expect(primary).toMatchObject(LIGHT_ON_DARK);
    const dark = blockStyleToCss({ background: 'dark' });
    expect(dark.background).toBe('#17171C');
    expect(dark).toMatchObject(LIGHT_ON_DARK);
  });

  it('tint and accent do not change text colours', () => {
    expect(blockStyleToCss({ background: 'tint' })).not.toHaveProperty('color');
    expect(blockStyleToCss({ background: 'accent' })).not.toHaveProperty('color');
  });

  it('spacing overrides vertical padding when a background is set', () => {
    expect(blockStyleToCss({ background: 'tint', spacing: 'l' })).toMatchObject({
      paddingTop: '3rem',
      paddingBottom: '3rem',
      paddingLeft: '1.5rem',
      paddingRight: '1.5rem',
    });
  });

  it('string output matches the object output, in a deterministic order', () => {
    const style: BlockStyle = { width: 'narrow', background: 'dark', spacing: 's' };
    const css = blockStyleToCssString(style);
    expect(css).toBe(
      'max-width:36rem;margin-left:auto;margin-right:auto;' +
        'background:#17171C;padding-top:0.75rem;padding-bottom:0.75rem;padding-left:1.5rem;padding-right:1.5rem;' +
        'border-radius:var(--prism-radius, 0.5rem);color:#ffffff;' +
        '--prism-heading-color:#ffffff;--prism-body-color:rgba(255,255,255,0.88);' +
        '--prism-text:#ffffff;--prism-text-2:rgba(255,255,255,0.88);--prism-text-muted:rgba(255,255,255,0.72);',
    );
    expect(Object.keys(blockStyleToCss(style))).toHaveLength(css.split(';').filter(Boolean).length);
  });

  it('combined tint+narrow includes width then background pairs', () => {
    expect(blockStyleToCssString({ background: 'tint', width: 'narrow' }).startsWith(
      'max-width:36rem;margin-left:auto;margin-right:auto;background:color-mix(',
    )).toBe(true);
  });
});

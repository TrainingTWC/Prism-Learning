import { describe, expect, it } from 'vitest';
import {
  BLOCK_STYLE_BASE_CSS,
  blockStyleAttrString,
  blockStyleAttrs,
  blockStyleToCss,
  blockStyleToCssString,
  hasBlockStyle,
} from '@prism/renderer/block-style';

const BLEED = 'calc(var(--prism-block-bleed, 0px) * -1)';

describe('blockStyle', () => {
  it('treats undefined, {} and defaults as unstyled', () => {
    for (const s of [undefined, {}, { width: 'standard', background: 'none' }] as const) {
      expect(blockStyleToCssString(s)).toBe('');
      expect(hasBlockStyle(s)).toBe(false);
      expect(blockStyleAttrString(s)).toBe('');
      expect(blockStyleAttrs(s)).toEqual({});
    }
  });

  it('narrow centres at 30rem with only the style marker', () => {
    const s = { width: 'narrow' } as const;
    expect(blockStyleToCssString(s)).toBe('max-width:30rem;margin-left:auto;margin-right:auto;');
    expect(blockStyleAttrString(s)).toBe(' data-prism-style');
    expect(blockStyleAttrs(s)).toEqual({ 'data-prism-style': '' });
  });

  it('wide bleeds fully on both sides without resetting radius', () => {
    const css = blockStyleToCssString({ width: 'wide' });
    expect(css).toBe(`margin-left:${BLEED};margin-right:${BLEED};`);
    expect(css).not.toContain('border-radius');
  });

  it('full bleeds and squares corners', () => {
    expect(blockStyleToCssString({ width: 'full' })).toBe(
      `margin-left:${BLEED};margin-right:${BLEED};border-radius:0;`,
    );
  });

  it('full with background pads horizontally by the bleed', () => {
    const css = blockStyleToCssString({ width: 'full', background: 'primary' });
    expect(css).toContain('padding-left:var(--prism-block-bleed, 0px);');
    expect(css).toContain('padding-right:var(--prism-block-bleed, 0px);');
    expect(css).toContain('border-radius:0;');
    expect(css).toContain('--prism-heading-color:#ffffff;');
  });

  it('explicit spacing none is a real style', () => {
    const s = { spacing: 'none' } as const;
    expect(blockStyleToCssString(s)).toBe('padding-top:0;padding-bottom:0;');
    expect(blockStyleAttrString(s)).toBe(' data-prism-style data-prism-spacing');
  });

  it('spacing s/m/l map to 16/32/64px', () => {
    expect(blockStyleToCssString({ spacing: 's' })).toBe('padding-top:16px;padding-bottom:16px;');
    expect(blockStyleToCssString({ spacing: 'm' })).toBe('padding-top:32px;padding-bottom:32px;');
    expect(blockStyleToCssString({ spacing: 'l' })).toBe('padding-top:64px;padding-bottom:64px;');
  });

  it('background alone defaults to m spacing and the spacing marker', () => {
    const s = { background: 'tint' } as const;
    const css = blockStyleToCssString(s);
    expect(css).toContain('padding-top:32px;padding-bottom:32px;');
    expect(css).toContain('padding-left:1.5rem;padding-right:1.5rem;');
    expect(css).toContain('border-radius:var(--prism-radius, 0.5rem);');
    expect(blockStyleAttrs(s)).toEqual({ 'data-prism-style': '', 'data-prism-spacing': '' });
  });

  it('blockStyleToCss camelizes properties and keeps custom props', () => {
    expect(blockStyleToCss({ width: 'narrow' })).toEqual({
      maxWidth: '30rem',
      marginLeft: 'auto',
      marginRight: 'auto',
    });
    expect(blockStyleToCss({ background: 'dark' })).toMatchObject({
      color: '#ffffff',
      '--prism-text': '#ffffff',
    });
  });

  it('base css zeroes child vertical margins for spacing blocks', () => {
    expect(BLOCK_STYLE_BASE_CSS).toContain(
      '[data-prism-spacing]>*{margin-top:0!important;margin-bottom:0!important}',
    );
  });
});

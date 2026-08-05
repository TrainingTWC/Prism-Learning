import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontSize, FONT_SIZES } from './fontSize';

function createEditor(content: string) {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, TextStyle, Color, FontSize],
    content,
  });
}

describe('FontSize extension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createEditor('<p>Hello world</p>');
  });

  afterEach(() => {
    editor.destroy();
  });

  it('applies font-size to only the selected range', () => {
    // Select "Hello" (doc positions 1-6 inside the paragraph)
    editor.chain().setTextSelection({ from: 1, to: 6 }).setFontSize('20px').run();
    const html = editor.getHTML();
    expect(html).toContain('font-size: 20px');
    expect(html).toMatch(/<span[^>]*font-size: 20px[^>]*>Hello<\/span> world/);
  });

  it('reports the active font size for the current selection', () => {
    editor.chain().setTextSelection({ from: 1, to: 6 }).setFontSize('24px').run();
    editor.commands.setTextSelection({ from: 2, to: 4 });
    expect(editor.getAttributes('textStyle').fontSize).toBe('24px');
  });

  it('unsetFontSize removes the size without wiping other textStyle attrs', () => {
    editor
      .chain()
      .setTextSelection({ from: 1, to: 6 })
      .setColor('#ff0000')
      .setFontSize('20px')
      .run();
    expect(editor.getHTML()).toContain('font-size: 20px');

    editor.chain().setTextSelection({ from: 1, to: 6 }).unsetFontSize().run();
    const html = editor.getHTML();
    expect(html).not.toContain('font-size');
    // Color must survive
    expect(html).toMatch(/color:/);
  });

  it('round-trips inline font-size spans through HTML', () => {
    const roundTrip = createEditor(
      '<p>He<span style="font-size: 30px">ll</span>o</p>',
    );
    try {
      expect(roundTrip.getHTML()).toContain('font-size: 30px');
      roundTrip.commands.setTextSelection({ from: 3, to: 5 });
      expect(roundTrip.getAttributes('textStyle').fontSize).toBe('30px');
    } finally {
      roundTrip.destroy();
    }
  });

  it('exposes FONT_SIZES options with a Default (empty) first entry', () => {
    expect(FONT_SIZES[0]!.value).toBe('');
    expect(FONT_SIZES.map((o) => o.value)).toContain('20px');
  });
});

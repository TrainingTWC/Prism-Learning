/**
 * Vitest setup: polyfill layout APIs that ProseMirror (Tiptap) touches
 * but jsdom does not implement.
 */

function mockRect(): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

function mockRectList(): DOMRectList {
  const list = {
    length: 0,
    item: () => null,
    [Symbol.iterator]: [][Symbol.iterator],
  };
  return list as unknown as DOMRectList;
}

Range.prototype.getBoundingClientRect = mockRect;
Range.prototype.getClientRects = mockRectList;

if (!Element.prototype.getClientRects) {
  Element.prototype.getClientRects = mockRectList;
}

if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

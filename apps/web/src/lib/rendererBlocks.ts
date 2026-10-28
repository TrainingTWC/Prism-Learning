import type { Block, BlockStyle } from '@prism/renderer';

/** camelCase editor/Convex block type -> kebab-case renderer block type. */
export const EDITOR_TO_RENDERER_TYPE = {
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
} as const satisfies Record<string, Block['type']>;

/** Convert a Convex block doc into a renderer block. Null for unknown types. */
export function toRendererBlock(doc: {
  _id: string;
  type: string;
  content?: string;
  style?: BlockStyle;
}): Block | null {
  const type = (EDITOR_TO_RENDERER_TYPE as Record<string, Block['type'] | undefined>)[doc.type];
  if (!type) return null;
  const block: { id: string; type: Block['type']; content: string; style?: BlockStyle } = {
    id: doc._id,
    type,
    content: doc.content ?? '',
  };
  if (doc.style) block.style = doc.style;
  return block as Block;
}

/** Every Convex storage id referenced by the given blocks' JSON content. */
export function collectStorageIds(blocks: Array<{ type: string; content?: string }>): string[] {
  const ids: string[] = [];
  for (const block of blocks) {
    if (!block.content) continue;
    try {
      const p = JSON.parse(block.content) as Record<string, unknown>;
      if (typeof p.storageId === 'string') ids.push(p.storageId);
      if (block.type === 'video' && p.srcType === 'storage' && typeof p.src === 'string') ids.push(p.src);
      if (typeof p.beforeStorageId === 'string') ids.push(p.beforeStorageId);
      if (typeof p.afterStorageId === 'string') ids.push(p.afterStorageId);
      if (Array.isArray(p.items)) {
        for (const item of p.items as Array<{ storageId?: string }>) {
          if (typeof item.storageId === 'string') ids.push(item.storageId);
        }
      }
      if (Array.isArray(p.cards)) {
        for (const card of p.cards as Array<{
          frontImageStorageId?: string; frontAudioStorageId?: string;
          backImageStorageId?: string; backAudioStorageId?: string;
          imageStorageId?: string; audioStorageId?: string;
        }>) {
          if (typeof card.frontImageStorageId === 'string') ids.push(card.frontImageStorageId);
          if (typeof card.frontAudioStorageId === 'string') ids.push(card.frontAudioStorageId);
          if (typeof card.backImageStorageId === 'string') ids.push(card.backImageStorageId);
          if (typeof card.backAudioStorageId === 'string') ids.push(card.backAudioStorageId);
          // legacy: shared image/audio authored before front/back became independent
          if (typeof card.imageStorageId === 'string') ids.push(card.imageStorageId);
          if (typeof card.audioStorageId === 'string') ids.push(card.audioStorageId);
        }
      }
      if (Array.isArray(p.tabs)) {
        for (const tab of p.tabs as Array<{ imageStorageId?: string; audioStorageId?: string }>) {
          if (typeof tab.imageStorageId === 'string') ids.push(tab.imageStorageId);
          if (typeof tab.audioStorageId === 'string') ids.push(tab.audioStorageId);
        }
      }
      if (Array.isArray(p.sections)) {
        for (const section of p.sections as Array<{ imageStorageId?: string; audioStorageId?: string }>) {
          if (typeof section.imageStorageId === 'string') ids.push(section.imageStorageId);
          if (typeof section.audioStorageId === 'string') ids.push(section.audioStorageId);
        }
      }
    } catch { /* not JSON */ }
  }
  return [...new Set(ids)];
}

function parseObject(content: string): Record<string, unknown> | null {
  try {
    const p: unknown = JSON.parse(content);
    return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const hasStr = (v: unknown): boolean => typeof v === 'string' && v.length > 0;

/** True when a block has no authored content yet (used to show empty states). */
export function isBlockEmpty(type: string, content?: string): boolean {
  if (content === undefined || content === null || content === '') return true;
  if (type === 'richText') {
    return content.trim() === '<p></p>';
  }
  const p = parseObject(content);
  switch (type) {
    case 'image':
    case 'hotspots':
    case 'labeledGraphic':
    case 'lottie':
    case 'audio':
      return !p || !hasStr(p.storageId);
    case 'video':
      return !p || !hasStr(p.src);
    case 'gallery':
      return !p || !Array.isArray(p.items) || p.items.length === 0;
    case 'compare':
      return !p || (!hasStr(p.beforeStorageId) && !hasStr(p.afterStorageId));
    default:
      return false;
  }
}

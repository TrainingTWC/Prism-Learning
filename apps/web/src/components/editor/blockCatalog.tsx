import type { ComponentType } from 'react';
import {
  Type,
  ImageIcon,
  Video,
  Zap,
  CheckCircle2,
  ToggleLeft,
  AlignJustify,
  Quote,
  AlertCircle,
  Minus,
  CreditCard,
  ListOrdered,
  PanelTop,
  MousePointerClick,
  Code2,
  Target,
  Images,
  ArrowLeftRight,
  Music,
  Tag,
  GitMerge,
  ArrowUpDown,
  GitBranch,
  TextCursorInput,
} from 'lucide-react';
import type { EditorBlockType, EditorBlock, InsertTarget } from './types';

export type { InsertTarget } from './types';

export type CategoryId =
  | 'text'
  | 'media'
  | 'interactive'
  | 'knowledge'
  | 'scenario'
  | 'structure'
  | 'advanced';

export interface CatalogEntry {
  type: EditorBlockType;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  category: CategoryId;
  keywords: string[];
}

export const CATEGORIES: { id: CategoryId; label: string; hint: string }[] = [
  { id: 'text', label: 'Text', hint: 'Words, quotes and callouts' },
  { id: 'media', label: 'Media', hint: 'Images, video, audio and animation' },
  { id: 'interactive', label: 'Interactive', hint: 'Activities learners can try' },
  { id: 'knowledge', label: 'Knowledge check', hint: 'Scored questions' },
  { id: 'scenario', label: 'Scenario', hint: 'Branching decisions' },
  { id: 'structure', label: 'Structure', hint: 'Organise and separate content' },
  { id: 'advanced', label: 'Advanced', hint: 'Custom code and embeds' },
];

export const BLOCK_CATALOG: CatalogEntry[] = [
  // Text
  { type: 'richText', label: 'Text', description: 'Formatted text, headings, lists and links', icon: Type, category: 'text', keywords: ['paragraph', 'heading', 'rich text', 'write'] },
  { type: 'quote', label: 'Pull quote', description: 'Highlighted pull quote block', icon: Quote, category: 'text', keywords: ['testimonial', 'citation'] },
  { type: 'callout', label: 'Callout', description: 'Info, warning or tip callout box', icon: AlertCircle, category: 'text', keywords: ['note', 'tip', 'warning', 'alert', 'info'] },
  // Media
  { type: 'image', label: 'Image', description: 'Single image with optional caption', icon: ImageIcon, category: 'media', keywords: ['picture', 'photo'] },
  { type: 'video', label: 'Video', description: 'YouTube or Vimeo embed player', icon: Video, category: 'media', keywords: ['youtube', 'vimeo', 'embed'] },
  { type: 'audio', label: 'Audio', description: 'Embedded audio file player', icon: Music, category: 'media', keywords: ['sound', 'podcast', 'mp3'] },
  { type: 'lottie', label: 'Animation', description: 'Lottie JSON animation loop', icon: Zap, category: 'media', keywords: ['lottie', 'motion'] },
  { type: 'gallery', label: 'Gallery', description: 'Image grid or carousel', icon: Images, category: 'media', keywords: ['carousel', 'slideshow', 'images'] },
  { type: 'compare', label: 'Before / after', description: 'Before-and-after image slider', icon: ArrowLeftRight, category: 'media', keywords: ['compare', 'slider'] },
  // Interactive
  { type: 'flashcard', label: 'Flashcards', description: 'Flip-card deck for memorisation', icon: CreditCard, category: 'interactive', keywords: ['cards', 'flip', 'memorise'] },
  { type: 'hotspots', label: 'Hotspots', description: 'Image with clickable info markers', icon: Target, category: 'interactive', keywords: ['markers', 'pins', 'image'] },
  { type: 'labeledGraphic', label: 'Labeled graphic', description: 'Image with labelled annotation pins', icon: Tag, category: 'interactive', keywords: ['annotation', 'diagram'] },
  { type: 'matching', label: 'Matching', description: 'Drag-and-match pairs activity', icon: GitMerge, category: 'interactive', keywords: ['pairs', 'match', 'drag'] },
  { type: 'sorting', label: 'Sort order', description: 'Drag items into the correct order', icon: ArrowUpDown, category: 'interactive', keywords: ['sequence', 'order', 'rank'] },
  { type: 'fillBlanks', label: 'Fill blanks', description: 'Fill-in-the-blank cloze exercise', icon: TextCursorInput, category: 'interactive', keywords: ['cloze', 'gap'] },
  // Knowledge check
  { type: 'mcq', label: 'Multiple choice', description: 'Multiple-choice question with scored feedback', icon: CheckCircle2, category: 'knowledge', keywords: ['quiz', 'question', 'test', 'mcq', 'assessment'] },
  { type: 'trueFalse', label: 'True / False', description: 'True / false question with explanation', icon: ToggleLeft, category: 'knowledge', keywords: ['quiz', 'question', 'test', 'boolean', 'assessment'] },
  // Scenario
  { type: 'scenario', label: 'Branching scenario', description: 'Branching scenario with choices', icon: GitBranch, category: 'scenario', keywords: ['branch', 'decision', 'story', 'choices'] },
  // Structure
  { type: 'accordion', label: 'Accordion', description: 'Collapsible expand / collapse sections', icon: AlignJustify, category: 'structure', keywords: ['collapse', 'expand', 'faq'] },
  { type: 'tabs', label: 'Tabs', description: 'Tabbed content panels', icon: PanelTop, category: 'structure', keywords: ['panels'] },
  { type: 'process', label: 'Process', description: 'Numbered step-by-step process', icon: ListOrdered, category: 'structure', keywords: ['steps', 'timeline'] },
  { type: 'divider', label: 'Divider', description: 'Horizontal separator line', icon: Minus, category: 'structure', keywords: ['separator', 'line', 'space'] },
  { type: 'button', label: 'Button', description: 'Clickable call-to-action button', icon: MousePointerClick, category: 'structure', keywords: ['cta', 'link', 'action'] },
  // Advanced
  { type: 'customHtml', label: 'Custom HTML', description: 'Raw HTML or embed code', icon: Code2, category: 'advanced', keywords: ['code', 'embed', 'iframe', 'script'] },
];

export const QUICK_PICKS: { type: EditorBlockType; label: string }[] = [
  { type: 'richText', label: 'Text' },
  { type: 'image', label: 'Image' },
  { type: 'callout', label: 'Callout' },
  { type: 'mcq', label: 'Question' },
];

export function catalogEntry(type: string): CatalogEntry | undefined {
  return BLOCK_CATALOG.find((e) => e.type === type);
}

/** Filter the catalog by free-text query (case-insensitive) and category. */
export function filterCatalog(query: string, categoryId: CategoryId | 'all'): CatalogEntry[] {
  const q = query.trim().toLowerCase();
  // "quiz questions" -> every word must match somewhere
  const words = q.split(/\s+/).filter(Boolean);
  return BLOCK_CATALOG.filter((e) => {
    if (categoryId !== 'all' && e.category !== categoryId) return false;
    if (words.length === 0) return true;
    const hay = `${e.label} ${e.description} ${e.keywords.join(' ')}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/**
 * Convex `afterOrder` argument for blocks.add.
 * undefined = append, firstBlock.order - 2000 = before first.
 */
export function insertionAfterOrder(
  blocks: ReadonlyArray<Pick<EditorBlock, '_id' | 'order'>>,
  target: InsertTarget,
): number | undefined {
  if (target === 'end') return undefined;
  if (target === 'start') {
    const first = blocks[0];
    return first ? first.order - 2000 : undefined;
  }
  return blocks.find((b) => b._id === target.afterBlockId)?.order;
}

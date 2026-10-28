import type { BlockStyle } from './blockStyle';

export interface BlockBase {
  id: string;
  style?: BlockStyle;
}

export type ResolveAsset = (assetId: string) => string;

export interface Theme {
  // Brand
  primary: string;
  accent: string;
  // Feedback colors
  correct?: string;
  incorrect?: string;
  // Content text colors
  headingTextColor?: string;
  bodyTextColor?: string;
  // Typography
  headingFont: string;
  bodyFont: string;
  headingSize?: string;   // 'sm' | 'md' | 'lg' | 'xl'
  headingWeight?: string; // '400' | '500' | '600' | '700' | '800'
  bodySize?: string;      // 'sm' | 'md' | 'lg'
  lineHeight?: string;    // 'tight' | 'normal' | 'relaxed' | 'loose'
  // Shape
  borderRadius?: string;  // 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
  buttonStyle?: string;   // 'filled' | 'outline' | 'soft'
}

export type Block =
  | RichTextBlock
  | ImageBlock
  | VideoBlock
  | LottieBlock
  | MCQBlock
  | TrueFalseBlock
  | AccordionBlock
  | QuoteBlock
  | CalloutBlock
  | DividerBlock
  | FlashcardBlock
  | ProcessBlock
  | TabsBlock
  | ButtonBlock
  | CustomHtmlBlock
  | HotspotsBlock
  | GalleryBlock
  | CompareBlock
  | AudioBlock
  | LabeledGraphicBlock
  | MatchingBlock
  | SortingBlock
  | FillBlanksBlock
  | RevealCardsBlock
  | ScenarioBlock;

export interface RichTextBlock extends BlockBase {
  type: 'rich-text';
  /** Trusted HTML — produced server-side from Tiptap JSON. */
  content: string;
}

export interface ImageBlock extends BlockBase {
  type: 'image';
  content: string; // JSON: { storageId, altText, caption }
}

export interface VideoBlock extends BlockBase {
  type: 'video';
  content: string; // JSON: { srcType: 'embed'|'storage', src, caption }
}

export interface LottieBlock extends BlockBase {
  type: 'lottie';
  content: string; // JSON: { storageId, loop, autoplay }
}

export interface MCQBlock extends BlockBase {
  type: 'mcq';
  content: string; // JSON: { question, options, multiSelect, showFeedback }
}

export interface TrueFalseBlock extends BlockBase {
  type: 'true-false';
  content: string; // JSON: { statement, correctAnswer, trueFeedback, falseFeedback }
}

export interface AccordionBlock extends BlockBase {
  type: 'accordion';
  content: string; // JSON: { sections: [{ id, title, content }] }
}

export interface QuoteBlock extends BlockBase {
  type: 'quote';
  content: string; // JSON: { text: string; attribution?: string }
}

export interface CalloutBlock extends BlockBase {
  type: 'callout';
  content: string; // JSON: { variant: 'info'|'warning'|'success'|'tip'; title?: string; body: string }
}

export interface DividerBlock extends BlockBase {
  type: 'divider';
  content: string; // JSON: { style: 'line'|'space'|'dots'; label?: string; padding?: number }
}

export interface FlashcardBlock extends BlockBase {
  type: 'flashcard';
  content: string; // JSON: { cards: { id: string; front: string; back: string; frontImageStorageId?: string; frontAudioStorageId?: string; backImageStorageId?: string; backAudioStorageId?: string }[] }
}

export interface ProcessBlock extends BlockBase {
  type: 'process';
  content: string; // JSON: { steps: { id: string; title: string; body: string }[] }
}

export interface TabsBlock extends BlockBase {
  type: 'tabs';
  content: string; // JSON: { tabs: { id: string; title: string; content: string; imageStorageId?: string; audioStorageId?: string }[] }
}

export interface ButtonBlock extends BlockBase {
  type: 'button';
  content: string; // JSON: { label: string; url?: string; style: 'primary'|'outline'|'ghost'; align: 'left'|'center'|'right' }
}

export interface CustomHtmlBlock extends BlockBase {
  type: 'custom-html';
  content: string; // JSON: { html: string; notes?: string }
}

export interface HotspotsBlock extends BlockBase {
  type: 'hotspots';
  content: string; // JSON: { storageId, altText, hotspots: [{ id, xPct, yPct, title, body }] }
}

export interface GalleryBlock extends BlockBase {
  type: 'gallery';
  content: string; // JSON: { layout: 'carousel'|'grid', items: [{ storageId, altText, caption }] }
}

export interface CompareBlock extends BlockBase {
  type: 'compare';
  content: string; // JSON: { beforeStorageId, afterStorageId, beforeLabel, afterLabel }
}

export interface AudioBlock extends BlockBase {
  type: 'audio';
  content: string; // JSON: { storageId, title, transcript }
}

export interface LabeledGraphicBlock extends BlockBase {
  type: 'labeled-graphic';
  content: string; // JSON: { storageId, altText, labels: [{ id, xPct, yPct, text }] }
}

export interface MatchingBlock extends BlockBase {
  type: 'matching';
  content: string; // JSON: { instructions, pairs: [{ id, term, definition }] }
}

export interface SortingBlock extends BlockBase {
  type: 'sorting';
  content: string; // JSON: { instructions, items: [{ id, text }] }  // order in array = correct order
}

export interface FillBlanksBlock extends BlockBase {
  type: 'fill-blanks';
  content: string; // JSON: { template, blanks: [{ key, answer, alternates }] }
}

export interface RevealCardsBlock extends BlockBase {
  type: 'reveal-cards';
  content: string; // JSON: { columns: 2|3|4, cards: [{ id, front, back }] }
}

export interface ScenarioBlock extends BlockBase {
  type: 'scenario';
  content: string; // JSON: { startNodeId, nodes: [{ id, prompt, choices: [{ label, nextId, feedback }], outcome }] }
}

export interface ModuleProps {
  blocks: readonly Block[];
  theme: Theme;
  resolveAsset: ResolveAsset;
}

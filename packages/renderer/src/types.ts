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
  | AccordionBlock;

export interface RichTextBlock {
  id: string;
  type: 'rich-text';
  /** Trusted HTML — produced server-side from Tiptap JSON. */
  content: string;
}

export interface ImageBlock {
  id: string;
  type: 'image';
  content: string; // JSON: { storageId, altText, caption }
}

export interface VideoBlock {
  id: string;
  type: 'video';
  content: string; // JSON: { srcType: 'embed'|'storage', src, caption }
}

export interface LottieBlock {
  id: string;
  type: 'lottie';
  content: string; // JSON: { storageId, loop, autoplay }
}

export interface MCQBlock {
  id: string;
  type: 'mcq';
  content: string; // JSON: { question, options, multiSelect, showFeedback }
}

export interface TrueFalseBlock {
  id: string;
  type: 'true-false';
  content: string; // JSON: { statement, correctAnswer, trueFeedback, falseFeedback }
}

export interface AccordionBlock {
  id: string;
  type: 'accordion';
  content: string; // JSON: { sections: [{ id, title, content }] }
}

export interface ModuleProps {
  blocks: readonly Block[];
  theme: Theme;
  resolveAsset: ResolveAsset;
}

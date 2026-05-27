export type ResolveAsset = (assetId: string) => string;

export interface Theme {
  primary: string;
  accent: string;
  headingFont: string;
  bodyFont: string;
}

export type Block = RichTextBlock; // Phase 5 will widen this union.

export interface RichTextBlock {
  id: string;
  type: 'rich-text';
  /** Trusted HTML — produced server-side from Tiptap JSON. */
  content: string;
}

export interface ModuleProps {
  blocks: readonly Block[];
  theme: Theme;
  resolveAsset: ResolveAsset;
}

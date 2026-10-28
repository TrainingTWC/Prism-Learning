import type { Block, ResolveAsset, Theme } from './types';
import { RichTextBlock } from './RichTextBlock';
import { ImageBlockRenderer } from './ImageBlockRenderer';
import { VideoBlockRenderer } from './VideoBlockRenderer';
import { LottieBlockRenderer } from './LottieBlockRenderer';
import { MCQBlockRenderer } from './MCQBlockRenderer';
import { TrueFalseBlockRenderer } from './TrueFalseBlockRenderer';
import { AccordionBlockRenderer } from './AccordionBlockRenderer';
import { QuoteBlockRenderer } from './QuoteBlockRenderer';
import { CalloutBlockRenderer } from './CalloutBlockRenderer';
import { DividerBlockRenderer } from './DividerBlockRenderer';
import { FlashcardBlockRenderer } from './FlashcardBlockRenderer';
import { ProcessBlockRenderer } from './ProcessBlockRenderer';
import { TabsBlockRenderer } from './TabsBlockRenderer';
import { ButtonBlockRenderer } from './ButtonBlockRenderer';
import { CustomHtmlBlockRenderer } from './CustomHtmlBlockRenderer';
import { HotspotsBlockRenderer } from './HotspotsBlockRenderer';
import { GalleryBlockRenderer } from './GalleryBlockRenderer';
import { CompareBlockRenderer } from './CompareBlockRenderer';
import { AudioBlockRenderer } from './AudioBlockRenderer';
import { LabeledGraphicBlockRenderer } from './LabeledGraphicBlockRenderer';
import { FillBlanksBlockRenderer } from './FillBlanksBlockRenderer';
import { RevealCardsBlockRenderer } from './RevealCardsBlockRenderer';
import { MatchingBlockRenderer } from './MatchingBlockRenderer';
import { SortingBlockRenderer } from './SortingBlockRenderer';
import { ScenarioBlockRenderer } from './ScenarioBlockRenderer';

export interface BlockRendererProps {
  block: Block;
  theme: Theme;
  resolveAsset: ResolveAsset;
}

/**
 * Renders a single block. Shared by <Module> (learner / preview) and the
 * editor canvas so both draw blocks through exactly the same code path.
 * Zero I/O.
 */
export function BlockRenderer({ block, theme, resolveAsset }: BlockRendererProps) {
  switch (block.type) {
    case 'rich-text':
      return <RichTextBlock block={block} />;
    case 'image':
      return <ImageBlockRenderer block={block} resolveAsset={resolveAsset} />;
    case 'video':
      return <VideoBlockRenderer block={block} resolveAsset={resolveAsset} />;
    case 'lottie':
      return <LottieBlockRenderer block={block} resolveAsset={resolveAsset} />;
    case 'mcq':
      return <MCQBlockRenderer block={block} />;
    case 'true-false':
      return <TrueFalseBlockRenderer block={block} />;
    case 'accordion':
      return <AccordionBlockRenderer block={block} resolveAsset={resolveAsset} />;
    case 'quote':
      return <QuoteBlockRenderer block={block} />;
    case 'callout':
      return <CalloutBlockRenderer block={block} />;
    case 'divider':
      return <DividerBlockRenderer block={block} />;
    case 'flashcard':
      return <FlashcardBlockRenderer block={block} resolveAsset={resolveAsset} />;
    case 'process':
      return <ProcessBlockRenderer block={block} />;
    case 'tabs':
      return <TabsBlockRenderer block={block} resolveAsset={resolveAsset} />;
    case 'button':
      return <ButtonBlockRenderer block={block} />;
    case 'custom-html':
      return <CustomHtmlBlockRenderer block={block} />;
    case 'hotspots':
      return <HotspotsBlockRenderer block={block} resolveAsset={resolveAsset} theme={theme} />;
    case 'gallery':
      return <GalleryBlockRenderer block={block} resolveAsset={resolveAsset} theme={theme} />;
    case 'compare':
      return <CompareBlockRenderer block={block} resolveAsset={resolveAsset} theme={theme} />;
    case 'audio':
      return <AudioBlockRenderer block={block} resolveAsset={resolveAsset} theme={theme} />;
    case 'labeled-graphic':
      return <LabeledGraphicBlockRenderer block={block} resolveAsset={resolveAsset} theme={theme} />;
    case 'fill-blanks':
      return <FillBlanksBlockRenderer block={block} theme={theme} />;
    case 'reveal-cards':
      return <RevealCardsBlockRenderer block={block} theme={theme} />;
    case 'matching':
      return <MatchingBlockRenderer block={block} theme={theme} />;
    case 'sorting':
      return <SortingBlockRenderer block={block} theme={theme} />;
    case 'scenario':
      return <ScenarioBlockRenderer block={block} theme={theme} />;
    default: {
      const _exhaustive: never = block;
      void _exhaustive;
      return null;
    }
  }
}

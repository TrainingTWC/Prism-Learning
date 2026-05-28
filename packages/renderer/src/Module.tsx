import type { ModuleProps } from './types';
import { tokensToCss } from './tokensToCss';
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

/**
 * Pure module renderer. Same component drives:
 *   - Authoring preview (apps/web)
 *   - Learner preview (Phase 7)
 *   - SCORM export runtime (Phase 8)
 *
 * Zero I/O. All side-effectful concerns are injected via props.
 */
export function Module({ blocks, theme, resolveAsset }: ModuleProps) {
  return (
    <div className="prism-module" style={tokensToCss(theme)}>
      {blocks.map((block, index) => {
        const style = { ['--prism-stagger-index' as string]: index } as React.CSSProperties;
        let rendered: React.ReactNode;
        switch (block.type) {
          case 'rich-text':
            rendered = <RichTextBlock block={block} />;
            break;
          case 'image':
            rendered = <ImageBlockRenderer block={block} resolveAsset={resolveAsset} />;
            break;
          case 'video':
            rendered = <VideoBlockRenderer block={block} resolveAsset={resolveAsset} />;
            break;
          case 'lottie':
            rendered = <LottieBlockRenderer block={block} resolveAsset={resolveAsset} />;
            break;
          case 'mcq':
            rendered = <MCQBlockRenderer block={block} />;
            break;
          case 'true-false':
            rendered = <TrueFalseBlockRenderer block={block} />;
            break;
          case 'accordion':
            rendered = <AccordionBlockRenderer block={block} />;
            break;
          case 'quote':
            rendered = <QuoteBlockRenderer block={block} />;
            break;
          case 'callout':
            rendered = <CalloutBlockRenderer block={block} />;
            break;
          case 'divider':
            rendered = <DividerBlockRenderer block={block} />;
            break;
          case 'flashcard':
            rendered = <FlashcardBlockRenderer block={block} />;
            break;
          case 'process':
            rendered = <ProcessBlockRenderer block={block} />;
            break;
          case 'tabs':
            rendered = <TabsBlockRenderer block={block} />;
            break;
          case 'button':
            rendered = <ButtonBlockRenderer block={block} />;
            break;
          case 'custom-html':
            rendered = <CustomHtmlBlockRenderer block={block} />;
            break;
          case 'hotspots':
            rendered = <HotspotsBlockRenderer block={block} resolveAsset={resolveAsset} theme={theme} />;
            break;
          case 'gallery':
            rendered = <GalleryBlockRenderer block={block} resolveAsset={resolveAsset} theme={theme} />;
            break;
          case 'compare':
            rendered = <CompareBlockRenderer block={block} resolveAsset={resolveAsset} theme={theme} />;
            break;
          case 'audio':
            rendered = <AudioBlockRenderer block={block} resolveAsset={resolveAsset} theme={theme} />;
            break;
          case 'labeled-graphic':
            rendered = <LabeledGraphicBlockRenderer block={block} resolveAsset={resolveAsset} theme={theme} />;
            break;
          case 'fill-blanks':
            rendered = <FillBlanksBlockRenderer block={block} theme={theme} />;
            break;
          case 'reveal-cards':
            rendered = <RevealCardsBlockRenderer block={block} theme={theme} />;
            break;
          case 'matching':
            rendered = <MatchingBlockRenderer block={block} theme={theme} />;
            break;
          case 'sorting':
            rendered = <SortingBlockRenderer block={block} theme={theme} />;
            break;
          case 'scenario':
            rendered = <ScenarioBlockRenderer block={block} theme={theme} />;
            break;
          default: {
            const _exhaustive: never = block;
            return null;
          }
        }
        return (
          <div key={block.id} className="prism-block-reveal" style={style}>
            {rendered}
          </div>
        );
      })}
    </div>
  );
}

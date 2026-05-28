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

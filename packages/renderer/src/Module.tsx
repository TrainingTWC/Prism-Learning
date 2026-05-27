import type { ModuleProps } from './types';
import { tokensToCss } from './tokensToCss';
import { RichTextBlock } from './RichTextBlock';
import { ImageBlockRenderer } from './ImageBlockRenderer';
import { VideoBlockRenderer } from './VideoBlockRenderer';
import { LottieBlockRenderer } from './LottieBlockRenderer';
import { MCQBlockRenderer } from './MCQBlockRenderer';
import { TrueFalseBlockRenderer } from './TrueFalseBlockRenderer';
import { AccordionBlockRenderer } from './AccordionBlockRenderer';

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
      {blocks.map((block) => {
        switch (block.type) {
          case 'rich-text':
            return <RichTextBlock key={block.id} block={block} />;
          case 'image':
            return <ImageBlockRenderer key={block.id} block={block} resolveAsset={resolveAsset} />;
          case 'video':
            return <VideoBlockRenderer key={block.id} block={block} resolveAsset={resolveAsset} />;
          case 'lottie':
            return <LottieBlockRenderer key={block.id} block={block} resolveAsset={resolveAsset} />;
          case 'mcq':
            return <MCQBlockRenderer key={block.id} block={block} />;
          case 'true-false':
            return <TrueFalseBlockRenderer key={block.id} block={block} />;
          case 'accordion':
            return <AccordionBlockRenderer key={block.id} block={block} />;
          default: {
            const _exhaustive: never = block;
            return null;
          }
        }
      })}
    </div>
  );
}

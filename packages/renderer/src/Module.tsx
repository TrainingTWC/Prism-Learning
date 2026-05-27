import type { ModuleProps } from './types';
import { tokensToCss } from './tokensToCss';
import { RichTextBlock } from './RichTextBlock';

/**
 * Pure module renderer. Same component drives:
 *   - Authoring preview (apps/web)
 *   - Learner preview (Phase 7)
 *   - SCORM export runtime (Phase 8, via apps/scorm-runtime)
 *
 * Zero I/O. All side-effectful concerns are injected via props.
 */
export function Module({ blocks, theme, resolveAsset: _resolveAsset }: ModuleProps) {
  return (
    <div className="prism-module" style={tokensToCss(theme)}>
      {blocks.map((block) => {
        switch (block.type) {
          case 'rich-text':
            return <RichTextBlock key={block.id} block={block} />;
          default: {
            // Exhaustiveness check — widening Block (Phase 5) will surface here.
            const _exhaustive: never = block.type;
            return null;
          }
        }
      })}
    </div>
  );
}

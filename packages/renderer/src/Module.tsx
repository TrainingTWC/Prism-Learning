import type { ModuleProps } from './types';
import { tokensToCss } from './tokensToCss';
import { BlockRenderer } from './BlockRenderer';
import { blockStyleToCss, hasBlockStyle } from './blockStyle';

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
        const style = {
          ['--prism-stagger-index' as string]: index,
          ...blockStyleToCss(block.style),
        } as React.CSSProperties;
        return (
          <div
            key={block.id}
            className="prism-block-reveal"
            style={style}
            data-prism-style={hasBlockStyle(block.style) ? '' : undefined}
          >
            <BlockRenderer block={block} theme={theme} resolveAsset={resolveAsset} />
          </div>
        );
      })}
    </div>
  );
}

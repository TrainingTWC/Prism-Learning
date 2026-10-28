import { RichTextBlockEditor } from '../RichTextBlockEditor';
import { ImageBlockEditor } from '../ImageBlockEditor';
import { VideoBlockEditor } from '../VideoBlockEditor';
import { LottieBlockEditor } from '../LottieBlockEditor';
import { MCQBlockEditor } from '../MCQBlockEditor';
import { TrueFalseBlockEditor } from '../TrueFalseBlockEditor';
import { AccordionBlockEditor } from '../AccordionBlockEditor';
import { QuoteBlockEditor } from '../QuoteBlockEditor';
import { CalloutBlockEditor } from '../CalloutBlockEditor';
import { DividerBlockEditor } from '../DividerBlockEditor';
import { FlashcardBlockEditor } from '../FlashcardBlockEditor';
import { ProcessBlockEditor } from '../ProcessBlockEditor';
import { TabsBlockEditor } from '../TabsBlockEditor';
import { ButtonBlockEditor } from '../ButtonBlockEditor';
import { CustomHtmlBlockEditor } from '../CustomHtmlBlockEditor';
import { HotspotsBlockEditor } from '../HotspotsBlockEditor';
import { GalleryBlockEditor } from '../GalleryBlockEditor';
import { CompareBlockEditor } from '../CompareBlockEditor';
import { AudioBlockEditor } from '../AudioBlockEditor';
import { LabeledGraphicBlockEditor } from '../LabeledGraphicBlockEditor';
import { FillBlanksBlockEditor } from '../FillBlanksBlockEditor';
import { MatchingBlockEditor } from '../MatchingBlockEditor';
import { SortingBlockEditor } from '../SortingBlockEditor';
import { ScenarioBlockEditor } from '../ScenarioBlockEditor';
import type { EditorBlock } from './types';

interface BlockEditorProps {
  block: EditorBlock;
  onSave: (content: string) => void;
  autoFocus?: boolean;
  onSlashCommand?: () => void;
}

/** Per-type editor switch (the editors are uncontrolled: they read content once). */
export function BlockEditor({ block, onSave, autoFocus, onSlashCommand }: BlockEditorProps) {
  const common = { blockId: block._id, initialContent: block.content, onSave };
  switch (block.type) {
    case 'richText':
      return (
        <RichTextBlockEditor
          blockId={block._id}
          initialContent={block.content ?? '<p></p>'}
          onSave={onSave}
          autoFocus={autoFocus}
          onSlashCommand={onSlashCommand}
        />
      );
    case 'image':
      return <ImageBlockEditor {...common} moduleId={block.moduleId} />;
    case 'video':
      return <VideoBlockEditor {...common} />;
    case 'lottie':
      return <LottieBlockEditor {...common} />;
    case 'mcq':
      return <MCQBlockEditor {...common} />;
    case 'trueFalse':
      return <TrueFalseBlockEditor {...common} />;
    case 'accordion':
      return <AccordionBlockEditor {...common} />;
    case 'quote':
      return <QuoteBlockEditor {...common} />;
    case 'callout':
      return <CalloutBlockEditor {...common} />;
    case 'divider':
      return <DividerBlockEditor {...common} />;
    case 'flashcard':
      return <FlashcardBlockEditor {...common} />;
    case 'process':
      return <ProcessBlockEditor {...common} />;
    case 'tabs':
      return <TabsBlockEditor {...common} />;
    case 'button':
      return <ButtonBlockEditor {...common} />;
    case 'customHtml':
      return <CustomHtmlBlockEditor {...common} />;
    case 'hotspots':
      return <HotspotsBlockEditor {...common} />;
    case 'gallery':
      return <GalleryBlockEditor {...common} />;
    case 'compare':
      return <CompareBlockEditor {...common} />;
    case 'audio':
      return <AudioBlockEditor {...common} />;
    case 'labeledGraphic':
      return <LabeledGraphicBlockEditor {...common} />;
    case 'fillBlanks':
      return <FillBlanksBlockEditor {...common} />;
    case 'matching':
      return <MatchingBlockEditor {...common} />;
    case 'sorting':
      return <SortingBlockEditor {...common} />;
    case 'scenario':
      return <ScenarioBlockEditor {...common} />;
    default:
      return null;
  }
}

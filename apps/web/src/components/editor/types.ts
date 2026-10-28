import type { Id } from '~convex/_generated/dataModel';
import type { BlockStyle } from '@prism/renderer';

export type EditorBlockType =
  | 'richText'
  | 'image'
  | 'video'
  | 'lottie'
  | 'mcq'
  | 'trueFalse'
  | 'accordion'
  | 'quote'
  | 'callout'
  | 'divider'
  | 'flashcard'
  | 'process'
  | 'tabs'
  | 'button'
  | 'customHtml'
  | 'hotspots'
  | 'gallery'
  | 'compare'
  | 'audio'
  | 'labeledGraphic'
  | 'fillBlanks'
  | 'matching'
  | 'sorting'
  | 'scenario';

export type EditorLesson = {
  _id: Id<'lessons'>;
  title: string;
  order: number;
  createdAt: number;
  moduleId: Id<'modules'>;
};

export type EditorBlock = {
  _id: Id<'blocks'>;
  lessonId: Id<'lessons'>;
  moduleId: Id<'modules'>;
  type: EditorBlockType;
  order: number;
  content?: string;
  style?: BlockStyle;
  updatedAt: number;
  lastEditedBy?: Id<'users'>;
};

/** Where a new block should be inserted within the active lesson. */
export type InsertTarget = 'start' | 'end' | { afterBlockId: Id<'blocks'> };

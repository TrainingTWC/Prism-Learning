import { useEffect } from 'react';
import { DEFAULT_TAB_TITLE } from './editorNav';

/** Sets document.title while mounted; restores the default on unmount/change. */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (typeof title !== 'string' || title.length === 0) return;
    document.title = title;
    return () => {
      document.title = DEFAULT_TAB_TITLE;
    };
  }, [title]);
}

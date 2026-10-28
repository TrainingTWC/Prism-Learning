import { useCallback, useState } from 'react';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { api } from '~convex/_generated/api';
import type { Id } from '~convex/_generated/dataModel';
import { buildScormPackage, downloadBlob } from './scormExport';
import type { ExportOptions } from './scormExport';
import { buildExportModule, scormFilename } from './exportData';
import { toExportTheme } from './workspaceTheme';

/**
 * SCORM export + completion-settings persistence, shared by the publish page.
 * Logic moved verbatim from the editor's old export dialog:
 * persist first, then export, so a just-exported module and its learner
 * preview always agree.
 */
export function useScormExport({
  moduleId,
  workspaceId,
}: {
  moduleId: Id<'modules'>;
  workspaceId: Id<'workspaces'>;
}) {
  const convex = useConvex();
  const content = useQuery(api.modules.getWithContent, { moduleId });
  const workspace = useQuery(api.workspaces.getById, { workspaceId });
  const setCompletionSettings = useMutation(api.modules.setCompletionSettings);

  const [exporting, setExporting] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const dismissWarnings = useCallback(() => setWarnings([]), []);

  const persistCompletionSettings = useCallback(
    async (opts: ExportOptions) => {
      await setCompletionSettings({
        moduleId,
        passingScore: opts.passingScore,
        completionCriteria: opts.completionCriteria,
        defaultTitle: opts.completionCopy?.defaultTitle,
        defaultBody: opts.completionCopy?.defaultBody,
        passTitle: opts.completionCopy?.passTitle,
        passBody: opts.completionCopy?.passBody,
        failTitle: opts.completionCopy?.failTitle,
        failBody: opts.completionCopy?.failBody,
      });
    },
    [setCompletionSettings, moduleId],
  );

  const exportScorm = useCallback(
    async (opts: ExportOptions) => {
      if (!content) return;
      setExporting(true);
      try {
        // One-shot read at export time (not a live subscription).
        const allBlocks = await convex.query(api.blocks.listByModule, { moduleId });
        const mod = buildExportModule(content.module, content.lessons, allBlocks);
        const { blob, warnings: w } = await buildScormPackage(
          mod,
          toExportTheme(workspace?.theme),
          opts,
          async (storageId) => {
            const url = await convex.query(api.files.getFileUrl, { storageId });
            return url ?? '';
          },
        );
        downloadBlob(blob, scormFilename(content.module.title));
        setWarnings(w);
      } finally {
        setExporting(false);
      }
    },
    [content, workspace, moduleId, convex],
  );

  return { exporting, warnings, dismissWarnings, persistCompletionSettings, exportScorm };
}

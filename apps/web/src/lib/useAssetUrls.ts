import { useEffect, useMemo, useState } from 'react';
import { useConvex } from 'convex/react';
import { api } from '~convex/_generated/api';

/**
 * Resolve Convex storage ids to URLs. Results are cached for the lifetime of
 * the component; only ids not yet resolved trigger a query. The returned map
 * only contains the requested ids that have resolved so far.
 */
export function useAssetUrls(storageIds: readonly string[]): Record<string, string> {
  const convex = useConvex();
  const [cache, setCache] = useState<Record<string, string>>({});
  const key = storageIds.join(',');

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    let cancelled = false;
    for (const id of ids) {
      if (cache[id]) continue;
      void convex.query(api.files.getFileUrl, { storageId: id }).then((url) => {
        if (!cancelled && url) setCache((prev) => (prev[id] ? prev : { ...prev, [id]: url }));
      });
    }
    return () => {
      cancelled = true;
    };
    // `cache` is deliberately omitted: it is only read to skip already-resolved
    // ids, and re-running on every cache write would re-query in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, convex]);

  return useMemo(() => {
    const ids = key ? key.split(',') : [];
    const map: Record<string, string> = {};
    for (const id of ids) {
      const url = cache[id];
      if (url) map[id] = url;
    }
    return map;
  }, [key, cache]);
}

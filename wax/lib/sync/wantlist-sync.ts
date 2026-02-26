import { api } from '../api/endpoints';
import { rateLimiter } from '../api/rate-limiter';
import { upsertWantlistBatch, getSyncMeta, setSyncMeta } from '../db/queries';

export async function syncWantlist(username: string): Promise<void> {
  try {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const pageData = await rateLimiter.schedule(
        () => api.getWantlist(username, page, 100),
        3
      );

      if (pageData.wants.length > 0) {
        await upsertWantlistBatch(pageData.wants);
      }

      hasMore = page < pageData.pagination.pages;
      page++;
    }

    await setSyncMeta('last_wantlist_sync', new Date().toISOString());
  } catch (error) {
    console.error('[WantlistSync] Error:', error);
  }
}

export async function isWantlistSyncStale(): Promise<boolean> {
  const lastSync = await getSyncMeta('last_wantlist_sync');
  if (!lastSync) return true;
  const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
  return new Date(lastSync).getTime() < sixHoursAgo;
}

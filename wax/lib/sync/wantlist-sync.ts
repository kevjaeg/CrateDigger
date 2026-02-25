import { api } from '../api/endpoints';
import { rateLimiter } from '../api/rate-limiter';
import { upsertWantlistBatch } from '../db/queries';

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
  } catch (error) {
    console.error('[WantlistSync] Error:', error);
  }
}

import { api } from '../api/endpoints';
import { rateLimiter } from '../api/rate-limiter';
import {
  upsertFolder,
  upsertCollectionBatch,
  setSyncMeta,
  getSyncMeta,
  getMostRecentDateAdded,
  getLocalCollectionCount,
} from '../db/queries';
import { useSyncStore } from '../store/sync-store';
import { computeAllStats } from './stats-computer';

export async function syncCollection(username: string): Promise<void> {
  const store = useSyncStore.getState();
  store.setSyncing();

  try {
    // Sync folders first
    const { folders } = await rateLimiter.schedule(
      () => api.getCollectionFolders(username),
      3
    );
    for (const folder of folders) {
      await upsertFolder(folder);
    }

    // Determine sync strategy
    const lastSync = await getSyncMeta('last_full_sync');
    const localCount = await getLocalCollectionCount();

    if (!lastSync || localCount === 0) {
      await fullSync(username);
    } else {
      await incrementalSync(username);
    }

    // Recompute stats after sync
    await computeAllStats();

    store.setComplete();
  } catch (error) {
    console.error('[Sync] Error:', error);
    store.setError(error instanceof Error ? error.message : 'Sync failed');
  }
}

async function fullSync(username: string): Promise<void> {
  const store = useSyncStore.getState();

  // Fetch first page to get total count
  const firstPage = await rateLimiter.schedule(
    () => api.getCollectionItems(username, 0, 1, 100),
    3
  );

  const totalItems = firstPage.pagination.items;
  const totalPages = firstPage.pagination.pages;

  store.setProgress(0, totalItems);

  // Store first page immediately
  await upsertCollectionBatch(firstPage.releases);
  store.setProgress(firstPage.releases.length, totalItems);

  // Fetch remaining pages
  for (let page = 2; page <= totalPages; page++) {
    const pageData = await rateLimiter.schedule(
      () => api.getCollectionItems(username, 0, page, 100),
      3
    );

    await upsertCollectionBatch(pageData.releases);

    const syncedSoFar = Math.min(page * 100, totalItems);
    store.setProgress(syncedSoFar, totalItems);
  }

  await setSyncMeta('last_full_sync', new Date().toISOString());
  await setSyncMeta('collection_count', totalItems.toString());
}

async function incrementalSync(username: string): Promise<void> {
  const store = useSyncStore.getState();
  const mostRecentLocal = await getMostRecentDateAdded();

  let page = 1;
  let foundExisting = false;
  let newItems = 0;

  while (!foundExisting) {
    const pageData = await rateLimiter.schedule(
      () => api.getCollectionItems(username, 0, page, 100),
      3
    );

    if (pageData.releases.length === 0) break;

    // Find where new items end
    const newReleases = mostRecentLocal
      ? pageData.releases.filter((r) => r.date_added > mostRecentLocal)
      : pageData.releases;

    if (newReleases.length > 0) {
      await upsertCollectionBatch(newReleases);
      newItems += newReleases.length;
    }

    // If not all items on this page were new, we've caught up
    if (newReleases.length < pageData.releases.length) {
      foundExisting = true;
    }

    store.setProgress(newItems, newItems);
    page++;

    // Safety: don't scan more than 10 pages for incremental
    if (page > 10) break;
  }

  if (newItems > 0) {
    const localCount = await getLocalCollectionCount();
    await setSyncMeta('collection_count', localCount.toString());
  }

  await setSyncMeta('last_incremental_sync', new Date().toISOString());
}

export async function isSyncStale(): Promise<boolean> {
  const lastSync = await getSyncMeta('last_full_sync');
  const lastIncremental = await getSyncMeta('last_incremental_sync');

  const latest = lastIncremental || lastSync;
  if (!latest) return true;

  const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
  return new Date(latest).getTime() < sixHoursAgo;
}

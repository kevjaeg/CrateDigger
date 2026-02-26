import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSyncStore } from '@/lib/store/sync-store';
import { useAuthStore } from '@/lib/store/auth-store';
import { getCollectionPage, type CollectionRow } from '@/lib/db/queries';
import { syncCollection, isSyncStale } from '@/lib/sync/collection-sync';
import ReleaseCard from '@/components/release-card';
import EmptyState from '@/components/empty-state';
import { SkeletonGrid } from '@/components/skeleton';
import SyncProgressBar from '@/components/sync-progress-bar';
import { showToast } from '@/lib/store/toast-store';

const PAGE_SIZE = 50;

export default function CollectionScreen() {
  const username = useAuthStore((s) => s.username);
  const syncStatus = useSyncStore((s) => s.status);
  const syncedItems = useSyncStore((s) => s.syncedItems);
  const totalItems = useSyncStore((s) => s.totalItems);
  const progress = useSyncStore((s) => s.progress);

  const [items, setItems] = useState<CollectionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const hasCheckedStale = useRef(false);

  // Load initial page
  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCollectionPage(null, 1, PAGE_SIZE);
      setItems(result.items);
      setTotal(result.total);
      setPage(1);
    } catch (error) {
      console.error('[Collection] Failed to load:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load more pages
  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    const loaded = items.length;
    if (loaded >= total) return;

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await getCollectionPage(null, nextPage, PAGE_SIZE);
      setItems((prev) => [...prev, ...result.items]);
      setTotal(result.total);
      setPage(nextPage);
    } catch (error) {
      console.error('[Collection] Failed to load more:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [items.length, total, page, loadingMore]);

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    if (!username) return;
    setRefreshing(true);
    try {
      await syncCollection(username);
    } catch (error) {
      console.error('[Collection] Refresh sync error:', error);
      showToast('Sync failed — showing cached data');
    }
    await loadFirstPage();
    setRefreshing(false);
  }, [username, loadFirstPage]);

  // Reload when tab is focused (picks up adds/removes from other screens)
  useFocusEffect(
    useCallback(() => {
      loadFirstPage();
    }, [loadFirstPage])
  );

  // Check staleness on mount and trigger background sync
  useEffect(() => {
    if (hasCheckedStale.current || !username) return;
    hasCheckedStale.current = true;

    (async () => {
      const stale = await isSyncStale();
      if (stale) {
        syncCollection(username).then(() => {
          loadFirstPage();
        });
      }
    })();
  }, [username, loadFirstPage]);

  // Reload data when sync completes, show toast on sync error (once)
  const prevSyncStatus = useRef(syncStatus);
  useEffect(() => {
    if (syncStatus === 'complete') {
      loadFirstPage();
    } else if (syncStatus === 'error' && prevSyncStatus.current !== 'error') {
      showToast('Background sync failed');
    }
    prevSyncStatus.current = syncStatus;
  }, [syncStatus, loadFirstPage]);

  const renderItem = useCallback(
    ({ item }: { item: CollectionRow }) => <ReleaseCard item={item} />,
    []
  );

  const keyExtractor = useCallback(
    (item: CollectionRow) => item.instance_id.toString(),
    []
  );

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View className="py-4">
        <ActivityIndicator color="#c4882a" />
      </View>
    );
  }, [loadingMore]);

  // Loading state — skeleton grid instead of spinner
  if (loading) {
    return <SkeletonGrid />;
  }

  // Empty + syncing
  if (items.length === 0 && syncStatus === 'syncing') {
    return (
      <View className="flex-1 bg-[#0a0a0a] items-center justify-center">
        <ActivityIndicator size="large" color="#c4882a" />
        <Text className="text-[#a0a0a0] text-base mt-4">
          Syncing your collection...
        </Text>
      </View>
    );
  }

  // Empty + not syncing
  if (items.length === 0) {
    return (
      <View className="flex-1 bg-[#0a0a0a]">
        <EmptyState
          title="No records yet"
          subtitle="Start by searching for releases or scanning a barcode"
          icon="albums-outline"
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0a0a0a]">
      {/* Animated sync progress bar */}
      <SyncProgressBar
        progress={progress}
        visible={syncStatus === 'syncing' && totalItems > 0}
      />
      {syncStatus === 'syncing' && totalItems > 0 && (
        <View className="px-4 py-2">
          <Text className="text-[#a0a0a0] text-xs">
            Syncing {syncedItems} / {totalItems}
          </Text>
        </View>
      )}

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
}

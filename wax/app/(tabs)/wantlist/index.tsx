import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '@/lib/store/auth-store';
import { getWantlistPage, type CollectionRow } from '@/lib/db/queries';
import { syncWantlist, isWantlistSyncStale } from '@/lib/sync/wantlist-sync';
import ReleaseCard from '@/components/release-card';
import EmptyState from '@/components/empty-state';
import { SkeletonGrid } from '@/components/skeleton';
import { showToast } from '@/lib/store/toast-store';

const PAGE_SIZE = 50;

export default function WantlistScreen() {
  const username = useAuthStore((s) => s.username);

  const [items, setItems] = useState<CollectionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const hasSynced = useRef(false);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getWantlistPage(1, PAGE_SIZE);
      setItems(result.items);
      setTotal(result.total);
      setPage(1);
    } catch (error) {
      console.error('[Wantlist] Failed to load:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await getWantlistPage(nextPage, PAGE_SIZE);
      setItems((prev) => [...prev, ...result.items]);
      setTotal(result.total);
      setPage(nextPage);
    } catch (error) {
      console.error('[Wantlist] Failed to load more:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [items.length, total, page, loadingMore]);

  const handleRefresh = useCallback(async () => {
    if (!username) return;
    setRefreshing(true);
    try {
      await syncWantlist(username);
    } catch (error) {
      console.error('[Wantlist] Refresh sync error:', error);
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

  // Sync on first mount if data is stale (background)
  useEffect(() => {
    if (hasSynced.current || !username) return;
    hasSynced.current = true;

    (async () => {
      const stale = await isWantlistSyncStale();
      if (stale) {
        await syncWantlist(username);
        loadFirstPage();
      }
    })();
  }, [username, loadFirstPage]);

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

  if (loading) {
    return <SkeletonGrid />;
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 bg-[#0a0a0a]">
        <EmptyState
          title="Your wantlist is empty"
          subtitle="Browse releases and tap the heart to add"
          icon="heart-outline"
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0a0a0a]">
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

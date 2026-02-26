import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/lib/store/auth-store';
import { useUIStore, type SortBy } from '@/lib/store/ui-store';
import { getWantlistPage, type CollectionRow } from '@/lib/db/queries';
import { syncWantlist, isWantlistSyncStale } from '@/lib/sync/wantlist-sync';
import { useColors } from '@/lib/theme';
import ReleaseCard from '@/components/release-card';
import EmptyState from '@/components/empty-state';
import { SkeletonGrid } from '@/components/skeleton';
import { showToast } from '@/lib/store/toast-store';

const PAGE_SIZE = 50;

const SORT_OPTIONS: { key: SortBy; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'dateAdded', label: 'Recent', icon: 'time-outline' },
  { key: 'artist', label: 'Artist', icon: 'person-outline' },
  { key: 'title', label: 'Title', icon: 'text-outline' },
  { key: 'year', label: 'Year', icon: 'calendar-outline' },
];

export default function WantlistScreen() {
  const username = useAuthStore((s) => s.username);
  const sortBy = useUIStore((s) => s.sortBy);
  const setSortBy = useUIStore((s) => s.setSortBy);
  const c = useColors();

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
      const result = await getWantlistPage(1, PAGE_SIZE, sortBy);
      setItems(result.items);
      setTotal(result.total);
      setPage(1);
    } catch (error) {
      console.error('[Wantlist] Failed to load:', error);
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  const loadMore = useCallback(async () => {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await getWantlistPage(nextPage, PAGE_SIZE, sortBy);
      setItems((prev) => [...prev, ...result.items]);
      setTotal(result.total);
      setPage(nextPage);
    } catch (error) {
      console.error('[Wantlist] Failed to load more:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [items.length, total, page, loadingMore, sortBy]);

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

  useFocusEffect(
    useCallback(() => {
      loadFirstPage();
    }, [loadFirstPage])
  );

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
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }, [loadingMore, c.accent]);

  if (loading) {
    return <SkeletonGrid />;
  }

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <EmptyState
          title="Your wantlist is empty"
          subtitle="Browse releases and tap the heart to add"
          icon="heart-outline"
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Sort Picker */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => setSortBy(opt.key)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: sortBy === opt.key ? c.accent : c.card,
              gap: 4,
            }}
          >
            <Ionicons
              name={opt.icon}
              size={14}
              color={sortBy === opt.key ? '#fff' : c.textSecondary}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: sortBy === opt.key ? '#fff' : c.textSecondary,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

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

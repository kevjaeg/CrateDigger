import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api, type DiscogsSearchResult } from '@/lib/api/endpoints';
import { rateLimiter } from '@/lib/api/rate-limiter';
import { SkeletonSearchList } from '@/components/skeleton';

const BLURHASH = 'L6Pj0^jE.AyE_3t7t7R**0o#DgR4';
const DEBOUNCE_MS = 300;
const PER_PAGE = 20;
const FORMATS = ['Vinyl', 'CD', 'Cassette', 'Digital'] as const;

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Build base search params (without page — useInfiniteQuery manages that)
  const baseParams = useMemo(() => {
    if (!debouncedQuery) return null;
    const params: Record<string, string> = {
      q: debouncedQuery,
      type: 'release',
      per_page: String(PER_PAGE),
    };
    if (selectedFormat) params.format = selectedFormat;
    if (yearFrom) params.year = yearFrom;
    if (yearTo) params.year = yearTo;
    if (yearFrom && yearTo) params.year = `${yearFrom}-${yearTo}`;
    return params;
  }, [debouncedQuery, selectedFormat, yearFrom, yearTo]);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    error,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['search', baseParams],
    queryFn: ({ pageParam }) =>
      rateLimiter.schedule(
        () => api.search({ ...baseParams!, page: String(pageParam) }),
        1
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPageParam >= (lastPage.pagination?.pages ?? 0)) return undefined;
      return lastPageParam + 1;
    },
    enabled: !!baseParams,
    staleTime: 5 * 60 * 1000,
  });

  // Flatten all pages into a single results array
  const allResults = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data]
  );

  const loadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

  const toggleFormat = useCallback((format: string) => {
    setSelectedFormat((prev) => (prev === format ? null : format));
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setSelectedFormat(null);
    setYearFrom('');
    setYearTo('');
    inputRef.current?.focus();
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: DiscogsSearchResult }) => (
      <SearchResultRow item={item} />
    ),
    []
  );

  const keyExtractor = useCallback(
    (item: DiscogsSearchResult, index: number) => `${item.id}-${index}`,
    []
  );

  const hasQuery = debouncedQuery.length > 0;
  const hasResults = allResults.length > 0;
  const showEmpty = hasQuery && !isLoading && !hasResults && !error;

  return (
    <SafeAreaView className="flex-1 bg-[#0a0a0a]" edges={['top']}>
      {/* Search Input */}
      <View className="px-4 pt-2 pb-2">
        <View className="flex-row items-center bg-[#141414] rounded-xl px-3 h-12">
          <Ionicons name="search" size={18} color="#6b6b6b" />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search Discogs..."
            placeholderTextColor="#6b6b6b"
            className="flex-1 text-white text-base ml-2"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {query.length > 0 && (
            <Pressable onPress={clearSearch} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#6b6b6b" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Filter Pills */}
      <View className="px-4 pb-2">
        {/* Format Pills */}
        <View className="flex-row gap-2 mb-2">
          {FORMATS.map((format) => (
            <Pressable
              key={format}
              onPress={() => toggleFormat(format)}
              className={`px-3 py-1.5 rounded-full ${
                selectedFormat === format
                  ? 'bg-[#c4882a]'
                  : 'bg-[#1a1a1a]'
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  selectedFormat === format
                    ? 'text-white'
                    : 'text-[#a0a0a0]'
                }`}
              >
                {format}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Year Range */}
        <View className="flex-row items-center gap-2">
          <TextInput
            value={yearFrom}
            onChangeText={(t) => setYearFrom(t.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder="From"
            placeholderTextColor="#6b6b6b"
            keyboardType="number-pad"
            maxLength={4}
            className="bg-[#1a1a1a] text-white text-xs rounded-full px-3 py-1.5 w-16 text-center"
          />
          <Text className="text-[#6b6b6b] text-xs">{'\u2014'}</Text>
          <TextInput
            value={yearTo}
            onChangeText={(t) => setYearTo(t.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder="To"
            placeholderTextColor="#6b6b6b"
            keyboardType="number-pad"
            maxLength={4}
            className="bg-[#1a1a1a] text-white text-xs rounded-full px-3 py-1.5 w-16 text-center"
          />
          {(yearFrom || yearTo) && (
            <Pressable
              onPress={() => {
                setYearFrom('');
                setYearTo('');
              }}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={16} color="#6b6b6b" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Results / States */}
      {!hasQuery && (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="search" size={48} color="#2a2a2a" />
          <Text className="text-[#6b6b6b] text-base mt-4 text-center">
            Search for releases on Discogs
          </Text>
        </View>
      )}

      {hasQuery && isLoading && <SkeletonSearchList />}

      {error && !hasResults && (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="alert-circle-outline" size={48} color="#a0a0a0" />
          <Text className="text-[#a0a0a0] text-base mt-4 text-center">
            Search failed. Try again.
          </Text>
        </View>
      )}

      {showEmpty && (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="disc-outline" size={48} color="#2a2a2a" />
          <Text className="text-[#a0a0a0] text-base mt-4 text-center">
            No releases found
          </Text>
          <Text className="text-[#6b6b6b] text-sm mt-1 text-center">
            Try different keywords or filters
          </Text>
        </View>
      )}

      {hasResults && (
        <FlatList
          data={allResults}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator color="#c4882a" />
              </View>
            ) : error ? (
              <Pressable
                onPress={() => fetchNextPage()}
                className="py-4 items-center"
              >
                <Text className="text-[#a0a0a0] text-sm">
                  Failed to load more. Tap to retry.
                </Text>
              </Pressable>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

// --- Search Result Row ---

function SearchResultRow({ item }: { item: DiscogsSearchResult }) {
  return (
    <Pressable
      onPress={() => router.push(`/release/${item.id}`)}
      className="flex-row bg-[#141414] rounded-xl overflow-hidden mb-3 active:opacity-80"
    >
      <Image
        source={{ uri: item.thumb || item.cover_image }}
        placeholder={{ blurhash: BLURHASH }}
        contentFit="cover"
        transition={200}
        style={{ width: 80, height: 80 }}
      />
      <View className="flex-1 px-3 py-2 justify-center">
        <Text
          className="text-white text-sm font-semibold"
          numberOfLines={1}
        >
          {item.title}
        </Text>
        {item.year && (
          <Text className="text-[#a0a0a0] text-xs mt-0.5">{item.year}</Text>
        )}
        <View className="flex-row items-center mt-1 gap-2">
          {item.format?.slice(0, 2).map((f, i) => (
            <View key={`${f}-${i}`} className="bg-[#1a1a1a] px-2 py-0.5 rounded">
              <Text className="text-[#6b6b6b] text-[10px]">{f}</Text>
            </View>
          ))}
          {item.label?.slice(0, 1).map((l, i) => (
            <Text key={`${l}-${i}`} className="text-[#6b6b6b] text-xs" numberOfLines={1}>
              {l}
            </Text>
          ))}
        </View>
      </View>
      {item.community && (
        <View className="items-center justify-center pr-3">
          <Ionicons name="heart" size={12} color="#6b6b6b" />
          <Text className="text-[#6b6b6b] text-[10px] mt-0.5">
            {item.community.want}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

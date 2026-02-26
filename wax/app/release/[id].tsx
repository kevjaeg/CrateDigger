import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/endpoints';
import { rateLimiter } from '@/lib/api/rate-limiter';
import { useAuthStore } from '@/lib/store/auth-store';
import {
  getCollectionItemByRelease,
  isInWantlist,
  upsertCollectionItem,
  deleteCollectionItem,
  deleteWantlistItem,
} from '@/lib/db/queries';
import { SkeletonReleaseDetail } from '@/components/skeleton';
import { hapticSuccess, hapticWarning } from '@/lib/haptics';
import { showToast } from '@/lib/store/toast-store';
import { friendlyErrorMessage } from '@/lib/api/client';

const BLURHASH = 'L6Pj0^jE.AyE_3t7t7R**0o#DgR4';

export default function ReleaseDetailScreen() {
  const rawId = useLocalSearchParams<{ id: string }>().id;
  const releaseId = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  const isValidId = Number.isInteger(releaseId) && releaseId > 0;
  const { width } = useWindowDimensions();
  const username = useAuthStore((s) => s.username);

  // --- API data ---
  const {
    data: release,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['release', releaseId],
    queryFn: () => rateLimiter.schedule(() => api.getRelease(releaseId), 1),
    enabled: isValidId,
  });

  const { data: marketStats } = useQuery({
    queryKey: ['marketplace', releaseId],
    queryFn: () =>
      rateLimiter.schedule(() => api.getMarketplaceStats(releaseId), 1),
    enabled: isValidId,
  });

  // --- Local state from SQLite ---
  const [inCollection, setInCollection] = useState(false);
  const [instanceId, setInstanceId] = useState<number | null>(null);
  const [folderId, setFolderId] = useState<number>(1);
  const [inWantlist, setInWantlist] = useState(false);
  const [mutating, setMutating] = useState(false);

  useEffect(() => {
    if (!isValidId) return;
    // Reset before async reads to avoid stale state when navigating between releases
    setInCollection(false);
    setInstanceId(null);
    setFolderId(1);
    setInWantlist(false);
    getCollectionItemByRelease(releaseId).then((row) => {
      if (row) {
        setInCollection(true);
        setInstanceId(row.instance_id);
        setFolderId(row.folder_id);
      }
    });
    isInWantlist(releaseId).then(setInWantlist);
  }, [releaseId, isValidId]);

  // --- Mutations ---
  const toggleCollection = useCallback(async () => {
    if (!username || mutating) return;
    setMutating(true);
    try {
      if (inCollection && instanceId !== null) {
        await rateLimiter.schedule(
          () =>
            api.removeFromCollection(username, folderId, releaseId, instanceId),
          1
        );
        await deleteCollectionItem(instanceId);
        setInCollection(false);
        setInstanceId(null);
        hapticWarning();
      } else {
        if (!release) return;
        const result = await rateLimiter.schedule(
          () => api.addToCollection(username, 1, releaseId),
          1
        );
        await upsertCollectionItem({
          id: releaseId,
          instance_id: result.instance_id,
          folder_id: 1,
          rating: 0,
          date_added: new Date().toISOString(),
          basic_information: {
            id: releaseId,
            title: release.title,
            year: release.year,
            thumb: release.images?.[0]?.uri150 ?? '',
            cover_image: heroImage(release),
            genres: release.genres,
            styles: release.styles,
            formats: release.formats,
            labels: release.labels,
            artists: release.artists,
          },
        });
        setInCollection(true);
        setInstanceId(result.instance_id);
        setFolderId(1);
        hapticSuccess();
      }
    } catch (e) {
      console.error('[ReleaseDetail] Collection toggle failed:', e);
      showToast(friendlyErrorMessage(e));
    } finally {
      setMutating(false);
    }
  }, [username, mutating, inCollection, instanceId, folderId, releaseId, release]);

  const toggleWantlist = useCallback(async () => {
    if (!username || mutating) return;
    setMutating(true);
    try {
      if (inWantlist) {
        await rateLimiter.schedule(
          () => api.removeFromWantlist(username, releaseId),
          1
        );
        await deleteWantlistItem(releaseId);
        setInWantlist(false);
        hapticWarning();
      } else {
        await rateLimiter.schedule(
          () => api.addToWantlist(username, releaseId),
          1
        );
        setInWantlist(true);
        hapticSuccess();
      }
    } catch (e) {
      console.error('[ReleaseDetail] Wantlist toggle failed:', e);
      showToast(friendlyErrorMessage(e));
    } finally {
      setMutating(false);
    }
  }, [username, mutating, inWantlist, releaseId]);

  // --- Helpers ---
  const artistText = release?.artists.map((a) => a.name).join(', ') ?? '';
  const primaryImageUri = release ? heroImage(release) : '';
  const formatText = release?.formats
    .map((f) => [f.name, ...(f.descriptions ?? [])].join(' '))
    .join(', ');

  // --- Loading ---
  if (isLoading) {
    return (
      <>
        <HeaderRight uri={release?.uri} />
        <SkeletonReleaseDetail />
      </>
    );
  }

  // --- Error ---
  if (error || !release) {
    return (
      <>
        <HeaderRight uri={undefined} />
        <View className="flex-1 bg-[#0a0a0a] items-center justify-center px-6">
          <Ionicons name="alert-circle-outline" size={48} color="#a0a0a0" />
          <Text className="text-[#a0a0a0] text-base mt-4 text-center">
            Could not load this release.
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <HeaderRight uri={release.uri} />
      <ScrollView className="flex-1 bg-[#0a0a0a]">
        {/* Hero Cover Art */}
        <Image
          source={{ uri: primaryImageUri }}
          placeholder={{ blurhash: BLURHASH }}
          contentFit="cover"
          transition={300}
          style={{ width, height: width }}
        />

        {/* Title & Artist */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-white text-2xl font-bold">{release.title}</Text>
          <Text className="text-[#a0a0a0] text-base mt-1">{artistText}</Text>
        </View>

        {/* Metadata Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          className="py-2"
        >
          {release.year > 0 && <Pill label={String(release.year)} />}
          {release.country && <Pill label={release.country} />}
          {release.genres.map((g) => (
            <Pill key={g} label={g} />
          ))}
          {release.styles.map((s) => (
            <Pill key={s} label={s} accent />
          ))}
          {formatText && <Pill label={formatText} />}
        </ScrollView>

        {/* Community Stats */}
        <View className="flex-row px-4 py-3 gap-6">
          <StatBlock
            icon="people-outline"
            value={release.community.have}
            label="Have"
          />
          <StatBlock
            icon="heart-outline"
            value={release.community.want}
            label="Want"
          />
          <StatBlock
            icon="star-outline"
            value={release.community.rating.average.toFixed(1)}
            label={`${release.community.rating.count} ratings`}
          />
        </View>

        {/* Marketplace Price */}
        {(marketStats?.lowest_price || release.num_for_sale > 0) && (
          <View className="mx-4 p-4 bg-[#141414] rounded-xl mb-2">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[#a0a0a0] text-xs uppercase tracking-wider">
                  Marketplace
                </Text>
                {marketStats?.lowest_price ? (
                  <Text className="text-white text-lg font-semibold mt-1">
                    from {formatPrice(marketStats.lowest_price.value, marketStats.lowest_price.currency)}
                  </Text>
                ) : (
                  <Text className="text-white text-lg font-semibold mt-1">
                    --
                  </Text>
                )}
              </View>
              <Text className="text-[#a0a0a0] text-sm">
                {release.num_for_sale} for sale
              </Text>
            </View>
          </View>
        )}

        {/* Labels */}
        {release.labels.length > 0 && (
          <View className="px-4 py-3">
            <Text className="text-[#6b6b6b] text-xs uppercase tracking-wider mb-2">
              Label
            </Text>
            {release.labels.map((l, i) => (
              <View key={`${l.id}-${i}`} className="flex-row items-center mb-1">
                <Text className="text-white text-sm">{l.name}</Text>
                {l.catno && (
                  <Text className="text-[#a0a0a0] text-sm ml-2">
                    {l.catno}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Tracklist */}
        {release.tracklist.length > 0 && (
          <View className="px-4 py-3">
            <Text className="text-[#6b6b6b] text-xs uppercase tracking-wider mb-3">
              Tracklist
            </Text>
            {release.tracklist.map((track, i) => (
              <View
                key={`${track.position}-${i}`}
                className="flex-row items-center py-2 border-b border-[#1a1a1a]"
              >
                <Text className="text-[#6b6b6b] text-sm w-10">
                  {track.position}
                </Text>
                <Text className="text-white text-sm flex-1" numberOfLines={1}>
                  {track.title}
                </Text>
                {track.duration && (
                  <Text className="text-[#6b6b6b] text-sm ml-2">
                    {track.duration}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View className="px-4 py-4 gap-3">
          <Pressable
            onPress={toggleCollection}
            disabled={mutating}
            className={`rounded-2xl px-6 py-4 items-center flex-row justify-center gap-2 ${
              inCollection ? 'bg-[#2a2a2a]' : 'bg-[#c4882a]'
            } active:opacity-80`}
          >
            <Ionicons
              name={inCollection ? 'checkmark-circle' : 'add-circle-outline'}
              size={20}
              color="#fff"
            />
            <Text className="text-white text-base font-semibold">
              {inCollection ? 'In Collection' : 'Add to Collection'}
            </Text>
          </Pressable>

          <Pressable
            onPress={toggleWantlist}
            disabled={mutating}
            className={`rounded-2xl px-6 py-4 items-center flex-row justify-center gap-2 ${
              inWantlist ? 'bg-[#2a2a2a]' : 'bg-[#141414] border border-[#2a2a2a]'
            } active:opacity-80`}
          >
            <Ionicons
              name={inWantlist ? 'heart' : 'heart-outline'}
              size={20}
              color={inWantlist ? '#c4882a' : '#a0a0a0'}
            />
            <Text
              className={`text-base font-semibold ${
                inWantlist ? 'text-white' : 'text-[#a0a0a0]'
              }`}
            >
              {inWantlist ? 'On Wantlist' : 'Add to Wantlist'}
            </Text>
          </Pressable>
        </View>

        {/* Bottom Spacer */}
        <View className="h-12" />
      </ScrollView>
    </>
  );
}

// --- Sub-components ---

function HeaderRight({ uri }: { uri?: string }) {
  return (
    <Stack.Screen
      options={{
        headerRight: () =>
          uri ? (
            <Pressable
              onPress={() => Linking.openURL(uri)}
              className="mr-2 active:opacity-60"
              hitSlop={8}
            >
              <Ionicons name="open-outline" size={22} color="#a0a0a0" />
            </Pressable>
          ) : null,
      }}
    />
  );
}

function Pill({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <View
      className={`px-3 py-1.5 rounded-full ${
        accent ? 'bg-[#c4882a]/20' : 'bg-[#1a1a1a]'
      }`}
    >
      <Text
        className={`text-xs font-medium ${
          accent ? 'text-[#c4882a]' : 'text-[#a0a0a0]'
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

function StatBlock({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number | string;
  label: string;
}) {
  return (
    <View className="items-center">
      <Ionicons name={icon} size={18} color="#a0a0a0" />
      <Text className="text-white text-lg font-bold mt-1">{value}</Text>
      <Text className="text-[#6b6b6b] text-xs">{label}</Text>
    </View>
  );
}

// --- Utils ---

function heroImage(release: { images?: { type: string; uri: string }[] }) {
  if (!release.images?.length) return '';
  const img =
    release.images.find((i) => i.type === 'primary') ?? release.images[0];
  return img?.uri ?? '';
}

function formatPrice(value: number, currency: string): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '\u20AC', GBP: '\u00A3' };
  const sym = symbols[currency];
  if (sym) return `${sym}${value.toFixed(2)}`;
  return `${value.toFixed(2)} ${currency}`;
}

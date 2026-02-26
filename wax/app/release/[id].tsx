import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Linking,
  Share,
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
  upsertWantlistItem,
  deleteWantlistItem,
  updateCollectionRating,
} from '@/lib/db/queries';
import { SkeletonReleaseDetail } from '@/components/skeleton';
import { hapticSuccess, hapticWarning, hapticLight } from '@/lib/haptics';
import { showToast } from '@/lib/store/toast-store';
import { friendlyErrorMessage } from '@/lib/api/client';
import { useColors } from '@/lib/theme';

const BLURHASH = 'L6Pj0^jE.AyE_3t7t7R**0o#DgR4';

export default function ReleaseDetailScreen() {
  const rawId = useLocalSearchParams<{ id: string }>().id;
  const releaseId = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  const isValidId = Number.isInteger(releaseId) && releaseId > 0;
  const { width } = useWindowDimensions();
  const username = useAuthStore((s) => s.username);
  const c = useColors();

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
  const [userRating, setUserRating] = useState(0);
  const [mutating, setMutating] = useState(false);

  useEffect(() => {
    if (!isValidId) return;
    setInCollection(false);
    setInstanceId(null);
    setFolderId(1);
    setInWantlist(false);
    setUserRating(0);
    getCollectionItemByRelease(releaseId).then((row) => {
      if (row) {
        setInCollection(true);
        setInstanceId(row.instance_id);
        setFolderId(row.folder_id);
        setUserRating(row.rating);
      }
    });
    isInWantlist(releaseId).then(setInWantlist);
  }, [releaseId, isValidId]);

  // --- Rating ---
  const handleRate = useCallback(async (stars: number) => {
    if (!username || !inCollection || instanceId === null || mutating) return;
    const newRating = stars === userRating ? 0 : stars; // tap same star to clear
    setUserRating(newRating);
    hapticLight();
    try {
      await rateLimiter.schedule(
        () => api.editCollectionItemFields(username, folderId, releaseId, instanceId, { rating: newRating }),
        1
      );
      await updateCollectionRating(instanceId, newRating);
    } catch (e) {
      console.error('[ReleaseDetail] Rating failed:', e);
      showToast(friendlyErrorMessage(e));
      setUserRating(userRating); // revert
    }
  }, [username, inCollection, instanceId, folderId, releaseId, userRating, mutating]);

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
        setUserRating(0);
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
        if (!release) return;
        await rateLimiter.schedule(
          () => api.addToWantlist(username, releaseId),
          1
        );
        await upsertWantlistItem({
          id: releaseId,
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
        setInWantlist(true);
        hapticSuccess();
      }
    } catch (e) {
      console.error('[ReleaseDetail] Wantlist toggle failed:', e);
      showToast(friendlyErrorMessage(e));
    } finally {
      setMutating(false);
    }
  }, [username, mutating, inWantlist, releaseId, release]);

  // --- Helpers ---
  const artistText = release?.artists.map((a) => a.name).join(', ') ?? '';
  const primaryImageUri = release ? heroImage(release) : '';
  const formatText = release?.formats
    .map((f) => [f.name, ...(f.descriptions ?? [])].join(' '))
    .join(', ');

  // --- Share ---
  const handleShare = useCallback(async () => {
    if (!release) return;
    try {
      await Share.share({
        message: `${release.title} by ${artistText}\n${release.uri}`,
        title: release.title,
      });
    } catch (_) {
      // user cancelled
    }
  }, [release, artistText]);

  // --- Loading ---
  if (isLoading) {
    return (
      <>
        <HeaderRight uri={undefined} onShare={undefined} />
        <SkeletonReleaseDetail />
      </>
    );
  }

  // --- Error ---
  if (error || !release) {
    return (
      <>
        <HeaderRight uri={undefined} onShare={undefined} />
        <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Ionicons name="alert-circle-outline" size={48} color={c.textSecondary} />
          <Text style={{ color: c.textSecondary, fontSize: 16, marginTop: 16, textAlign: 'center' }}>
            Could not load this release.
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <HeaderRight uri={release.uri} onShare={handleShare} />
      <ScrollView style={{ flex: 1, backgroundColor: c.bg }}>
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
          <Text style={{ color: c.text, fontSize: 24, fontWeight: 'bold' }}>{release.title}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 16, marginTop: 4 }}>{artistText}</Text>
        </View>

        {/* Rating (only when in collection) */}
        {inCollection && (
          <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', gap: 8 }}>
            <Text style={{ color: c.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
              Your Rating
            </Text>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => handleRate(star)} hitSlop={6}>
                  <Ionicons
                    name={star <= userRating ? 'star' : 'star-outline'}
                    size={22}
                    color={star <= userRating ? c.accent : c.textMuted}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Metadata Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          className="py-2"
        >
          {release.year > 0 && <Pill label={String(release.year)} c={c} />}
          {release.country && <Pill label={release.country} c={c} />}
          {release.genres.map((g) => (
            <Pill key={g} label={g} c={c} />
          ))}
          {release.styles.map((s) => (
            <Pill key={s} label={s} accent c={c} />
          ))}
          {formatText && <Pill label={formatText} c={c} />}
        </ScrollView>

        {/* Community Stats */}
        <View className="flex-row px-4 py-3 gap-6">
          <StatBlock icon="people-outline" value={release.community.have} label="Have" c={c} />
          <StatBlock icon="heart-outline" value={release.community.want} label="Want" c={c} />
          <StatBlock
            icon="star-outline"
            value={release.community.rating.average.toFixed(1)}
            label={`${release.community.rating.count} ratings`}
            c={c}
          />
        </View>

        {/* Marketplace Price */}
        {(marketStats?.lowest_price || release.num_for_sale > 0) && (
          <View style={{ marginHorizontal: 16, padding: 16, backgroundColor: c.card, borderRadius: 12, marginBottom: 8 }}>
            <View className="flex-row items-center justify-between">
              <View>
                <Text style={{ color: c.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Marketplace
                </Text>
                {marketStats?.lowest_price ? (
                  <Text style={{ color: c.text, fontSize: 18, fontWeight: '600', marginTop: 4 }}>
                    from {formatPrice(marketStats.lowest_price.value, marketStats.lowest_price.currency)}
                  </Text>
                ) : (
                  <Text style={{ color: c.text, fontSize: 18, fontWeight: '600', marginTop: 4 }}>--</Text>
                )}
              </View>
              <Text style={{ color: c.textSecondary, fontSize: 14 }}>
                {release.num_for_sale} for sale
              </Text>
            </View>
          </View>
        )}

        {/* Labels */}
        {release.labels.length > 0 && (
          <View className="px-4 py-3">
            <Text style={{ color: c.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Label
            </Text>
            {release.labels.map((l, i) => (
              <View key={`${l.id}-${i}`} className="flex-row items-center mb-1">
                <Text style={{ color: c.text, fontSize: 14 }}>{l.name}</Text>
                {l.catno && (
                  <Text style={{ color: c.textSecondary, fontSize: 14, marginLeft: 8 }}>
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
            <Text style={{ color: c.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Tracklist
            </Text>
            {release.tracklist.map((track, i) => (
              <View
                key={`${track.position}-${i}`}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.cardAlt }}
              >
                <Text style={{ color: c.textMuted, fontSize: 14, width: 40 }}>
                  {track.position}
                </Text>
                <Text style={{ color: c.text, fontSize: 14, flex: 1 }} numberOfLines={1}>
                  {track.title}
                </Text>
                {track.duration && (
                  <Text style={{ color: c.textMuted, fontSize: 14, marginLeft: 8 }}>
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
            style={{
              borderRadius: 16,
              paddingHorizontal: 24,
              paddingVertical: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: inCollection ? c.border : c.accent,
              opacity: mutating ? 0.6 : 1,
            }}
          >
            <Ionicons
              name={inCollection ? 'checkmark-circle' : 'add-circle-outline'}
              size={20}
              color="#fff"
            />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              {inCollection ? 'In Collection' : 'Add to Collection'}
            </Text>
          </Pressable>

          <Pressable
            onPress={toggleWantlist}
            disabled={mutating}
            style={{
              borderRadius: 16,
              paddingHorizontal: 24,
              paddingVertical: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: inWantlist ? c.border : c.card,
              borderWidth: inWantlist ? 0 : 1,
              borderColor: c.border,
              opacity: mutating ? 0.6 : 1,
            }}
          >
            <Ionicons
              name={inWantlist ? 'heart' : 'heart-outline'}
              size={20}
              color={inWantlist ? c.accent : c.textSecondary}
            />
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: inWantlist ? c.text : c.textSecondary,
              }}
            >
              {inWantlist ? 'On Wantlist' : 'Add to Wantlist'}
            </Text>
          </Pressable>
        </View>

        <View className="h-12" />
      </ScrollView>
    </>
  );
}

// --- Sub-components ---

function HeaderRight({ uri, onShare }: { uri?: string; onShare?: (() => void) | undefined }) {
  return (
    <Stack.Screen
      options={{
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: 12, marginRight: 8 }}>
            {onShare && (
              <Pressable onPress={onShare} hitSlop={8} style={{ opacity: 0.8 }}>
                <Ionicons name="share-outline" size={22} color="#a0a0a0" />
              </Pressable>
            )}
            {uri && (
              <Pressable
                onPress={() => Linking.openURL(uri)}
                hitSlop={8}
                style={{ opacity: 0.8 }}
              >
                <Ionicons name="open-outline" size={22} color="#a0a0a0" />
              </Pressable>
            )}
          </View>
        ),
      }}
    />
  );
}

function Pill({ label, accent, c }: { label: string; accent?: boolean; c: ReturnType<typeof useColors> }) {
  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: accent ? c.accentMuted : c.cardAlt,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '500',
          color: accent ? c.accent : c.textSecondary,
        }}
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
  c,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number | string;
  label: string;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <View className="items-center">
      <Ionicons name={icon} size={18} color={c.textSecondary} />
      <Text style={{ color: c.text, fontSize: 18, fontWeight: 'bold', marginTop: 4 }}>{value}</Text>
      <Text style={{ color: c.textMuted, fontSize: 12 }}>{label}</Text>
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

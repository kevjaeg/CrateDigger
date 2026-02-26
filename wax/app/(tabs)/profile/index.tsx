import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/lib/store/auth-store';
import { api, type DiscogsCollectionValue } from '@/lib/api/endpoints';
import { rateLimiter } from '@/lib/api/rate-limiter';
import { clearStoredAuth } from '@/lib/api/client';
import { getCachedStats } from '@/lib/db/queries';
import type { CollectionStats } from '@/lib/sync/stats-computer';

const BLURHASH = 'L6Pj0^jE.AyE_3t7t7R**0o#DgR4';

export default function ProfileScreen() {
  const username = useAuthStore((s) => s.username);
  const avatarUrl = useAuthStore((s) => s.avatarUrl);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [collectionValue, setCollectionValue] =
    useState<DiscogsCollectionValue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    // Load local stats independently from API call
    getCachedStats('collection_stats')
      .then((cached) => {
        if (!cancelled && cached) setStats(cached as CollectionStats);
      })
      .catch((e) => console.error('[Profile] Stats load failed:', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Fetch collection value from API independently
    rateLimiter
      .schedule(() => api.getCollectionValue(username), 2)
      .then((value) => {
        if (!cancelled) setCollectionValue(value);
      })
      .catch((e) => console.error('[Profile] Collection value failed:', e));

    return () => {
      cancelled = true;
    };
  }, [username]);

  const handleLogout = useCallback(() => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await clearStoredAuth();
          clearAuth();
        },
      },
    ]);
  }, [clearAuth]);

  if (loading && !stats) {
    return (
      <View className="flex-1 bg-[#0a0a0a] items-center justify-center">
        <ActivityIndicator size="large" color="#c4882a" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-[#0a0a0a]">
      {/* Profile Header */}
      <View className="items-center pt-8 pb-6 px-4">
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            placeholder={{ blurhash: BLURHASH }}
            contentFit="cover"
            transition={200}
            style={{ width: 80, height: 80, borderRadius: 40 }}
          />
        ) : (
          <View className="w-20 h-20 rounded-full bg-[#141414] items-center justify-center">
            <Ionicons name="person" size={36} color="#6b6b6b" />
          </View>
        )}
        <Text className="text-white text-xl font-bold mt-3">{username}</Text>
      </View>

      {/* Collection Value */}
      {collectionValue && (
        <View className="mx-4 p-4 bg-[#141414] rounded-xl mb-4">
          <Text className="text-[#6b6b6b] text-xs uppercase tracking-wider mb-3">
            Collection Value
          </Text>
          <View className="flex-row justify-between">
            <ValueBlock label="Min" value={collectionValue.minimum} />
            <ValueBlock label="Median" value={collectionValue.median} />
            <ValueBlock label="Max" value={collectionValue.maximum} />
          </View>
        </View>
      )}

      {/* Quick Stats */}
      {stats && (
        <View className="flex-row mx-4 mb-4 gap-3">
          <View className="flex-1 bg-[#141414] rounded-xl p-4 items-center">
            <Text className="text-white text-2xl font-bold">
              {stats.totalRecords}
            </Text>
            <Text className="text-[#6b6b6b] text-xs mt-1">Records</Text>
          </View>
          {stats.oldestRecord && (
            <View className="flex-1 bg-[#141414] rounded-xl p-4 items-center">
              <Text className="text-white text-2xl font-bold">
                {stats.oldestRecord.year}
              </Text>
              <Text className="text-[#6b6b6b] text-xs mt-1">Oldest</Text>
            </View>
          )}
          {stats.newestRecord && (
            <View className="flex-1 bg-[#141414] rounded-xl p-4 items-center">
              <Text className="text-white text-2xl font-bold">
                {stats.newestRecord.year}
              </Text>
              <Text className="text-[#6b6b6b] text-xs mt-1">Newest</Text>
            </View>
          )}
        </View>
      )}

      {/* Genre Breakdown */}
      {stats && stats.genres.length > 0 && (
        <StatsSection title="Genres">
          {stats.genres.map((g) => (
            <HorizontalBar
              key={g.genre}
              label={g.genre}
              count={g.count}
              percentage={g.percentage}
              color="#c4882a"
            />
          ))}
        </StatsSection>
      )}

      {/* Decade Distribution */}
      {stats && stats.decades.length > 0 && (
        <StatsSection title="Decades">
          {stats.decades.map((d) => (
            <HorizontalBar
              key={d.decade}
              label={d.decade}
              count={d.count}
              percentage={d.percentage}
              color="#6b8fbd"
            />
          ))}
        </StatsSection>
      )}

      {/* Top Labels */}
      {stats && stats.topLabels.length > 0 && (
        <StatsSection title="Top Labels">
          {stats.topLabels.map((l, i) => (
            <View
              key={l.label}
              className="flex-row items-center py-2 border-b border-[#1a1a1a]"
            >
              <Text className="text-[#6b6b6b] text-sm w-8">{i + 1}</Text>
              <Text className="text-white text-sm flex-1" numberOfLines={1}>
                {l.label}
              </Text>
              <Text className="text-[#6b6b6b] text-sm">{l.count}</Text>
            </View>
          ))}
        </StatsSection>
      )}

      {/* Format Breakdown */}
      {stats && stats.formats.length > 0 && (
        <StatsSection title="Formats">
          {stats.formats.map((f) => (
            <HorizontalBar
              key={f.format}
              label={f.format}
              count={f.count}
              percentage={f.percentage}
              color="#8b6fad"
            />
          ))}
        </StatsSection>
      )}

      {/* Collection Growth */}
      {stats && stats.growth.length > 1 && (
        <StatsSection title="Growth">
          <GrowthChart data={stats.growth} />
        </StatsSection>
      )}

      {/* Settings */}
      <View className="mx-4 mt-4 mb-2">
        <Text className="text-[#6b6b6b] text-xs uppercase tracking-wider mb-3">
          Settings
        </Text>
      </View>

      <View className="mx-4 bg-[#141414] rounded-xl overflow-hidden mb-4">
        <SettingsRow
          icon="log-out-outline"
          label="Log Out"
          onPress={handleLogout}
          destructive
        />
      </View>

      {/* Attribution */}
      <View className="items-center pb-12 px-4">
        <Text className="text-[#6b6b6b] text-xs text-center">
          Powered by the Discogs API
        </Text>
        <Text className="text-[#6b6b6b] text-xs text-center mt-1">
          Wax is not affiliated with Discogs
        </Text>
      </View>
    </ScrollView>
  );
}

// --- Sub-components ---

function ValueBlock({ label, value }: { label: string; value: string }) {
  return (
    <View className="items-center flex-1">
      <Text className="text-white text-base font-semibold">{value}</Text>
      <Text className="text-[#6b6b6b] text-xs mt-0.5">{label}</Text>
    </View>
  );
}

function StatsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mx-4 mb-4">
      <Text className="text-[#6b6b6b] text-xs uppercase tracking-wider mb-3">
        {title}
      </Text>
      <View className="bg-[#141414] rounded-xl p-4">{children}</View>
    </View>
  );
}

function HorizontalBar({
  label,
  count,
  percentage,
  color,
}: {
  label: string;
  count: number;
  percentage: number;
  color: string;
}) {
  return (
    <View className="mb-3">
      <View className="flex-row justify-between mb-1">
        <Text className="text-white text-sm" numberOfLines={1}>
          {label}
        </Text>
        <Text className="text-[#6b6b6b] text-xs ml-2">
          {count} ({Math.round(percentage)}%)
        </Text>
      </View>
      <View className="h-2 bg-[#0a0a0a] rounded-full overflow-hidden">
        <View
          className="h-2 rounded-full"
          style={{
            width: `${Math.max(percentage, 2)}%`,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

function GrowthChart({
  data,
}: {
  data: { month: string; count: number; cumulative: number }[];
}) {
  const totalRecords = data[data.length - 1]?.cumulative ?? 1;
  // Show last 12 months max
  const recent = data.slice(-12);
  const maxMonthlyCount = Math.max(...recent.map((d) => d.count), 1);

  return (
    <View>
      <View className="flex-row items-end gap-1" style={{ height: 80 }}>
        {recent.map((item) => {
          const height = Math.max((item.count / maxMonthlyCount) * 80, 4);
          return (
            <View
              key={item.month}
              className="flex-1 rounded-t"
              style={{
                height: Math.min(height, 80),
                backgroundColor: '#c4882a',
              }}
            />
          );
        })}
      </View>
      <View className="flex-row justify-between mt-2">
        <Text className="text-[#6b6b6b] text-[10px]">
          {recent[0]?.month}
        </Text>
        <Text className="text-[#6b6b6b] text-[10px]">
          {recent[recent.length - 1]?.month}
        </Text>
      </View>
      <Text className="text-[#6b6b6b] text-xs mt-2 text-center">
        {totalRecords} total records
      </Text>
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3.5 active:bg-[#1a1a1a]"
    >
      <Ionicons
        name={icon}
        size={20}
        color={destructive ? '#ef4444' : '#a0a0a0'}
      />
      <Text
        className={`text-base ml-3 ${
          destructive ? 'text-red-400' : 'text-white'
        }`}
      >
        {label}
      </Text>
      <View className="flex-1" />
      <Ionicons name="chevron-forward" size={16} color="#2a2a2a" />
    </Pressable>
  );
}

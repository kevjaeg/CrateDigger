import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/lib/store/auth-store';
import { useUIStore, type ColorScheme } from '@/lib/store/ui-store';
import { api, type DiscogsCollectionValue } from '@/lib/api/endpoints';
import { rateLimiter } from '@/lib/api/rate-limiter';
import { clearStoredAuth } from '@/lib/api/client';
import { getCachedStats } from '@/lib/db/queries';
import type { CollectionStats } from '@/lib/sync/stats-computer';
import { useColors } from '@/lib/theme';
import { SkeletonProfile } from '@/components/skeleton';

const BLURHASH = 'L6Pj0^jE.AyE_3t7t7R**0o#DgR4';

const THEME_OPTIONS: { key: ColorScheme; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

export default function ProfileScreen() {
  const username = useAuthStore((s) => s.username);
  const avatarUrl = useAuthStore((s) => s.avatarUrl);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const colorScheme = useUIStore((s) => s.colorScheme);
  const setColorScheme = useUIStore((s) => s.setColorScheme);
  const c = useColors();

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

    getCachedStats('collection_stats')
      .then((cached) => {
        if (!cancelled && cached) setStats(cached as CollectionStats);
      })
      .catch((e) => console.error('[Profile] Stats load failed:', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

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
    return <SkeletonProfile />;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }}>
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
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person" size={36} color={c.textMuted} />
          </View>
        )}
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold', marginTop: 12 }}>{username}</Text>
      </View>

      {/* Collection Value */}
      {collectionValue && (
        <View style={{ marginHorizontal: 16, padding: 16, backgroundColor: c.card, borderRadius: 12, marginBottom: 16 }}>
          <Text style={{ color: c.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Collection Value
          </Text>
          <View className="flex-row justify-between">
            <ValueBlock label="Min" value={collectionValue.minimum} c={c} />
            <ValueBlock label="Median" value={collectionValue.median} c={c} />
            <ValueBlock label="Max" value={collectionValue.maximum} c={c} />
          </View>
        </View>
      )}

      {/* Quick Stats */}
      {stats && (
        <View className="flex-row mx-4 mb-4 gap-3">
          <View style={{ flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 16, alignItems: 'center' }}>
            <Text style={{ color: c.text, fontSize: 24, fontWeight: 'bold' }}>
              {stats.totalRecords}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>Records</Text>
          </View>
          {stats.oldestRecord && (
            <View style={{ flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 16, alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 24, fontWeight: 'bold' }}>
                {stats.oldestRecord.year}
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>Oldest</Text>
            </View>
          )}
          {stats.newestRecord && (
            <View style={{ flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 16, alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 24, fontWeight: 'bold' }}>
                {stats.newestRecord.year}
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>Newest</Text>
            </View>
          )}
        </View>
      )}

      {/* Genre Breakdown */}
      {stats && stats.genres.length > 0 && (
        <StatsSection title="Genres" c={c}>
          {stats.genres.map((g) => (
            <HorizontalBar key={g.genre} label={g.genre} count={g.count} percentage={g.percentage} color="#c4882a" c={c} />
          ))}
        </StatsSection>
      )}

      {/* Decade Distribution */}
      {stats && stats.decades.length > 0 && (
        <StatsSection title="Decades" c={c}>
          {stats.decades.map((d) => (
            <HorizontalBar key={d.decade} label={d.decade} count={d.count} percentage={d.percentage} color="#6b8fbd" c={c} />
          ))}
        </StatsSection>
      )}

      {/* Top Labels */}
      {stats && stats.topLabels.length > 0 && (
        <StatsSection title="Top Labels" c={c}>
          {stats.topLabels.map((l, i) => (
            <View
              key={l.label}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.cardAlt }}
            >
              <Text style={{ color: c.textMuted, fontSize: 14, width: 32 }}>{i + 1}</Text>
              <Text style={{ color: c.text, fontSize: 14, flex: 1 }} numberOfLines={1}>
                {l.label}
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 14 }}>{l.count}</Text>
            </View>
          ))}
        </StatsSection>
      )}

      {/* Format Breakdown */}
      {stats && stats.formats.length > 0 && (
        <StatsSection title="Formats" c={c}>
          {stats.formats.map((f) => (
            <HorizontalBar key={f.format} label={f.format} count={f.count} percentage={f.percentage} color="#8b6fad" c={c} />
          ))}
        </StatsSection>
      )}

      {/* Collection Growth */}
      {stats && stats.growth.length > 1 && (
        <StatsSection title="Growth" c={c}>
          <GrowthChart data={stats.growth} c={c} />
        </StatsSection>
      )}

      {/* Theme Toggle */}
      <View className="mx-4 mt-4 mb-2">
        <Text style={{ color: c.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Appearance
        </Text>
      </View>
      <View style={{ marginHorizontal: 16, flexDirection: 'row', backgroundColor: c.card, borderRadius: 12, padding: 4, marginBottom: 16 }}>
        {THEME_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => setColorScheme(opt.key)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
              borderRadius: 8,
              gap: 6,
              backgroundColor: colorScheme === opt.key ? c.accent : 'transparent',
            }}
          >
            <Ionicons
              name={opt.icon}
              size={16}
              color={colorScheme === opt.key ? '#fff' : c.textSecondary}
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: colorScheme === opt.key ? '#fff' : c.textSecondary,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Settings */}
      <View className="mx-4 mt-2 mb-2">
        <Text style={{ color: c.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Settings
        </Text>
      </View>

      <View style={{ marginHorizontal: 16, backgroundColor: c.card, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        <SettingsRow icon="log-out-outline" label="Log Out" onPress={handleLogout} destructive c={c} />
      </View>

      {/* Attribution */}
      <View className="items-center pb-12 px-4">
        <Text style={{ color: c.textMuted, fontSize: 12, textAlign: 'center' }}>
          Powered by the Discogs API
        </Text>
        <Text style={{ color: c.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
          Wax is not affiliated with Discogs
        </Text>
      </View>
    </ScrollView>
  );
}

// --- Sub-components ---

function ValueBlock({ label, value, c }: { label: string; value: string; c: ReturnType<typeof useColors> }) {
  return (
    <View className="items-center flex-1">
      <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>{value}</Text>
      <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function StatsSection({ title, children, c }: { title: string; children: React.ReactNode; c: ReturnType<typeof useColors> }) {
  return (
    <View className="mx-4 mb-4">
      <Text style={{ color: c.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
        {title}
      </Text>
      <View style={{ backgroundColor: c.card, borderRadius: 12, padding: 16 }}>{children}</View>
    </View>
  );
}

function HorizontalBar({ label, count, percentage, color, c }: { label: string; count: number; percentage: number; color: string; c: ReturnType<typeof useColors> }) {
  return (
    <View className="mb-3">
      <View className="flex-row justify-between mb-1">
        <Text style={{ color: c.text, fontSize: 14 }} numberOfLines={1}>{label}</Text>
        <Text style={{ color: c.textMuted, fontSize: 12, marginLeft: 8 }}>
          {count} ({Math.round(percentage)}%)
        </Text>
      </View>
      <View style={{ height: 8, backgroundColor: c.bg, borderRadius: 999, overflow: 'hidden' }}>
        <View
          style={{
            height: 8,
            borderRadius: 999,
            width: `${Math.max(percentage, 2)}%`,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

function GrowthChart({ data, c }: { data: { month: string; count: number; cumulative: number }[]; c: ReturnType<typeof useColors> }) {
  const totalRecords = data[data.length - 1]?.cumulative ?? 1;
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
              style={{ height: Math.min(height, 80), backgroundColor: c.accent }}
            />
          );
        })}
      </View>
      <View className="flex-row justify-between mt-2">
        <Text style={{ color: c.textMuted, fontSize: 10 }}>{recent[0]?.month}</Text>
        <Text style={{ color: c.textMuted, fontSize: 10 }}>{recent[recent.length - 1]?.month}</Text>
      </View>
      <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 8, textAlign: 'center' }}>
        {totalRecords} total records
      </Text>
    </View>
  );
}

function SettingsRow({ icon, label, onPress, destructive, c }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; destructive?: boolean; c: ReturnType<typeof useColors> }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}
    >
      <Ionicons name={icon} size={20} color={destructive ? c.danger : c.textSecondary} />
      <Text style={{ fontSize: 16, marginLeft: 12, color: destructive ? c.danger : c.text, flex: 1 }}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={c.border} />
    </Pressable>
  );
}

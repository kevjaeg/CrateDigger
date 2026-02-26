import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, type DiscogsSearchResult } from '@/lib/api/endpoints';
import { rateLimiter } from '@/lib/api/rate-limiter';
import { useAuthStore } from '@/lib/store/auth-store';
import { upsertCollectionItem } from '@/lib/db/queries';
import { hapticSuccess, hapticLight } from '@/lib/haptics';

const BLURHASH = 'L6Pj0^jE.AyE_3t7t7R**0o#DgR4';

type ScanState =
  | { status: 'idle' }
  | { status: 'searching'; barcode: string }
  | { status: 'found'; barcode: string; results: DiscogsSearchResult[] }
  | { status: 'not_found'; barcode: string }
  | { status: 'error'; barcode: string };

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>({ status: 'idle' });
  const [addingId, setAddingId] = useState<number | null>(null);
  const username = useAuthStore((s) => s.username);
  const scanLockedRef = useRef(false);
  const { bottom } = useSafeAreaInsets();

  const handleBarcode = useCallback(
    async (scanResult: { type: string; data: string }) => {
      if (scanLockedRef.current) return;
      scanLockedRef.current = true;
      hapticLight();

      const code = scanResult.data;
      setScanState({ status: 'searching', barcode: code });
      try {
        const response = await rateLimiter.schedule(
          () => api.searchByBarcode(code),
          1
        );
        if (response.results.length > 0) {
          setScanState({ status: 'found', barcode: code, results: response.results });
        } else {
          setScanState({ status: 'not_found', barcode: code });
        }
      } catch {
        setScanState({ status: 'error', barcode: code });
      }
    },
    []
  );

  const dismissOverlay = useCallback(() => {
    scanLockedRef.current = false;
    setScanState({ status: 'idle' });
    setAddingId(null);
  }, []);

  const addToCollection = useCallback(
    async (item: DiscogsSearchResult) => {
      if (!username || addingId !== null) return;
      setAddingId(item.id);
      try {
        const result = await rateLimiter.schedule(
          () => api.addToCollection(username, 1, item.id),
          1
        );
        const release = await rateLimiter.schedule(
          () => api.getRelease(item.id),
          1
        );
        await upsertCollectionItem({
          id: item.id,
          instance_id: result.instance_id,
          folder_id: 1,
          rating: 0,
          date_added: new Date().toISOString(),
          basic_information: {
            id: item.id,
            title: release.title,
            year: release.year,
            thumb: release.images?.[0]?.uri150 ?? '',
            cover_image: release.images?.[0]?.uri ?? '',
            genres: release.genres ?? [],
            styles: release.styles ?? [],
            formats: release.formats ?? [],
            labels: release.labels ?? [],
            artists: release.artists ?? [],
          },
        });
        hapticSuccess();
        // Reset state before navigating so scanner is ready on back-navigation
        scanLockedRef.current = false;
        setScanState({ status: 'idle' });
        setAddingId(null);
        router.push(`/release/${item.id}`);
      } catch (e) {
        console.error('[Scan] Add to collection failed:', e);
        setAddingId(null);
      }
    },
    [username, addingId]
  );

  // --- Permission states ---
  if (!permission) {
    return (
      <View className="flex-1 bg-[#0a0a0a] items-center justify-center">
        <ActivityIndicator size="large" color="#c4882a" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-[#0a0a0a] items-center justify-center px-8">
        <Ionicons name="camera-outline" size={64} color="#2a2a2a" />
        <Text className="text-white text-lg font-semibold mt-6 text-center">
          Camera Access Needed
        </Text>
        <Text className="text-[#a0a0a0] text-sm mt-2 text-center">
          Wax needs camera access to scan barcodes on your records
        </Text>
        <Pressable
          onPress={requestPermission}
          className="bg-[#c4882a] rounded-2xl px-8 py-4 mt-6 active:opacity-80"
        >
          <Text className="text-white text-base font-semibold">
            Allow Camera
          </Text>
        </Pressable>
      </View>
    );
  }

  const isScanning = scanState.status === 'idle';

  return (
    <View className="flex-1 bg-black">
      {/* Camera */}
      <CameraView
        facing="back"
        onBarcodeScanned={isScanning ? handleBarcode : undefined}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
        }}
        style={{ flex: 1 }}
      />

      {/* Scan Reticle — only when idle */}
      {isScanning && (
        <View className="absolute inset-0 items-center justify-center">
          <View className="w-64 h-40 border-2 border-white/30 rounded-2xl" />
          <Text className="text-white/60 text-sm mt-4">
            Point at a barcode
          </Text>
        </View>
      )}

      {/* Searching Indicator */}
      {scanState.status === 'searching' && (
        <View className="absolute inset-0 items-center justify-center bg-black/40">
          <ActivityIndicator size="large" color="#c4882a" />
          <Text className="text-white text-sm mt-3">
            Looking up barcode...
          </Text>
        </View>
      )}

      {/* Result Overlay */}
      {(scanState.status === 'found' ||
        scanState.status === 'not_found' ||
        scanState.status === 'error') && (
        <View
          className="absolute bottom-0 left-0 right-0 bg-[#0a0a0a] rounded-t-3xl pt-3 max-h-[60%]"
          style={{ paddingBottom: Math.max(bottom, 16) }}
        >
          {/* Handle + Close */}
          <View className="flex-row items-center justify-between px-4 mb-2">
            <View className="w-10 h-1 bg-[#2a2a2a] rounded-full mx-auto" />
            <Pressable
              onPress={dismissOverlay}
              className="absolute right-4 active:opacity-60"
              hitSlop={12}
            >
              <Ionicons name="close" size={24} color="#a0a0a0" />
            </Pressable>
          </View>

          {/* Barcode label */}
          <Text className="text-[#6b6b6b] text-xs px-4 mb-3">
            Barcode: {scanState.barcode}
          </Text>

          {/* Found results */}
          {scanState.status === 'found' && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            >
              {scanState.results.map((item, i) => (
                <View
                  key={`${item.id}-${i}`}
                  className="flex-row bg-[#141414] rounded-xl overflow-hidden mb-3"
                >
                  <Pressable
                    className="flex-row flex-1 active:opacity-80"
                    onPress={() => router.push(`/release/${item.id}`)}
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
                        <Text className="text-[#a0a0a0] text-xs mt-0.5">
                          {item.year}
                        </Text>
                      )}
                      {item.format && (
                        <Text className="text-[#6b6b6b] text-xs mt-0.5" numberOfLines={1}>
                          {item.format.slice(0, 2).join(', ')}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => addToCollection(item)}
                    disabled={addingId === item.id}
                    className="items-center justify-center px-4 active:opacity-60"
                  >
                    {addingId === item.id ? (
                      <ActivityIndicator size="small" color="#c4882a" />
                    ) : (
                      <Ionicons name="add-circle" size={28} color="#c4882a" />
                    )}
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Not found */}
          {scanState.status === 'not_found' && (
            <View className="items-center py-6 px-4">
              <Ionicons name="disc-outline" size={40} color="#2a2a2a" />
              <Text className="text-[#a0a0a0] text-base mt-3 text-center">
                Not found on Discogs
              </Text>
              <Pressable
                onPress={() => {
                  dismissOverlay();
                  router.push('/(tabs)/search');
                }}
                className="bg-[#141414] border border-[#2a2a2a] rounded-2xl px-6 py-3 mt-4 active:opacity-80"
              >
                <Text className="text-[#a0a0a0] text-sm font-semibold">
                  Search Manually
                </Text>
              </Pressable>
            </View>
          )}

          {/* Error */}
          {scanState.status === 'error' && (
            <View className="items-center py-6 px-4">
              <Ionicons name="alert-circle-outline" size={40} color="#a0a0a0" />
              <Text className="text-[#a0a0a0] text-base mt-3 text-center">
                Something went wrong
              </Text>
              <Pressable
                onPress={dismissOverlay}
                className="bg-[#141414] border border-[#2a2a2a] rounded-2xl px-6 py-3 mt-4 active:opacity-80"
              >
                <Text className="text-[#a0a0a0] text-sm font-semibold">
                  Try Again
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

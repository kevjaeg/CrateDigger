import { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStore } from '@/lib/store/network-store';

export default function OfflineBanner() {
  const isOffline = useNetworkStore((s) => s.isOffline);
  const height = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (isOffline) {
      height.value = withTiming(36, { duration: 250 });
      opacity.value = withTiming(1, { duration: 250 });
    } else {
      height.value = withTiming(0, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [isOffline, height, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          backgroundColor: '#2a1a00',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          gap: 6,
        },
        animatedStyle,
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={14} color="#c4882a" />
      <Text style={{ color: '#c4882a', fontSize: 12 }}>
        You're offline — showing cached data
      </Text>
    </Animated.View>
  );
}

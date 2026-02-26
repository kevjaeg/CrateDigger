import { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

// --- Base Skeleton Block ---

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}

function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: '#1a1a1a' },
        animatedStyle,
        style,
      ]}
    />
  );
}

// --- Grid Skeleton (Collection / Wantlist) ---

export function SkeletonGrid() {
  const { width } = useWindowDimensions();
  const cardWidth = (width - 48) / 2;

  return (
    <View className="flex-1 bg-[#0a0a0a] px-4 pt-2">
      {[0, 1, 2].map((row) => (
        <View key={row} className="flex-row justify-between mb-4">
          {[0, 1].map((col) => (
            <View
              key={col}
              className="bg-[#141414] rounded-xl overflow-hidden"
              style={{ width: cardWidth }}
            >
              <Skeleton width={cardWidth} height={cardWidth} borderRadius={0} />
              <View className="px-3 py-2">
                <Skeleton width={cardWidth * 0.7} height={14} borderRadius={4} />
                <Skeleton
                  width={cardWidth * 0.5}
                  height={12}
                  borderRadius={4}
                  style={{ marginTop: 6 }}
                />
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// --- Search Result Skeleton ---

export function SkeletonSearchList() {
  return (
    <View className="px-4">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} className="flex-row bg-[#141414] rounded-xl overflow-hidden mb-3">
          <Skeleton width={80} height={80} borderRadius={0} />
          <View className="flex-1 px-3 py-3 justify-center">
            <Skeleton width="80%" height={14} borderRadius={4} />
            <Skeleton
              width="40%"
              height={12}
              borderRadius={4}
              style={{ marginTop: 6 }}
            />
            <Skeleton
              width="60%"
              height={12}
              borderRadius={4}
              style={{ marginTop: 6 }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

// --- Release Detail Skeleton ---

export function SkeletonReleaseDetail() {
  const { width } = useWindowDimensions();

  return (
    <View className="flex-1 bg-[#0a0a0a]">
      {/* Hero image */}
      <Skeleton width={width} height={width} borderRadius={0} />

      {/* Title & Artist */}
      <View className="px-4 pt-4 pb-2">
        <Skeleton width="70%" height={24} borderRadius={6} />
        <Skeleton
          width="45%"
          height={16}
          borderRadius={4}
          style={{ marginTop: 8 }}
        />
      </View>

      {/* Pills */}
      <View className="flex-row px-4 py-2 gap-2">
        <Skeleton width={60} height={28} borderRadius={14} />
        <Skeleton width={80} height={28} borderRadius={14} />
        <Skeleton width={70} height={28} borderRadius={14} />
      </View>

      {/* Stats */}
      <View className="flex-row px-4 py-3 gap-6">
        {[0, 1, 2].map((i) => (
          <View key={i} className="items-center">
            <Skeleton width={18} height={18} borderRadius={9} />
            <Skeleton
              width={40}
              height={20}
              borderRadius={4}
              style={{ marginTop: 6 }}
            />
            <Skeleton
              width={50}
              height={12}
              borderRadius={4}
              style={{ marginTop: 4 }}
            />
          </View>
        ))}
      </View>

      {/* Tracklist placeholder */}
      <View className="px-4 py-3">
        <Skeleton width={80} height={12} borderRadius={4} />
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} className="flex-row items-center py-2">
            <Skeleton width={30} height={14} borderRadius={4} />
            <Skeleton
              width="60%"
              height={14}
              borderRadius={4}
              style={{ marginLeft: 12 }}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

// --- Profile Skeleton ---

export function SkeletonProfile() {
  return (
    <View className="flex-1 bg-[#0a0a0a]">
      {/* Avatar */}
      <View className="items-center pt-8 pb-6 px-4">
        <Skeleton width={80} height={80} borderRadius={40} />
        <Skeleton
          width={120}
          height={20}
          borderRadius={6}
          style={{ marginTop: 12 }}
        />
      </View>

      {/* Collection Value */}
      <View className="mx-4 p-4 bg-[#141414] rounded-xl mb-4">
        <Skeleton width={100} height={12} borderRadius={4} />
        <View className="flex-row justify-between mt-3">
          {[0, 1, 2].map((i) => (
            <View key={i} className="items-center flex-1">
              <Skeleton width={60} height={16} borderRadius={4} />
              <Skeleton
                width={30}
                height={12}
                borderRadius={4}
                style={{ marginTop: 4 }}
              />
            </View>
          ))}
        </View>
      </View>

      {/* Stats cards */}
      <View className="flex-row mx-4 mb-4 gap-3">
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-1 bg-[#141414] rounded-xl p-4 items-center">
            <Skeleton width={50} height={24} borderRadius={6} />
            <Skeleton
              width={40}
              height={12}
              borderRadius={4}
              style={{ marginTop: 6 }}
            />
          </View>
        ))}
      </View>

      {/* Genre bars */}
      <View className="mx-4 mb-4">
        <Skeleton width={60} height={12} borderRadius={4} />
        <View className="bg-[#141414] rounded-xl p-4 mt-3">
          {[0, 1, 2, 3].map((i) => (
            <View key={i} className="mb-3">
              <Skeleton width="50%" height={14} borderRadius={4} />
              <Skeleton
                width="100%"
                height={8}
                borderRadius={4}
                style={{ marginTop: 6 }}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

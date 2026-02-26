import { useEffect } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface SyncProgressBarProps {
  progress: number; // 0–1
  visible: boolean;
}

export default function SyncProgressBar({ progress, visible }: SyncProgressBarProps) {
  const animatedProgress = useSharedValue(0);
  const opacity = useSharedValue(0);
  const containerWidth = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      animatedProgress.value = withTiming(progress, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      });
    } else {
      opacity.value = withTiming(0, { duration: 300 });
      animatedProgress.value = withTiming(0, { duration: 300 });
    }
  }, [progress, visible, animatedProgress, opacity]);

  const onLayout = (e: LayoutChangeEvent) => {
    containerWidth.value = e.nativeEvent.layout.width;
  };

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const barStyle = useAnimatedStyle(() => ({
    width: containerWidth.value * animatedProgress.value,
  }));

  return (
    <Animated.View style={containerStyle}>
      <View className="h-1 bg-[#1a1a1a]" onLayout={onLayout}>
        <Animated.View style={[{ height: 4, backgroundColor: '#c4882a' }, barStyle]} />
      </View>
    </Animated.View>
  );
}

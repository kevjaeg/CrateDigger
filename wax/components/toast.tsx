import { useEffect } from 'react';
import { Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useToastStore, type ToastType } from '@/lib/store/toast-store';

const COLORS: Record<ToastType, { bg: string; text: string; icon: string }> = {
  error: { bg: '#2a1010', text: '#f87171', icon: '#f87171' },
  success: { bg: '#0a2a10', text: '#4ade80', icon: '#4ade80' },
  info: { bg: '#141414', text: '#a0a0a0', icon: '#a0a0a0' },
};

const ICONS: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  error: 'alert-circle',
  success: 'checkmark-circle',
  info: 'information-circle',
};

export default function Toast() {
  const { message, type, visible, hide } = useToastStore();
  const { top } = useSafeAreaInsets();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.ease) });
      opacity.value = withTiming(1, { duration: 250 });
    } else {
      translateY.value = withTiming(-100, { duration: 200, easing: Easing.in(Easing.ease) });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const colors = COLORS[type];

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: top + 8,
          left: 16,
          right: 16,
          zIndex: 9999,
          backgroundColor: colors.bg,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.icon + '30',
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
        },
        animatedStyle,
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Ionicons name={ICONS[type]} size={18} color={colors.icon} />
      <Text
        style={{ color: colors.text, fontSize: 14, marginLeft: 10, flex: 1 }}
        numberOfLines={2}
      >
        {message}
      </Text>
      <Pressable onPress={hide} hitSlop={8}>
        <Ionicons name="close" size={16} color={colors.text} />
      </Pressable>
    </Animated.View>
  );
}

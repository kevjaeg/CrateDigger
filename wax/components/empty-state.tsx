import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  title: string;
  subtitle: string;
  icon: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title,
  subtitle,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={64}
        color="#6b6b6b"
      />
      <Text className="text-white text-xl font-bold mt-6 text-center">
        {title}
      </Text>
      <Text className="text-[#a0a0a0] text-base mt-2 text-center leading-6">
        {subtitle}
      </Text>
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          className="mt-6 bg-[#c4882a] rounded-full px-8 py-3"
        >
          <Text className="text-white text-base font-semibold">
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

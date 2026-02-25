import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function ReleaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View className="flex-1 bg-[#0a0a0a] items-center justify-center">
      <Text className="text-white text-xl">Release #{id}</Text>
      <Text className="text-neutral-400 mt-2">Detail view coming soon</Text>
    </View>
  );
}
